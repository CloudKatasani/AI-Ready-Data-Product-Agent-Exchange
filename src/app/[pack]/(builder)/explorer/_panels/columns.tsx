import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { copy } from '@/copy/en';
import type { Pack } from '@/lib/packs/schema';
import { describeObject } from '@/lib/presenter/governed';
import { maskFor } from '@/lib/query/policies';
import type { Principal } from '@/lib/query/types';

export async function ColumnsPanel({ pack, fqn, who }: { pack: Pack; fqn: string; who: Principal }) {
  const cols = await describeObject(pack.manifest.id, fqn);
  const [schema, obj] = fqn.split('.');
  return (
    <table className="w-full text-sm" data-testid="columns">
      <thead className="text-left">
        <tr className="border-b border-border">
          {[copy.explorer.column, copy.explorer.type, copy.explorer.nullable, copy.explorer.tags, copy.explorer.term, copy.explorer.masking].map((h) => (
            <th key={h} scope="col" className="px-2 py-2 font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {cols.map((c) => {
          const col = `${fqn}.${c.name}`;
          const tag = pack.policies.column_tags.find((t) => t.column === col);
          const bronze = schema === 'RAW_BRONZE' ? pack.sources.find((s) => s.name === obj)?.columns.find((x) => x.name === c.name)?.tags ?? [] : [];
          const classes = [...(tag?.classes ?? []), ...bronze];
          const term = pack.glossary.find((t) => t.mappings.columns.includes(col));
          const mask = maskFor(pack, who, col);
          return (
            <tr key={c.name} className="border-b border-border">
              <td className="px-2 py-1.5 font-mono">{c.name}</td>
              <td className="px-2 py-1.5 font-mono text-muted-foreground">{c.type}</td>
              <td className="px-2 py-1.5">{c.nullable ? 'yes' : 'no'}</td>
              <td className="px-2 py-1.5">
                <span className="flex flex-wrap gap-1">
                  {classes.map((cls) => (
                    <Badge key={cls} variant="outline" className="border-degraded text-degraded">
                      {cls}
                    </Badge>
                  ))}
                  {tag?.cde && <Badge variant="outline">CDE</Badge>}
                </span>
              </td>
              <td className="px-2 py-1.5">
                {term && (
                  <Link className="text-primary underline" href={`/${pack.manifest.id}/glossary/${term.id}`}>
                    {term.name}
                  </Link>
                )}
              </td>
              <td className="px-2 py-1.5 text-xs">{mask ? mask.policyId : classes.length ? (tag?.mask_pending_fix ? copy.explorer.pendingFix : copy.explorer.clear) : ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
