import { LineageGraph } from '@/components/graph/lineage-graph';
import { copy } from '@/copy/en';
import type { ChangeKind } from '@/lib/operate/impact';
import { getPack } from '@/lib/packs/registry';
import { governedService } from '@/lib/presenter/governed';
import { impact } from '@/lib/presenter/operate';

const c = copy.operate.impact;
const CHANGES = Object.keys(c.changes) as ChangeKind[];
type SP = { object?: string; column?: string; change?: string };

export default async function ImpactPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const objects = [...pack.sources.map((s) => `RAW_BRONZE.${s.name}`), ...pack.objects.map((o) => o.fqn)];
  const fqn = objects.find((o) => o === sp.object);
  const change = CHANGES.find((x) => x === sp.change) ?? 'rename';
  const columns = fqn ? await governedService(packId).then((qs) => qs.describe(fqn)).catch(() => []) : [];
  const column = columns.find((col) => col.name === sp.column)?.name;
  const r = fqn ? await impact(packId, { fqn, change, ...(column ? { column } : {}) }) : null;
  const field = 'h-9 rounded-md border border-border bg-surface px-2';
  const section = (title: string, items: string[], id: string) => (
    <section aria-labelledby={id} className="rounded-md border border-border p-3">
      <h3 id={id} className="mb-1 text-sm font-semibold">
        {title} ({items.length})
      </h3>
      <ul className="text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-3" data-testid="impact-form">
        <label className="flex flex-col gap-1 text-sm">
          {c.object}
          <select name="object" defaultValue={fqn ?? ''} className={field}>
            <option value="">—</option>
            {objects.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {c.column}
          <select name="column" defaultValue={column ?? ''} className={field}>
            <option value="">—</option>
            {columns.map((col) => (
              <option key={col.name} value={col.name}>
                {col.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {c.change}
          <select name="change" defaultValue={change} className={field}>
            {CHANGES.map((k) => (
              <option key={k} value={k}>
                {c.changes[k]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground" data-testid="impact-run">
          {c.analyse}
        </button>
      </form>
      {!r && <p className="text-muted-foreground">{c.pick}</p>}
      {r && (
        <div className="flex flex-col gap-4" data-testid="impact-result" data-severity={r.severity} data-bump={r.bump}>
          <dl className="flex flex-wrap gap-6">
            <div>
              <dt className="text-sm text-muted-foreground">{c.severity}</dt>
              <dd className={`text-xl font-semibold ${r.severity === 'high' ? 'text-fail' : r.severity === 'medium' ? 'text-degraded' : ''}`}>{r.severity}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{c.bump}</dt>
              <dd className="text-xl font-semibold">{r.bump}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">{c.notice}</dt>
              <dd className="text-xl font-semibold">
                {r.noticeDays} {c.days}
              </dd>
            </div>
          </dl>
          <section aria-labelledby="plan-h" className="rounded-lg border border-border bg-surface p-3">
            <h2 id="plan-h" className="font-semibold">{c.plan}</h2>
            <ol className="list-decimal pl-5 text-sm">
              {r.plan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </section>
          <div className="grid gap-3 md:grid-cols-3">
            {section(c.objects, r.objects, 'imp-obj')}
            {section(c.metrics, r.metrics.map((m) => `${m.view} · ${m.label}`), 'imp-met')}
            {section(c.kpis, r.kpis.map((k) => k.name), 'imp-kpi')}
            {section(c.products, r.products.map((p) => `${p.id} ${p.name} (${p.status.toLowerCase()})`), 'imp-prod')}
            {section(c.agents, r.agents.map((a) => `${a.id} ${a.name}`), 'imp-agent')}
            {section(c.consumers, r.consumers, 'imp-cons')}
          </div>
          <LineageGraph nodes={r.graph.nodes.map((n) => ({ id: n.id, label: n.label, layer: n.layer, focus: n.id === r.target.fqn }))} edges={r.graph.edges} height={360} />
        </div>
      )}
    </div>
  );
}
