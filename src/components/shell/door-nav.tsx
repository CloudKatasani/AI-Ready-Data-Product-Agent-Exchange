'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { copy } from '@/copy/en';
import { cn } from '@/lib/utils';
import { activeNavId, DOORS, type DoorId, packHref } from './nav';

export function DoorNav({ pack }: { pack: string }) {
  const pathname = usePathname();
  const active = activeNavId(pathname);
  const [collapsed, setCollapsed] = useState<Partial<Record<DoorId, boolean>>>({});

  return (
    <nav aria-label={copy.shell.primaryNav} className="flex flex-col gap-4 p-3 text-sm">
      {DOORS.map((door) => {
        const isCollapsed = collapsed[door.id] ?? false;
        const listId = `door-${door.id}`;
        return (
          <div key={door.id}>
            {door.id !== 'home' && (
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={listId}
                onClick={() => setCollapsed((c) => ({ ...c, [door.id]: !isCollapsed }))}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted"
              >
                {copy.doors[door.id]}
                <ChevronDown aria-hidden className={cn('size-3.5 transition-transform', isCollapsed && '-rotate-90')} />
              </button>
            )}
            <ul id={listId} hidden={isCollapsed} className="mt-1 flex flex-col gap-0.5">
              {door.items.map((item) => {
                const Icon = item.icon;
                const current = item.id === active;
                return (
                  <li key={item.id}>
                    <Link
                      href={packHref(pack, item.path)}
                      aria-current={current ? 'page' : undefined}
                      data-nav-id={item.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted',
                        current && 'bg-primary text-primary-foreground hover:bg-primary',
                      )}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {copy.nav[item.id]}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
