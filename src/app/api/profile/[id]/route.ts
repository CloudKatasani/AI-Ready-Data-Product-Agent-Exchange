import { exportProfile, getProfile } from '@/lib/presenter/profiles';

/** GET /api/profile/:id — `.keystone-profile.json` download (no secrets). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params;
  const p = await getProfile(id);
  if (!p) return new Response('Unknown profile', { status: 404 });
  const file = `${p.name.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase() || 'profile'}.keystone-profile.json`;
  return new Response(exportProfile(p), { headers: { 'content-type': 'application/json', 'content-disposition': `attachment; filename="${file}"` } });
}
