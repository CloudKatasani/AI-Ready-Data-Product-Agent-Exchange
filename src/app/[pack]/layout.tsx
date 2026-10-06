import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getEnv } from '@/lib/config/env';
import { getPack, hasPack } from '@/lib/packs/registry';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';
import { activePersona } from './_server/session';
import { switchPersona } from './actions';

export default async function PackLayout({ children, params }: { children: ReactNode; params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  if (!hasPack(packId)) notFound();
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  const asOf = new Intl.DateTimeFormat(pack.manifest.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${pack.manifest.asOf}T00:00:00Z`));
  return (
    <AppShell
      brand={{ ...DEFAULT_BRAND, companyName: pack.manifest.company.name }}
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
