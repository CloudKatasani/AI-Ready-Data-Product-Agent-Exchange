import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { copy } from '@/copy/en';
import { answeredCount } from '@/lib/presenter/ask';
import type { TabProps } from '.';

const dt = 'text-muted-foreground';

export function OverviewTab({ pack, product, card }: TabProps) {
  const persona = (id: string | null) => pack.personas.find((p) => p.id === id)?.name ?? id ?? '—';
  const agent = pack.agents.find((a) => a.products.some((b) => b.id === product.id));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.product.purpose}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{product.purpose}</p>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1">
            <dt className={dt}>{copy.product.owner}</dt>
            <dd>{persona(product.owner)}</dd>
            <dt className={dt}>{copy.product.steward}</dt>
            <dd>{persona(product.steward)}</dd>
            <dt className={dt}>{copy.product.stage}</dt>
            <dd>{card.stage} / 12</dd>
            <dt className={dt}>{copy.marketplace.consumers}</dt>
            <dd>{product.consumers.join(', ') || '—'}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{copy.product.decision}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className={dt}>{copy.product.decision}</dt>
            <dd>{product.decision.decision}</dd>
            <dt className={dt}>{copy.product.decider}</dt>
            <dd>{product.decision.persona}</dd>
            <dt className={dt}>{copy.product.cadence}</dt>
            <dd>{product.decision.cadence}</dd>
            <dt className={dt}>{copy.product.workaround}</dt>
            <dd>{product.decision.workaround}</dd>
            <dt className={dt}>{copy.product.consequence}</dt>
            <dd>{product.decision.consequence}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{copy.product.sampleQuestions}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {product.sample_questions.map((q) => (
              <li key={q}>
                <Link href={`/${pack.manifest.id}/ask${agent ? `/${agent.id}` : ''}?q=${encodeURIComponent(q)}`} className="text-primary underline-offset-2 hover:underline" data-testid="sample-question">
                  {q}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function SemanticTab({ pack, product }: TabProps) {
  const view = pack.semantic.find((v) => v.name === product.semantic_view);
  if (!view) return <p className="text-muted-foreground">—</p>;
  const vqs = pack.verifiedQueries.filter((q) => q.query.view === view.name);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h2 className="mb-2 font-semibold">
          {copy.product.metrics} ·{' '}
          <Link className="text-primary underline" href={`/${pack.manifest.id}/semantic/${view.name}`}>
            {view.name}
          </Link>
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {view.metrics.map((m) => (
            <li key={m.name} className="rounded-md border border-border p-2">
              <p className="font-medium">
                {m.label} <span className="font-mono text-xs text-muted-foreground">{m.name}</span>
              </p>
              <p className="text-muted-foreground">{m.description}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">
          {copy.product.verified} ({vqs.length})
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {vqs.map((q) => (
            <li key={q.id} className="rounded-md border border-border p-2">
              <span className="font-mono text-xs text-muted-foreground">{q.id}</span> {q.question}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ConsumptionTab({ pack, product }: TabProps) {
  const db = pack.manifest.database;
  const endpoint = (kind: string, ref: string) =>
    kind === 'sql' ? `SELECT * FROM ${db}.${ref} LIMIT 100;` : kind === 'semantic' ? `SELECT * FROM SEMANTIC_VIEW(${db}.SEMANTIC.${ref} METRICS … DIMENSIONS …);` : kind === 'agent' ? `/${pack.manifest.id}/ask/${ref}` : `GET /api/products/${product.id}/${ref}`;
  return (
    <ul className="flex flex-col gap-3" data-testid="endpoints">
      {product.output_ports.map((o) => (
        <li key={`${o.kind}-${o.ref}`} className="rounded-md border border-border p-3 text-sm">
          <p className="font-semibold capitalize">{o.kind}</p>
          <p className="break-all font-mono text-xs">{endpoint(o.kind, o.ref)}</p>
        </li>
      ))}
    </ul>
  );
}

export function AgentsTab({ pack, product }: TabProps) {
  const agents = pack.agents.filter((a) => a.products.some((b) => b.id === product.id));
  if (!agents.length) return <p className="text-muted-foreground">{copy.product.noAgents}</p>;
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {agents.map((a) => {
        const cols = a.products.find((b) => b.id === product.id)?.columns;
        return (
          <li key={a.id} className="rounded-md border border-border p-3 text-sm">
            <Link className="font-semibold text-primary underline" href={`/${pack.manifest.id}/marketplace/agents/${a.id}`}>
              {a.name}
            </Link>
            <p className="text-muted-foreground">{a.capability}</p>
            <p className="mt-1 font-mono text-xs">{cols === '*' ? '*' : cols?.join(', ')}</p>
          </li>
        );
      })}
    </ul>
  );
}

export function ValueTab({ pack, product }: TabProps) {
  const vc = pack.value.find((v) => v.id === product.value_case);
  if (!vc) return <p className="text-muted-foreground">{copy.product.noValue}</p>;
  const usd = (n: number) => new Intl.NumberFormat(pack.manifest.locale, { style: 'currency', currency: pack.manifest.currency, maximumFractionDigits: 0 }).format(n);
  return (
    <div className="flex flex-col gap-4 text-sm" data-testid="value-case">
      <p className="text-base">{vc.hypothesis}</p>
      <dl className="grid grid-cols-[12rem_1fr] gap-y-1">
        <dt className={dt}>{copy.product.annualValue}</dt>
        <dd className="font-semibold">{usd(vc.annual_value_usd)}</dd>
        <dt className={dt}>{copy.product.measured}</dt>
        <dd>{vc.measured ? `${usd(vc.measured.value_usd)} · ${vc.measured.period} · ${vc.measured.confidence}` : '—'}</dd>
      </dl>
      <p className="font-mono text-xs">{vc.benefit_model}</p>
      <h3 className="font-semibold">{copy.product.assumptions}</h3>
      <ul className="list-disc pl-5">
        {vc.assumptions.map((a) => (
          <li key={a.text}>
            {a.text}: <span className="font-medium">{new Intl.NumberFormat(pack.manifest.locale).format(a.value)}</span> {a.unit.replace(/_/g, ' ')} <span className="text-muted-foreground">({a.source})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function HistoryTab({ pack, product, card }: TabProps) {
  const answers = await answeredCount(pack.manifest.id, pack.agents.filter((a) => a.products.some((b) => b.id === product.id)).map((a) => a.id));
  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        {copy.product.versions}: <span className="font-mono">v{card.version}</span> · {copy.marketplace.status[card.status]} · {copy.product.stage} {card.stage}/12
      </p>
      <p className="text-muted-foreground">{copy.product.historyPending}</p>
      <p className="text-muted-foreground">
        {copy.agentDetail.answers}: {answers}
      </p>
    </div>
  );
}
