import { Bot, Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AskConsole } from '@/components/answer/ask-console';
import { LinkTabs } from '@/components/explorer/tabs';
import { AccessChip } from '@/components/marketplace/chips';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { agentCard } from '@/lib/marketplace/catalog';
import { livePack } from '@/lib/presenter/factory';
import { answeredCount } from '@/lib/presenter/ask';
import { activePrincipal } from '../../../../_server/session';

const TABS = ['overview', 'coverage', 'products', 'instructions', 'evaluation', 'release', 'usage', 'try'] as const;
type Tab = (typeof TABS)[number];
const GRAINS = ['day', 'week', 'month', 'quarter', 'year'] as const;
const dt = 'text-muted-foreground';

export default async function AgentDetailPage({ params, searchParams }: { params: Promise<{ pack: string; id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { pack: packId, id: raw } = await params;
  const { tab: t } = await searchParams;
  const pack = await livePack(packId);
  const agent = pack.agents.find((a) => a.id === decodeURIComponent(raw));
  if (!agent) notFound();
  const who = await activePrincipal(pack);
  const card = agentCard(pack, agent, who);
  const tab: Tab = (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'overview';
  const base = `/${packId}/marketplace/agents/${agent.id}`;
  const kpi = (id: string) => pack.kpis.find((k) => k.id === id);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start gap-4">
        <span className="flex size-14 items-center justify-center rounded-full text-white" style={{ background: `hsl(${agent.avatar.hue} 60% 40%)` }}>
          <Bot aria-hidden className="size-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <Link href={`/${packId}/marketplace?tab=agents`} className="hover:underline">
              {copy.marketplace.title}
            </Link>{' '}
            / {agent.domain}
          </p>
          <h1 className="text-2xl font-semibold">{agent.name}</h1>
          <p className="text-muted-foreground">{agent.capability}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-agent px-2 py-0.5">{copy.marketplace.agentStatus[agent.status]}</span>
            <span className="rounded-full border border-border px-2 py-0.5">{agent.id}</span>
            <AccessChip access={card.access} />
          </div>
        </div>
        <Link href={`/${packId}/ask/${agent.id}`} className={buttonVariants()}>
          {copy.agentDetail.tryIt}
        </Link>
      </header>
      <LinkTabs label={agent.name} active={tab} tabs={TABS.map((x) => ({ id: x, label: copy.agentDetail.tabs[x], href: `${base}?tab=${x}` }))} />

      {tab === 'overview' && (
        <dl className="grid max-w-4xl grid-cols-[10rem_1fr] gap-y-2 text-sm">
          <dt className={dt}>{copy.agentDetail.personas}</dt>
          <dd>{agent.personas_served.join(', ')}</dd>
          <dt className={dt}>{copy.agentDetail.outOfScope}</dt>
          <dd>{agent.out_of_scope.join(' · ')}</dd>
          <dt className={dt}>{copy.agentDetail.guardrails}</dt>
          <dd>
            citations {agent.guardrails.citations_required ? 'required' : 'optional'} · record-level {agent.guardrails.refuse_customer_level ? 'refused' : 'allowed'} · sensitive output {agent.guardrails.pii_output} · ≤ {agent.guardrails.max_followups} follow-ups
          </dd>
          <dt className={dt}>{copy.product.owner}</dt>
          <dd>
            {pack.personas.find((p) => p.id === agent.owner)?.name ?? agent.owner} · {agent.on_call}
          </dd>
        </dl>
      )}

      {tab === 'coverage' && (
        <div role="region" aria-label={copy.agentDetail.tabs.coverage} tabIndex={0} className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm" data-testid="coverage-matrix">
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">
                  {copy.agentDetail.kpi}
                </th>
                {GRAINS.map((g) => (
                  <th key={g} scope="col" className="px-2 py-2 text-center capitalize">
                    {g}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-left">
                  {copy.agentDetail.slices}
                </th>
                <th scope="col" className="px-3 py-2 text-left">
                  {copy.agentDetail.depth}
                </th>
              </tr>
            </thead>
            <tbody>
              {agent.kpi_coverage.map((c) => (
                <tr key={c.kpi} className="border-t border-border">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {kpi(c.kpi)?.name ?? c.kpi}
                  </th>
                  {GRAINS.map((g) => (
                    <td key={g} className="px-2 py-1.5 text-center">
                      {c.grains.includes(g) ? <Check aria-label="covered" className="mx-auto size-4 text-certified" /> : <Minus aria-label="not covered" className="mx-auto size-4 text-muted-foreground" />}
                    </td>
                  ))}
                  <td className="px-3 py-1.5">{c.slices.join(', ')}</td>
                  <td className="px-3 py-1.5">{c.depth.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'products' && (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-2 font-semibold">{copy.marketplace.products}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {agent.products.map((b) => (
                <li key={b.id} className="rounded-md border border-border p-2">
                  <Link href={`/${packId}/marketplace/products/${b.id}`} className="font-medium text-primary underline">
                    {pack.products.find((p) => p.id === b.id)?.name ?? b.id}
                  </Link>
                  <p className="font-mono text-xs text-muted-foreground">
                    {copy.agentDetail.columns}: {b.columns === '*' ? '*' : b.columns.join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 font-semibold">{copy.agentDetail.tools}</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {agent.tools.map((x) => (
                <li key={x.tool} className="rounded-md border border-border p-2 font-mono text-xs">
                  {x.tool}
                  {'views' in x ? ` · ${x.views.join(', ')} · ≤ ${x.row_limit} rows` : ''}
                  {'corpora' in x ? ` · ${x.corpora.join(', ')}` : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === 'instructions' && (
        <ul className="flex flex-col gap-3">
          {agent.instructions.map((id) => {
            const ins = pack.instructions.find((i) => i.id === id);
            return (
              <li key={id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold capitalize">
                  {ins?.kind} <span className="font-mono text-xs font-normal text-muted-foreground">{id} · v{ins?.version}</span>
                </p>
                <p className="whitespace-pre-wrap text-muted-foreground">{ins?.text}</p>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'evaluation' && (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground">{copy.agentDetail.evalPending}</p>
          <h2 className="font-semibold">{copy.agentDetail.thresholds}</h2>
          <dl className="grid max-w-md grid-cols-2 gap-y-1">
            {Object.entries(agent.eval).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className={dt}>{k.replace('_min', '').replace(/_/g, ' ')}</dt>
                <dd>≥ {Math.round(v * 100)}%</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {tab === 'release' && (
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className={dt}>{copy.agentDetail.release}</dt>
          <dd>{copy.marketplace.agentStatus[agent.status]} · v1</dd>
        </dl>
      )}

      {tab === 'usage' && (
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className={dt}>{copy.agentDetail.answers}</dt>
          <dd data-testid="agent-answers">{await answeredCount(packId, [agent.id])}</dd>
          <dt className={dt}>{copy.marketplace.costPerAnswer}</dt>
          <dd>≤ ${agent.budgets.cost_per_answer_usd.toFixed(2)}</dd>
          <dt className={dt}>p95 latency</dt>
          <dd>≤ {agent.budgets.p95_latency_ms} ms</dd>
          <dt className={dt}>Tool rounds</dt>
          <dd>≤ {agent.budgets.max_tool_rounds}</dd>
        </dl>
      )}

      {tab === 'try' && (
        <AskConsole
          packId={packId}
          locale={pack.manifest.locale}
          agents={[{ id: agent.id, name: agent.name, capability: agent.capability, status: agent.status, hue: agent.avatar.hue }]}
          agentId={agent.id}
          suggestions={agent.scenarios.map((s) => pack.scenarios.find((x) => x.id === s)?.question ?? '').filter(Boolean).slice(0, 6)}
        />
      )}
    </div>
  );
}
