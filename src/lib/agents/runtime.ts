/**
 * Dual-mode runtime (08 §1, ADR-0005): scripted (deterministic), live (LLM + tools), auto (live, falls
 * back to scripted). A live failure never surfaces as an error: the scripted answer is returned with a
 * `live_fallback` badge and the reason. Injection probes are declined before any model call.
 */
import type { Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import type { Principal } from '@/lib/query/types';
import type { LlmClient } from './live/client';
import { LiveFailure, respondLive } from './live/engine';
import { checkGuardrails } from './scripted/guardrails';
import { respondScripted } from './scripted/respond';
import type { AgentAnswer, AgentMode } from './types';

export interface LiveConfig {
  client: LlmClient | null;
  model: string | undefined;
  timeoutMs: number;
  maxRounds: number;
  budgetUsd?: number;
}

export interface RuntimeDeps {
  pack: Pack;
  rubrics: Rubrics;
  qs: QueryService;
  who: Principal;
  live?: LiveConfig;
}

const REASONS: Record<string, string> = {
  no_key: 'No API key is configured, so live mode is unavailable.',
  no_model: 'No answer model is configured.',
  network: 'The model service could not be reached.',
  timeout: 'The live answer took too long.',
  budget: 'The session LLM budget is spent.',
  grounding: 'The live answer failed the grounding check (a number was not traceable to a governed result).',
  rounds: 'The live agent used all its tool rounds without a grounded answer.',
  refusal: 'The model declined the request.',
  invalid: 'The live agent did not submit an answer.',
};

function fallback(a: AgentAnswer, reason: string, detail?: string): AgentAnswer {
  return { ...a, mode: 'live_fallback', fallbackReason: detail ? `${reason} ${detail}`.trim() : reason, banners: [{ kind: 'fallback', text: `Here is the governed answer from the scripted engine. ${reason}` }, ...a.banners] };
}

export async function answerQuestion(agentId: string, question: string, mode: AgentMode, deps: RuntimeDeps): Promise<AgentAnswer> {
  const scripted = () => respondScripted(agentId, question, deps);
  if (mode === 'scripted') return scripted();
  const agent = deps.pack.agents.find((a) => a.id === agentId);
  if (!agent) throw new Error(`Unknown agent ${agentId}`);
  const guard = checkGuardrails(agent, question, deps.rubrics.matcher.entity_nouns);
  if (guard?.kind === 'injection') return { ...(await scripted()), mode: 'live', fallbackReason: undefined };
  const live = deps.live;
  if (!live?.client) return fallback(await scripted(), REASONS.no_key ?? '');
  try {
    return await respondLive(agent, question, { pack: deps.pack, rubrics: deps.rubrics, qs: deps.qs, who: deps.who, client: live.client, model: live.model ?? '', timeoutMs: live.timeoutMs, maxRounds: live.maxRounds, budgetUsd: live.budgetUsd });
  } catch (e) {
    if (e instanceof LiveFailure) return fallback(await scripted(), REASONS[e.reason] ?? e.reason, e.reason === 'grounding' ? '' : undefined);
    return fallback(await scripted(), REASONS.network ?? '');
  }
}
