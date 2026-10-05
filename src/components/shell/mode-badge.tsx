import { Badge } from '@/components/ui/badge';
import { copy } from '@/copy/en';
import type { AgentMode } from '@/lib/config/env';

export function ModeBadge({ mode }: { mode: AgentMode }) {
  return (
    <Badge variant="outline" title={copy.shell.modeLabel} data-agent-mode={mode}>
      <span aria-hidden className="size-2 rounded-full bg-agent" />
      <span className="sr-only">{copy.shell.modeLabel}: </span>
      {copy.shell.modes[mode]}
    </Badge>
  );
}
