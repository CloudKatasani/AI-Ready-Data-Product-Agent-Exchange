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
  locked?: boolean;
}

export function TopBar({ brand, pack, mode, personas, activePersonaId, onSwitchPersona, locked = false }: TopBarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b border-border bg-surface px-4">
      <Link href={`/${encodeURIComponent(pack)}/home`} className="flex min-w-0 items-center gap-2 font-semibold" title={brand.companyName ? `${brand.companyName} · ${brand.productName}` : brand.productName}>
        {brand.logoSvg ? (
          // eslint-disable-next-line @next/next/no-img-element -- presenter-uploaded data URL, never fetched
          <img src={brand.logoSvg} alt="" className="size-7 rounded object-contain" />
        ) : (
          <span aria-hidden className="grid size-7 place-items-center rounded bg-primary text-primary-foreground">
            {brand.productName.charAt(0)}
          </span>
        )}
        {/* Product name is the header; the (white-label) company name sits beneath it in small type. */}
        <span data-testid="brand-name" className="flex min-w-0 flex-col leading-tight">
          <span className="truncate max-w-[22rem] text-base font-semibold lg:max-w-[36rem]">{brand.productName}</span>
          {brand.companyName && (
            <span data-testid="brand-company" className="truncate max-w-[22rem] text-xs font-normal text-muted-foreground lg:max-w-[36rem]">
              {brand.companyName}
            </span>
          )}
        </span>
      </Link>
      {locked ? (
        <span data-testid="active-pack" className="rounded-md border border-border px-2 py-1 text-sm">
          {pack}
        </span>
      ) : (
        <Link href="/launch" aria-label={copy.shell.packSwitcher} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm hover:bg-muted">
          <span data-testid="active-pack">{pack}</span>
          <ChevronsUpDown aria-hidden className="size-3.5" />
        </Link>
      )}
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
        <PresenterMenu pack={pack} locked={locked} />
      </div>
    </header>
  );
}
