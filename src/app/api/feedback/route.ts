import { cookies } from 'next/headers';
import { z } from 'zod';
import { recordFeedback } from '@/lib/presenter/ask';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { PERSONA_COOKIE, resolvePersona, verifyPersona } from '@/lib/presenter/session';

export const dynamic = 'force-dynamic';

const Body = z.object({ pack: z.string().min(1).max(64), answerId: z.string().min(1).max(64), rating: z.union([z.literal(1), z.literal(-1)]), reason: z.string().max(500).optional() });

/** POST /api/feedback — 👍/👎 on an answer; the persona comes from the signed cookie. */
export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !hasPack(parsed.data.pack)) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const pack = getPack(parsed.data.pack);
  const persona = resolvePersona(pack, verifyPersona((await cookies()).get(PERSONA_COOKIE)?.value, getEnv().SESSION_SECRET));
  try {
    const fb = await recordFeedback({ answerId: parsed.data.answerId, personaId: persona.id, rating: parsed.data.rating, reason: parsed.data.reason });
    return Response.json({ id: fb.id });
  } catch {
    return Response.json({ error: 'Unknown answer' }, { status: 404 });
  }
}
