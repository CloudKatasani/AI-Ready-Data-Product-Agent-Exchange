import { Database, Eye, FileCode2, Table2 } from 'lucide-react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import { cn } from '@/lib/utils';

export interface TreeObject {
  schema: string;
  name: string;
  kind: 'TABLE' | 'VIEW';
}

const SCHEMA_ORDER = ['RAW_BRONZE', 'CURATED_SILVER', 'CONFORMED_GOLD', 'SEMANTIC', 'GLOSSARY', 'CONTEXT', 'DATA_PRODUCTS', 'AGENTS', 'GOVERNANCE'];

/** Snowsight-style object browser: database → 9 layer schemas → objects. */
export function ObjectTree({ pack, database, objects, active }: { pack: string; database: string; objects: TreeObject[]; active?: { schema?: string; object?: string } }) {
  const schemas = SCHEMA_ORDER.filter((s) => objects.some((o) => o.schema === s));
  return (
    <nav aria-label={copy.explorer.tree} className="flex flex-col gap-1 text-sm">
      <p className="flex items-center gap-2 px-2 py-1 font-semibold">
        <Database aria-hidden className="size-4" />
        {database}
      </p>
      <Link href={`/${pack}/explorer/worksheet`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted" data-testid="open-worksheet">
        <FileCode2 aria-hidden className="size-4" />
        {copy.explorer.worksheet}
      </Link>
      {schemas.map((schema) => (
        <details key={schema} open={active?.schema === schema} className="group">
          <summary className={cn('cursor-pointer rounded px-2 py-1 font-medium hover:bg-muted', active?.schema === schema && 'text-primary')}>{schema}</summary>
          <ul className="ml-3 border-l border-border pl-2">
            {objects
              .filter((o) => o.schema === schema)
              .map((o) => {
                const Icon = o.kind === 'VIEW' ? Eye : Table2;
                const current = active?.schema === schema && active.object === o.name;
                return (
                  <li key={o.name}>
                    <Link
                      href={`/${pack}/explorer/${schema}/${o.name}`}
                      aria-current={current ? 'page' : undefined}
                      className={cn('flex min-h-[24px] items-center gap-2 truncate rounded px-2 py-0.5 hover:bg-muted', current && 'bg-primary text-primary-foreground hover:bg-primary')}
                    >
                      <Icon aria-hidden className="size-3.5 shrink-0" />
                      <span className="truncate">{o.name}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </details>
      ))}
    </nav>
  );
}
