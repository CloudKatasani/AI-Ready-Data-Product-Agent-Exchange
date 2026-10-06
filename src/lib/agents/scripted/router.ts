import type { Pack, Rubrics } from '@/lib/packs/schema';
import { checkGuardrails } from './guardrails';
import { plan } from './planner';
import { matcherFor } from './respond';

/** Router agent, scripted (08 §8): best scenario match across agents, else the first agent whose coverage plans it. */
export function routeQuestion(pack: Pack, rubrics: Rubrics, question: string): { agentId: string; score: number; via: 'scenario' | 'coverage' | 'default' } {
  const best = matcherFor(pack).rank(question)[0];
  if (best && best.score >= rubrics.matcher.clarify_threshold) return { agentId: best.scenario.agent, score: best.score, via: 'scenario' };
  for (const a of pack.agents.filter((x) => x.status === 'PRODUCTION')) {
    if (!checkGuardrails(a, question, rubrics.matcher.entity_nouns) && plan(pack, a, question)) return { agentId: a.id, score: 0, via: 'coverage' };
  }
  return { agentId: pack.manifest.home.heroAgent, score: 0, via: 'default' };
}
