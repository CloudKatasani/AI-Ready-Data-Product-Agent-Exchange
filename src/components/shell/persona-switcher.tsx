'use client';

import * as Popover from '@radix-ui/react-popover';
import { Check, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { cn } from '@/lib/utils';

export interface PersonaCard {
  id: string;
  name: string;
  title: string;
  archetype: string;
  sees: string;
}

export type SwitchPersonaAction = (packId: string, personaId: string) => Promise<{ ok: boolean; name?: string; sees?: string }>;

interface Props {
  pack: string;
  personas: PersonaCard[];
  activeId: string;
  /** Server action that sets the signed persona cookie. */
  onSwitch: SwitchPersonaAction;
}

/** The most important demo gesture (01 §2.2): re-renders every screen with that identity's policies. */
export function PersonaSwitcher({ pack, personas, activeId, onSwitch }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [pending, start] = useTransition();
  const active = personas.find((p) => p.id === activeId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (id: string) =>
    start(async () => {
      const r = await onSwitch(pack, id);
      setOpen(false);
      if (r.ok) {
        setToast(`${copy.shell.personaNowViewing} ${r.name} — ${r.sees}`);
        router.refresh();
      }
    });

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button variant="outline" size="sm" aria-keyshortcuts="Control+Shift+P" data-testid="persona-trigger" disabled={pending}>
            <UserRound aria-hidden />
            <span className="max-w-48 truncate">{active ? `${active.name} · ${active.archetype}` : copy.shell.persona}</span>
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} className="z-50 w-96 rounded-md border border-border bg-surface p-2 text-sm shadow-lg">
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{copy.shell.personaHeading}</p>
            <ul className="flex flex-col gap-1">
              {personas.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => choose(p.id)}
                    data-persona={p.archetype}
                    className={cn('flex w-full items-start gap-3 rounded-md p-2 text-left hover:bg-muted', p.id === activeId && 'bg-muted')}
                  >
                    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-human font-semibold text-white">
                      {p.archetype}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">
                        {p.name} <span className="text-muted-foreground">· {p.title}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{p.sees}</span>
                    </span>
                    {p.id === activeId && <Check aria-label="active" className="ml-auto size-4 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div role="status" aria-live="polite" data-testid="persona-toast" className={cn('fixed bottom-12 right-4 z-50 max-w-md rounded-md bg-foreground px-4 py-2 text-sm text-background shadow-lg', !toast && 'sr-only')}>
        {toast}
      </div>
    </>
  );
}
