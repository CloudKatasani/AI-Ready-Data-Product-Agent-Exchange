import { OutcomeCard } from '@/components/governance/outcome-card';
import { PolicyChips } from '@/components/governance/policy-chips';
import { CodeBlock } from '@/components/ui/code-block';
import { DataGrid } from '@/components/ui/data-grid';
import { copy } from '@/copy/en';
import { governedQuery } from '@/lib/presenter/governed';
import type { Pack } from '@/lib/packs/schema';
import type { Principal } from '@/lib/query/types';

export async function PreviewPanel({ pack, fqn, who }: { pack: Pack; fqn: string; who: Principal }) {
  const out = await governedQuery(pack.manifest.id, { kind: 'preview', fqn }, who);
  if (!out.ok) return <OutcomeCard outcome={out} pack={pack.manifest.id} />;
  const r = out.result;
  const maskPolicy = Object.fromEntries(r.policiesApplied.filter((p) => p.kind === 'masking').map((p) => [p.target.split('.').pop() ?? p.target, p.ruleOrPolicyId ?? 'masking policy']));
  return (
    <div className="flex flex-col gap-4" data-testid="preview">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>
          {r.rowCount} {copy.explorer.rows}
        </span>
        {r.maskedColumns.length > 0 && (
          <span data-testid="masked-count">
            {r.maskedColumns.length} {copy.explorer.masked}
          </span>
        )}
        {r.rowFiltered && <span>{copy.explorer.rowFiltered}</span>}
      </div>
      <PolicyChips policies={r.policiesApplied} />
      {r.rowCount === 0 ? <p>{copy.explorer.noRows}</p> : <DataGrid columns={r.columns} rows={r.rows} masked={r.maskedColumns} maskPolicy={maskPolicy} locale={pack.manifest.locale} caption={fqn} />}
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">{copy.explorer.displaySql}</summary>
        <CodeBlock code={r.displaySql} label={copy.explorer.displaySql} className="mt-2" />
      </details>
    </div>
  );
}
