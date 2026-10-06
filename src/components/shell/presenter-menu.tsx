'use client';

import * as Popover from '@radix-ui/react-popover';
import { MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { ADMIN_ITEM, packHref } from './nav';

/** Presenter `⋯` menu: launcher (hidden in kiosk mode), Admin; story tools live in the presenter overlay (Shift+P). */
export function PresenterMenu({ pack, locked = false }: { pack: string; locked?: boolean }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={copy.shell.presenterMenu}>
          <MoreHorizontal aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 flex w-64 flex-col gap-1 rounded-md border border-border bg-surface p-2 text-sm shadow-lg">
          {!locked && (
            <Link className="rounded px-2 py-1.5 hover:bg-muted" href="/launch">
              {copy.launcher.title}
            </Link>
          )}
          <Link className="rounded px-2 py-1.5 hover:bg-muted" href={packHref(pack, ADMIN_ITEM.path)}>
            {copy.nav.admin}
          </Link>
          <p className="px-2 py-1.5 text-muted-foreground">{copy.presenter.shortcuts}</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
