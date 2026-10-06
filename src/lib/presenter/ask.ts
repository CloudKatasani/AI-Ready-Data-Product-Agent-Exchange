/**
 * Server-side Ask entry point: routes (when no agent is chosen), answers in scripted mode through the
 * governed QueryService, and persists an append-only AnswerRecord. Live mode arrives in Phase 6; until
 * then `auto`/`live` requests answer in scripted mode with a visible fallback reason.
 */
import type { AgentMode } from '@/lib/config/env';
import { db } from '@/lib/db';
import { getRubrics } from '@/lib/packs/registry';
import { answerQuestion } from '@/lib/agents/runtime';
import { routeQuestion } from '@/lib/agents/scripted/router';
import { getEnv } from '@/lib/config/env';
import type { AgentAnswer } from '@/lib/agents/types';
import { livePack } from './factory';
import { liveClient } from './llm';
import { governedService, principalForPersona } from './governed';

export interface AskInput {
  packId: string;
  personaId: string;
  question: string;
  agentId?: string;
  mode?: AgentMode;
}

export interface AskOutput {
  answer: AgentAnswer;
  answerId: string | null;
  routed: { agentId: string; via: 'scenario' | 'coverage' | 'default' | 'chosen' };
}

export const MAX_QUESTION_LENGTH = 500;


export async function ask(input: AskInput): Promise<AskOutput> {
  const pack = await livePack(input.packId);
  const rubrics = getRubrics();
  const question = input.question.trim().slice(0, MAX_QUESTION_LENGTH);
  const chosen = input.agentId && pack.agents.some((a) => a.id === input.agentId) ? input.agentId : undefined;
  const routed = chosen ? { agentId: chosen, via: 'chosen' as const } : routeQuestion(pack, rubrics, question);
  const who = await principalForPersona(pack.manifest.id, input.personaId);
  const qs = await governedService(pack.manifest.id);
  const env = getEnv();
  const answer = await answerQuestion(routed.agentId, question, input.mode ?? 'scripted', {
    pack,
    rubrics,
    qs,
    who,
    live: { client: liveClient(), model: env.KEYSTONE_MODEL_ANSWER, timeoutMs: env.LLM_TIMEOUT_MS, maxRounds: env.LLM_MAX_TOOL_ROUNDS, budgetUsd: env.LLM_BUDGET_USD_PER_SESSION },
  });
  let answerId: string | null = null;
  try {
    const row = await db().answerRecord.create({
      data: {
        packId: pack.manifest.id,
        agentId: answer.agentId,
        personaId: input.personaId,
        question,
        kind: answer.kind,
        mode: answer.mode,
        fallbackReason: answer.fallbackReason ?? null,
        scenarioId: answer.scenarioId ?? null,
        metricQueryJson: answer.metricQuery ? JSON.stringify(answer.metricQuery) : null,
        answerJson: JSON.stringify(answer),
        citationsJson: JSON.stringify(answer.citations),
        traceJson: JSON.stringify(answer.trace),
        confidence: answer.confidence,
        latencyMs: answer.latencyMs,
        tokensIn: answer.tokensIn ?? 0,
        tokensOut: answer.tokensOut ?? 0,
        costUsd: answer.costUsd ?? 0,
      },
      select: { id: true },
    });
    answerId = row.id;
  } catch {
    // The demo never breaks: an unavailable app DB costs the record, not the answer.
  }
  return { answer, answerId, routed: { agentId: routed.agentId, via: routed.via } };
}

export async function recordFeedback(input: { answerId: string; personaId: string; rating: 1 | -1; reason?: string }): Promise<{ id: string }> {
  const answer = await db().answerRecord.findUnique({ where: { id: input.answerId }, select: { id: true } });
  if (!answer) throw new Error('Unknown answer');
  return db().answerFeedback.create({
    data: { answerId: input.answerId, personaId: input.personaId, rating: input.rating, reason: input.reason?.slice(0, 500) ?? null, state: 'NEW' },
    select: { id: true },
  });
}

/** Questions answered for a pack (Home counter). */
export async function answeredCount(packId: string, agentIds?: string[]): Promise<number> {
  try {
    return await db().answerRecord.count({ where: { packId, ...(agentIds ? { agentId: { in: agentIds } } : {}) } });
  } catch {
    return 0;
  }
}

export async function recentAnswers(packId: string, take = 8): Promise<{ id: string; agentId: string; question: string; kind: string; createdAt: Date }[]> {
  try {
    return await db().answerRecord.findMany({ where: { packId }, orderBy: { createdAt: 'desc' }, take, select: { id: true, agentId: true, question: true, kind: true, createdAt: true } });
  } catch {
    return [];
  }
}
