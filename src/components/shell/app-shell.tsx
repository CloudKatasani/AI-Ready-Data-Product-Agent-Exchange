import type { CSSProperties, ReactNode } from 'react';
import { copy } from '@/copy/en';
import type { AgentMode } from '@/lib/config/env';
import { type Brand, brandTokens } from '@/lib/presenter/branding';
import { DoorNav } from './door-nav';
import { Footer } from './footer';
import type { PersonaCard, SwitchPersonaAction } from './persona-switcher';
import { TopBar } from './top-bar';

interface AppShellProps {
  brand: Brand;
  pack: string;
  mode: AgentMode;
  asOf?: string;
  personas: PersonaCard[];
  activePersonaId: string;
  onSwitchPersona: SwitchPersonaAction;
  children: ReactNode;
}

export function AppShell({ brand, pack, mode, asOf, personas, activePersonaId, onSwitchPersona, children }: AppShellProps) {
  return (
    <div style={brandTokens(brand) as CSSProperties} className="grid min-h-screen grid-rows-[auto_1fr_auto]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:p-2">
        {copy.shell.skipToContent}
      </a>
      <TopBar brand={brand} pack={pack} mode={mode} personas={personas} activePersonaId={activePersonaId} onSwitchPersona={onSwitchPersona} />
      <div className="grid grid-cols-[15rem_1fr]">
        <aside className="border-r border-border bg-surface">
          <DoorNav pack={pack} />
        </aside>
        <main id="main" tabIndex={-1} className="min-w-0 p-6">
          {children}
        </main>
      </div>
      <Footer asOf={asOf} />
    </div>
  );
}
