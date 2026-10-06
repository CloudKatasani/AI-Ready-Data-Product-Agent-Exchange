/**
 * LLM client seam: the live engine talks to this interface, so tests and offline demos inject a scripted
 * fake. The real implementation streams via the Anthropic SDK and returns the final message.
 */
import Anthropic from '@anthropic-ai/sdk';

export interface LlmClient {
  send(params: Anthropic.MessageCreateParamsNonStreaming, signal: AbortSignal): Promise<Anthropic.Message>;
}

export function anthropicClient(apiKey: string): LlmClient {
  // One retry (08 §4.5); the engine's overall timeout bounds the wall clock.
  const client = new Anthropic({ apiKey, maxRetries: 1 });
  return {
    async send(params, signal) {
      return client.messages.stream(params, { signal }).finalMessage();
    },
  };
}
