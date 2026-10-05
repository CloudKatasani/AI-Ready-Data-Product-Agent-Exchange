import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';
import { getEnv } from '@/lib/config/env';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';

const PACK_ID = /^[a-z][a-z0-9-]{0,39}$/;

export default async function PackLayout({ children, params }: { children: ReactNode; params: Promise<{ pack: string }> }) {
  const { pack } = await params;
  // Phase 1 replaces this shape check with a pack-registry lookup.
  if (!PACK_ID.test(pack)) notFound();
  return (
    <AppShell brand={DEFAULT_BRAND} pack={pack} mode={getEnv().AGENT_MODE_DEFAULT}>
      {children}
    </AppShell>
  );
}
