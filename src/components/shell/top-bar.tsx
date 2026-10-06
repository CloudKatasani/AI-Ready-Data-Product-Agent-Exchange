import { ChevronsUpDown, Search } from 'lucide-react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import type { AgentMode } from '@/lib/config/env';
import type { Brand } from '@/lib/presenter/branding';
import { ModeBadge } from './mode-badge';
import { type PersonaCard, PersonaSwitcher, type SwitchPersonaAction } from './persona-switcher';
import { PresenterMenu } from './presenter-menu';

interface TopBarProps {
  brand: Brand;
  pack: string;
  mode: AgentMode;
  personas: PersonaCard[];
  activePersonaId: string;
  onSwitchPersona: SwitchPersonaAction;
}

export function TopBar({ brand, pack, mode, personas, activePersonaId, onSwitchPersona }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
      <Link href={`/${encodeURIComponent(pack)}/home`} className="flex items-center gap-2 font-semibold">
        <span aria-hidden className="grid size-7 place-items-center rounded bg-primary text-primary-foreground">
          {brand.productName.charAt(0)}
        </span>
        {brand.companyName ? `${brand.companyName} · ${brand.productName}` : brand.productName}
      </Link>
      <Link
        href="/launch"
        aria-label={copy.shell.packSwitcher}
        className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm hover:bg-muted"
      >
        <span data-testid="active-pack">{pack}</span>
        <ChevronsUpDown aria-hidden className="size-3.5" />
      </Link>
      <label className="ml-4 flex max-w-md flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
        <Search aria-hidden className="size-4" />
        <span className="sr-only">{copy.shell.searchPlaceholder}</span>
        <input type="search" placeholder={copy.shell.searchPlaceholder} className="w-full bg-transparent text-foreground outline-none" />
        <kbd className="whitespace-nowrap rounded border border-border px-1.5 text-xs">{copy.shell.searchShortcut}</kbd>
        <kbd className="whitespace-nowrap rounded border border-border px-1.5 text-xs">{copy.shell.paletteShortcut}</kbd>
      </label>
      <div className="ml-auto flex items-center gap-2">
        <ModeBadge mode={mode} />
        <PersonaSwitcher pack={pack} personas={personas} activeId={activePersonaId} onSwitch={onSwitchPersona} />
        <PresenterMenu pack={pack} />
      </div>
    </header>
  );
}
