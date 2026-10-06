import { BookOpen, Box, Code2, FileCheck2, Ruler, ScrollText } from 'lucide-react';
import type { Citation } from '@/lib/agents/types';

const ICON = { product: Box, metric: Ruler, rule: ScrollText, verified_query: FileCheck2, document: BookOpen, sql: Code2 } as const;

/** Citation chips: product@version, metric, rule, verified query, document passage, governed SQL. */
export function CitationChips({ citations }: { citations: Citation[] }) {
  if (!citations.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Citations" data-testid="citations">
      {citations.map((c, i) => {
        const Icon = ICON[c.kind];
        return (
          <li key={`${c.kind}-${c.ref}-${i}`} data-citation={c.kind} title={c.detail ?? c.ref} className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border bg-background px-2 py-0.5 text-xs">
            <Icon aria-hidden className="size-3.5 shrink-0 text-primary" />
            <span className="truncate">{c.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
