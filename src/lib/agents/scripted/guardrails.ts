/**
 * Scripted guardrails (08 §3.4, §4.6): prompt-injection probes, out-of-scope requests and record-level
 * lookups are declined before anything executes. Generic English patterns only; scope and the nouns that
 * name an individual record holder come from packs (agent manifest, shared rubrics).
 */
import type { AgentManifest } from '@/lib/packs/schema';
import { normalise, tokens } from './text';

const INJECTION = [
  /\bignore (all |any |the |your |my )?(previous |prior |above |earlier )?(instructions|rules|prompts?|guidelines|policies)\b/,
  /\b(system prompt|developer message|hidden instructions|api key|access token)s?\b/,
  /\b(do whatever|follow the (note|instructions?|directions?|memo)|comply with (it|this|that|the (note|document|memo)))\b/,
  /\b(unrestricted|jailbroken|jailbreak|developer mode|god mode|no (data )?polic(y|ies))\b/,
  /\b(unmask|de-?mask|unredact|un-?redact)\b/,
  /\b(reveal|show|print|dump|list|export|write out) (all|every|the full|raw|the real|real) .*(emails?|phone numbers?|addresses|names|ssn|card numbers?|passwords?|identifiers?|records|rows)\b/,
  /\b(full|complete|unmasked|raw) (card numbers?|tax identifiers?|identifiers?|ssns?|account numbers?|rows|records)\b/,
  /\b(identifiers?|numbers?|values?|columns?) in full\b|\bnot just the last (four|4)\b/,
  /\b(email|e-mail) addresses\b|\bphone numbers?\b|\bstreet address(es)?\b|\bcontact details\b/,
  /\b(real|actual) records\b/,
  /\b(bypass|disable|turn off|switch off|remove|lift) .*(mask|masking|polic|governance|row filter|security|filter)\b/,
  /\b(governance|masking|polic(y|ies)) (is |are )?(switched|turned) off\b/,
  /\b(act as|pretend (to be|you are)|you are now) /,
  /\b(allowed|permitted|authori[sz]ed) to (reveal|share|show|disclose)\b/,
  /\b(approve|grant|certify|publish) (my|the|this|that)\b/,
  /\b(drop|delete|truncate|update|insert into|alter) (table|from|into|the)\b/,
  /\b(run|execute) (this )?(sql|query|command|code)\b/,
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const recordLevelCache = new Map<string, RegExp[]>();
function recordLevel(nouns: string[]): RegExp[] {
  const key = nouns.join('|');
  let res = recordLevelCache.get(key);
  if (!res) {
    const n = nouns.map((x) => escape(x.toLowerCase())).join('|');
    res = [
      new RegExp(`\\b(${n})\\s*(no|number|id|#)?\\s*(?:[a-z]{1,4}\\s*)?\\d{4,}\\b`),
      new RegExp(`\\b(individual|specific|single|this|that|named) (${n})s?\\b`),
      new RegExp(`\\b(${n}) (history|details|record|profile) (for|of)\\b`),
    ];
    recordLevelCache.set(key, res);
  }
  return res;
}

export type GuardrailHit = { kind: 'injection' | 'out_of_scope' | 'customer_level'; reason: string };

/** Fraction of an out-of-scope phrase's content words present in the question. */
function overlap(question: string, phrase: string): number {
  const q = new Set(tokens(question));
  const p = tokens(phrase);
  return p.length ? p.filter((t) => q.has(t)).length / p.length : 0;
}

export function checkGuardrails(agent: AgentManifest, question: string, entityNouns: string[]): GuardrailHit | null {
  const q = normalise(question);
  if (INJECTION.some((re) => re.test(q))) return { kind: 'injection', reason: 'The request asks me to change my instructions, bypass governance, reveal protected values or act on approvals — I only answer governed, aggregate questions.' };
  for (const phrase of agent.out_of_scope) {
    if (overlap(question, phrase) >= 0.6) return { kind: 'out_of_scope', reason: `"${phrase}" is outside what ${agent.name} covers.` };
  }
  if (agent.guardrails.refuse_customer_level && recordLevel(entityNouns).some((re) => re.test(q))) {
    return { kind: 'customer_level', reason: `${agent.name} answers at an aggregate level and does not look up individual records.` };
  }
  return null;
}
