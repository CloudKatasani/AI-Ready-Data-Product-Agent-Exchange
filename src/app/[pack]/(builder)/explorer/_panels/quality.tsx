import { copy } from '@/copy/en';
import type { Pack } from '@/lib/packs/schema';

/** Phase 2 placeholder: declared DMF-style rules; results and scores arrive with the quality engine (Phase 5). */
export function QualityPanel({ pack, fqn }: { pack: Pack; fqn: string }) {
  const rules = pack.dq.filter((d) => d.object === fqn);
  if (rules.length === 0) return <p className="text-sm text-muted-foreground">{copy.explorer.noRules}</p>;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">{copy.explorer.qualityPhase}</p>
      <table className="w-full">
        <thead className="text-left">
          <tr className="border-b border-border">
            {[copy.explorer.rule, copy.explorer.column, copy.explorer.dimension, copy.explorer.assertion, copy.explorer.severity].map((h) => (
              <th key={h} scope="col" className="px-2 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id} className="border-b border-border" title={r.description}>
              <td className="px-2 py-1 font-mono">{r.id}</td>
              <td className="px-2 py-1 font-mono">{r.column ?? '—'}</td>
              <td className="px-2 py-1">{r.dimension}</td>
              <td className="px-2 py-1 font-mono">{r.assertion}</td>
              <td className="px-2 py-1">{r.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
