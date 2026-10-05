'use client';

import * as Popover from '@radix-ui/react-popover';
import { UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copy } from '@/copy/en';

/** Phase 0 placeholder: personas are loaded from the active pack and stored in a signed cookie in Phase 2. */
export function PersonaSwitcher() {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="outline" size="sm" aria-keyshortcuts="Control+Shift+P">
          <UserRound aria-hidden />
          {copy.shell.persona}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className="z-50 w-72 rounded-md border border-border bg-surface p-4 text-sm shadow-lg">
          {copy.shell.personaPending}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
