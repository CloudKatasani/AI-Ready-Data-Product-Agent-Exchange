import { describe, expect, it } from 'vitest';
import { isolateDb } from '../setup/isolated-db';

await isolateDb('presenter');

describe('Demo Profiles and stories', async () => {
  const { PrismaClient } = await import('@prisma/client');
  const { resolveDatabaseUrl } = await import('@/lib/db');
  const { getPack, getStories, listPackIds } = await import('@/lib/packs/registry');
  const { accessibleAlternative, checkBrand, contrastRatio } = await import('@/lib/presenter/branding');
  const { createProfile, defaultProfileInput, exportProfile, importProfile, listProfiles, ProfileError } = await import('@/lib/presenter/profiles');
  const { resolveStory, resolveText } = await import('@/lib/presenter/stories');

  it('AC1.2 brand colours failing AA are rejected with a suggested accessible alternative', async () => {
    const bad = { ...defaultProfileInput('utilities'), brand: { productName: 'X', companyName: 'Y', primary: '#7a7a7a', accent: '#0f766e' } };
    await expect(createProfile(bad)).rejects.toBeInstanceOf(ProfileError);
    const check = checkBrand(bad.brand);
    expect(check.ok).toBe(false);
    const s = check.problems[0]?.suggestion ?? '';
    expect(Math.max(contrastRatio(s, '#ffffff'), contrastRatio(s, '#0f172a'))).toBeGreaterThanOrEqual(4.5);
    expect(accessibleAlternative('#1d4ed8')).toBe('#1d4ed8');
  });

  it('AC1.3 profiles persist across a server restart (a new client reads them)', async () => {
    const p = await createProfile({ ...defaultProfileInput('banking'), name: 'Persisted', terms: { [getPack('banking').manifest.regions[0] ?? '']: 'Territory 1' } });
    const fresh = new PrismaClient({ datasourceUrl: resolveDatabaseUrl(process.env.DATABASE_URL ?? '') });
    const row = await fresh.demoProfile.findUnique({ where: { id: p.id } });
    await fresh.$disconnect();
    expect(row?.name).toBe('Persisted');
    expect((await listProfiles()).some((x) => x.id === p.id)).toBe(true);
  });

  it('rejects terminology the pack does not allow; export → import round-trips without secrets', async () => {
    await expect(createProfile({ ...defaultProfileInput('utilities'), terms: { 'not a term': 'x' } })).rejects.toThrow(/Not overridable/);
    const p = await createProfile({ ...defaultProfileInput('utilities'), name: 'Round trip', storyId: 'business-15' });
    const json = exportProfile(p);
    expect(json).not.toMatch(/API_KEY|SECRET|sk-ant/i);
    const back = await importProfile(json);
    expect(back.storyId).toBe('business-15');
    expect(back.id).not.toBe(p.id);
  });

  const deep = listPackIds().filter((id) => {
    try {
      return getPack(id).manifest.depth === 'deep';
    } catch {
      return false;
    }
  });
  it.each(deep)('%s: every story step resolves — no placeholders left, a persona and a pack URL', (packId) => {
    const pack = getPack(packId);
    for (const s of getStories()) {
      const r = resolveStory(pack, s.id);
      expect(r?.steps.length).toBe(s.steps.length);
      for (const step of r?.steps ?? []) {
        expect(`${step.title} ${step.say} ${step.do.join(' ')} ${step.href}`, `${s.id}/${step.id}`).not.toMatch(/\{\{/);
        expect(step.href.startsWith(`/${packId}/`)).toBe(true);
        expect(pack.personas.find((p) => p.id === step.personaId)?.archetype).toBe(s.steps.find((x) => x.id === step.id)?.go.persona);
      }
    }
    expect(resolveText(pack, '{{company.name}} / {{roles.certDemoProduct.id}}')).toBe(`${pack.manifest.company.name} / ${pack.manifest.story_roles.certDemoProduct}`);
  });
});
