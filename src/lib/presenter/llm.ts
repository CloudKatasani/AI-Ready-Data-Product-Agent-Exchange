/** Server-side LLM wiring: one SDK client per process; null without a key (the key never leaves the server). */
import { anthropicClient, type LlmClient } from '@/lib/agents/live/client';
import { anthropicApiKey, getEnv } from '@/lib/config/env';

let client: LlmClient | null | undefined;

export function liveClient(): LlmClient | null {
  if (client === undefined) {
    const key = anthropicApiKey();
    client = key ? anthropicClient(key) : null;
  }
  return client;
}

/** Live provider for lifecycle agents, or null (heuristic) when no key/model is configured. */
export function lifecycleLlm(): { client: LlmClient; model: string; timeoutMs: number } | null {
  const c = liveClient();
  const env = getEnv();
  return c && env.KEYSTONE_MODEL_LIFECYCLE ? { client: c, model: env.KEYSTONE_MODEL_LIFECYCLE, timeoutMs: env.LLM_TIMEOUT_MS * 2 } : null;
}
