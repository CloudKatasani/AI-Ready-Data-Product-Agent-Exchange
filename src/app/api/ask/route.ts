import { cookies } from 'next/headers';
import { z } from 'zod';
import { MAX_QUESTION_LENGTH, ask } from '@/lib/presenter/ask';
import { AgentMode, getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { PERSONA_COOKIE, resolvePersona, verifyPersona } from '@/lib/presenter/session';

export const dynamic = 'force-dynamic';

const Body = z.object({
  pack: z.string().min(1).max(64),
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  agentId: z.string().max(64).optional(),
  mode: AgentMode.optional(),
  /** Milliseconds between streamed trace steps (presentation pacing; 0 in tests). */
  pace: z.number().int().min(0).max(400).optional(),
});

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/ask (02 §4) — server-sent events: `routed`, one `step` per trace step, `answer`, `done`.
 * The persona comes from the signed cookie, never from the request body.
 */
export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !hasPack(parsed.data.pack)) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const { pack: packId, question, agentId, mode, pace = 90 } = parsed.data;
  const pack = getPack(packId);
  const jar = await cookies();
  const persona = resolvePersona(pack, verifyPersona(jar.get(PERSONA_COOKIE)?.value, getEnv().SESSION_SECRET));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(sse(event, data)));
      try {
        const out = await ask({ packId, personaId: persona.id, question, agentId, mode: mode ?? getEnv().AGENT_MODE_DEFAULT });
        send('routed', out.routed);
        for (const s of out.answer.trace) {
          send('step', s);
          if (pace) await wait(pace);
        }
        send('answer', { answer: out.answer, answerId: out.answerId });
      } catch {
        // Never an error screen (promise 3): the client renders a calm help answer.
        send('error', { message: 'The agent could not answer right now. Try again, or reset the demo from the presenter menu.' });
      }
      send('done', {});
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', connection: 'keep-alive' } });
}
