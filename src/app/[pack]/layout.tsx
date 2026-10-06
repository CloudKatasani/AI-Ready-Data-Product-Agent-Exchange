import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { PresenterOverlay } from '@/components/presenter/presenter-overlay';
import { TerminologyOverrides } from '@/components/presenter/terms';
import { brandFor } from '@/lib/presenter/profiles';
import { allStories } from '@/lib/presenter/stories';
import { activePersona, activeProfile } from './_server/session';
import { switchPersona } from './actions';
import { goStepAction, resetDemoAction } from './presenter-actions';

export default async function PackLayout({ children, params }: { children: ReactNode; params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  if (!hasPack(packId)) notFound();
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  const profile = await activeProfile(pack);
  const stories = allStories(pack).map((st) => ({ id: st.id, title: st.title, minutes: st.minutes, steps: st.steps.map((x) => ({ id: x.id, title: x.title, do: x.do, say: x.say, href: x.href, ...(x.checkpoint ? { checkpoint: true } : {}), ...(x.spotlight ? { spotlight: x.spotlight } : {}) })) }));
  const asOf = new Intl.DateTimeFormat(pack.manifest.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${pack.manifest.asOf}T00:00:00Z`));
  return (
    <AppShell
      brand={brandFor(profile, pack.manifest.company.name)}
      locked={profile?.locked ?? false}
      overlay={
        <>
          <PresenterOverlay packId={packId} stories={stories} defaultStoryId={profile?.storyId ?? null} profileName={profile?.name ?? null} goStep={goStepAction.bind(null, packId)} reset={resetDemoAction.bind(null, packId)} />
          {profile && Object.keys(profile.terms).length > 0 && <TerminologyOverrides terms={profile.terms} />}
        </>
      }
      pack={packId}
      mode={getEnv().AGENT_MODE_DEFAULT}
      asOf={asOf}
      personas={pack.personas.map((p) => ({ id: p.id, name: p.name, title: p.title, archetype: p.archetype, sees: p.sees }))}
      activePersonaId={persona.id}
      onSwitchPersona={switchPersona}
    >
      {children}
    </AppShell>
  );
}
