import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isolateDb } from '../setup/isolated-db';

await isolateDb('profiles');

/** 12-deployment §4 / ADR-0024: several presenters on one server — one app DB per Demo Profile. */
describe('profile isolation (shared server)', async () => {
  const { controlDb, db, profileDbPath, withProfileDb } = await import('@/lib/db');
  const { getPack } = await import('@/lib/packs/registry');
  const { archiveProfile, createProfile, defaultProfileInput, ensureProfileState, listProfiles } = await import('@/lib/presenter/profiles');
  const { resetDemo } = await import('@/lib/presenter/reset');
  const { breakNow } = await import('@/lib/presenter/operate');
  const pack = getPack('utilities');
  const steward = pack.personas.find((p) => p.archetype === 'D')?.id ?? '';
  const incidents = (id: string | null) => withProfileDb(id, () => db().incident.count());

  it('each profile gets its own app DB; profiles themselves stay in the control DB', async () => {
    const a = await createProfile({ ...defaultProfileInput('utilities'), name: 'Presenter A' });
    const b = await createProfile({ ...defaultProfileInput('utilities'), name: 'Presenter B' });
    expect(existsSync(profileDbPath(a.id) ?? '')).toBe(true);
    expect(existsSync(profileDbPath(b.id) ?? '')).toBe(true);
    expect((await listProfiles()).map((p) => p.id)).toEqual(expect.arrayContaining([a.id, b.id]));
    expect(await controlDb().demoProfile.count({ where: { id: { in: [a.id, b.id] } } })).toBe(2);
  });

  it("one presenter's writes and reset never touch another presenter's or the default demo's state", async () => {
    const a = await createProfile({ ...defaultProfileInput('utilities'), name: 'Isolated A' });
    const b = await createProfile({ ...defaultProfileInput('utilities'), name: 'Isolated B' });
    const start = { a: await incidents(a.id), b: await incidents(b.id), control: await incidents(null) };
    // A template not already open in A's copied state (breakNow reuses an open incident).
    const open = await withProfileDb(a.id, () => db().incident.findMany({ where: { packId: 'utilities', state: { not: 'RESOLVED' } }, select: { templateId: true } }));
    const template = pack.incidents.find((t) => !open.some((o) => o.templateId === t.id));
    if (!template) throw new Error('every incident template is already open');
    await withProfileDb(a.id, () => breakNow('utilities', template.id, steward));
    // Array transactions route as a unit too.
    await withProfileDb(a.id, () => db().$transaction([db().persona.updateMany({ data: { title: 'Only in A' } })]));
    expect(await incidents(a.id)).toBe(start.a + 1);
    expect(await incidents(b.id)).toBe(start.b);
    expect(await incidents(null)).toBe(start.control);
    expect(await withProfileDb(b.id, () => db().persona.count({ where: { title: 'Only in A' } }))).toBe(0);
    await resetDemo(a.id);
    expect(await incidents(a.id)).toBe(start.a);
    expect(await withProfileDb(a.id, () => db().persona.count({ where: { title: 'Only in A' } }))).toBe(0);
  });

  it('launch recreates a missing profile DB; archive removes it', async () => {
    const p = await createProfile({ ...defaultProfileInput('utilities'), name: 'Recreated' });
    expect(await ensureProfileState(p.id)).toBe(false);
    await archiveProfile(p.id);
    expect(existsSync(profileDbPath(p.id) ?? '')).toBe(false);
    expect(await ensureProfileState(p.id)).toBe(true);
    expect(existsSync(profileDbPath(p.id) ?? '')).toBe(true);
  });
});
