import type { AgentAnswer, TraceStep } from '@/lib/agents/types';

export type AskEvent =
  | { event: 'routed'; data: { agentId: string; via: string } }
  | { event: 'step'; data: TraceStep }
  | { event: 'answer'; data: { answer: AgentAnswer; answerId: string | null } }
  | { event: 'error'; data: { message: string } }
  | { event: 'done'; data: Record<string, never> };

/** Posts to /api/ask and yields parsed server-sent events. */
export async function* askStream(body: { pack: string; question: string; agentId?: string; pace?: number; mode?: 'scripted' | 'live' | 'auto' }, signal?: AbortSignal): AsyncGenerator<AskEvent> {
  const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal });
  if (!res.ok || !res.body) {
    yield { event: 'error', data: { message: `Request failed (${res.status})` } };
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = /^event: (.*)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) } as AskEvent;
    }
  }
}
