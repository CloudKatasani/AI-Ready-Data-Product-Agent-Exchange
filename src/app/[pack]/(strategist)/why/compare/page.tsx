import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { compare } from '@/lib/presenter/strategy';
import { activePrincipal } from '../../../_server/session';

const c = copy.strategy;

export default async function ComparePage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  const pack = getPack(packId);
  const rows = await compare(packId, await activePrincipal(pack)).catch(() => []);
  const fmt = new Intl.NumberFormat(pack.manifest.locale, { maximumFractionDigits: 2 });
  const yes = (b: boolean) => (b ? c.compare.yes : c.compare.no);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.compare.title}</h1>
        <p className="text-muted-foreground">{c.compare.intro}</p>
      </header>
      {rows.map(({ governed: g, raw: r }) => (
        <section key={g.id} aria-labelledby={`cmp-${g.id}`} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-compare={g.id}>
          <h2 id={`cmp-${g.id}`} className="font-semibold">
            {g.question}
          </h2>
          <table className="w-full text-sm">
            <caption className="sr-only">{c.compare.scorecard}</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col">{c.compare.scorecard}</th>
                <th scope="col">{c.compare.raw}</th>
                <th scope="col">{c.compare.governed}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">{c.knockout.governed}</th>
                <td className="tabular-nums" data-testid="raw-value">{r?.value === null || r?.value === undefined ? c.knockout.notComputable : fmt.format(r.value)}</td>
                <td className="tabular-nums font-semibold" data-testid="governed-value">{g.value === null ? c.knockout.none : fmt.format(g.value)}</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">{c.compare.rules}</th>
                <td>{yes(Boolean(r?.policies.some((p) => p.kind === 'rule')))}</td>
                <td>{yes(g.policies.some((p) => p.kind === 'rule'))}</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">{c.compare.policies}</th>
                <td>{yes(Boolean(r?.policies.some((p) => p.kind === 'row_access' || p.kind === 'masking')))}</td>
                <td>{yes(!g.policies.some((p) => p.kind === 'knockout'))}</td>
              </tr>
              <tr className="border-t border-border">
                <th scope="row" className="py-1 text-left font-normal">{c.readiness.score}</th>
                <td>{r ? c.confidence[r.confidence] : '—'}</td>
                <td>{c.confidence[g.confidence]}</td>
              </tr>
            </tbody>
          </table>
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <h3 className="mb-1 text-sm font-semibold">{c.compare.raw}</h3>
              {r?.displaySql ? <CodeBlock code={r.displaySql} label={c.compare.raw} /> : <p className="text-sm text-muted-foreground">{r?.error?.split('\n')[0] ?? '—'}</p>}
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold">{c.compare.governed}</h3>
              <CodeBlock code={g.displaySql} label={c.compare.governed} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
