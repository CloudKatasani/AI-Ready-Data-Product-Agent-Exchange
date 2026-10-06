import { notFound } from 'next/navigation';
import { LinkTabs } from '@/components/explorer/tabs';
import { ActionButton } from '@/components/operate/action-button';
import { SynonymFixForm } from '@/components/operate/fix-form';
import { optionalSegments } from '@/components/shell/route-params';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { feedbackInbox, scorecards } from '@/lib/presenter/operate';
import { applyFixAction, dismissFeedbackAction, runEvalAction } from '../../actions';

const c = copy.operate.quality;

export default async function AgentQualityPage({ params }: { params: Promise<{ pack: string; tab?: string[] }> }) {
  const { pack: packId, tab: segs } = await params;
  const { tab = 'scorecards' } = optionalSegments(segs, ['tab'] as const);
  if (tab !== 'scorecards' && tab !== 'feedback') notFound();
  const pack = getPack(packId);
  const [cards, inbox] = await Promise.all([tab === 'scorecards' ? scorecards(packId).catch(() => []) : Promise.resolve([]), feedbackInbox(packId).catch(() => [])]);
  const open = inbox.filter((f) => f.state === 'NEW');
  const agentName = (id: string) => pack.agents.find((a) => a.id === id)?.name ?? id;
  const metricsFor = (agentId: string) => {
    const a = pack.agents.find((x) => x.id === agentId);
    return (a?.kpi_coverage ?? []).flatMap((cov) => {
      const k = pack.kpis.find((x) => x.id === cov.kpi);
      const m = pack.semantic.flatMap((v) => v.metrics).find((x) => x.name === k?.metric);
      return m ? [{ name: m.name, label: m.label }] : [];
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <LinkTabs label={c.title} active={tab} tabs={[{ id: 'scorecards', label: c.tabs.scorecards, href: `/${packId}/agent-quality` }, { id: 'feedback', label: `${c.tabs.feedback} (${open.length})`, href: `/${packId}/agent-quality/feedback` }]} />

      {tab === 'scorecards' && (
        <ul className="grid gap-3 lg:grid-cols-2" data-testid="scorecards">
          {cards.map((s) => (
            <li key={s.agentId} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-agent={s.agentId}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-semibold">{s.name}</h2>
                <span className="text-xs text-muted-foreground">
                  {s.agentId} · {s.status.toLowerCase()}
                </span>
                <span className="ml-auto text-2xl font-semibold tabular-nums" data-testid={`quality-${s.agentId}`} data-score={s.scorePct ?? ''}>
                  {s.scorePct === null ? c.noEval : `${s.scorePct}%`}
                </span>
              </div>
              {s.hasScriptedFix && <p className="text-xs text-muted-foreground">{c.calibrated}</p>}
              {Object.keys(s.suites).length > 0 && (
                <ul className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(s.suites).map(([k, v]) => (
                    <li key={k} className="rounded-full border border-border px-2 py-0.5" data-suite={k} data-passed={v.passed}>
                      {k}: {v.score === null ? 'n/a' : `${Math.round(v.score * 100)}%`} {v.passed ? '✓' : '✗'}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                {c.harness}: {s.harnessPct === null ? '—' : `${s.harnessPct}%`} · {c.runs}: {s.history.length} · {c.fixes}: {s.fixes.map((f) => `${f.fixType.toLowerCase()} ${f.before}%→${f.after}%`).join(', ') || '—'}
              </p>
              <ActionButton action={runEvalAction.bind(null, packId, s.agentId)} label={c.runEval} testId={`run-eval-${s.agentId}`} />
            </li>
          ))}
        </ul>
      )}

      {tab === 'feedback' && (
        <section className="flex flex-col gap-3" data-testid="feedback-inbox">
          {inbox.length === 0 && <p className="text-muted-foreground">{c.inboxEmpty}</p>}
          {inbox.map((f) => {
            const scripted = pack.agents.find((a) => a.id === f.agentId)?.quality_fix;
            return (
              <article key={f.id} className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4" data-feedback={f.id} data-state={f.state}>
                <p className="font-medium">“{f.question}”</p>
                <p className="text-sm text-muted-foreground">
                  {agentName(f.agentId)} · {pack.personas.find((p) => p.id === f.personaId)?.name ?? f.personaId} · {c.state}: {f.state.toLowerCase()}
                  {f.reason ? ` · ${c.reason}: ${f.reason}` : ''}
                </p>
                {f.fix && (
                  <p className="text-sm font-medium text-certified" data-testid="fix-delta">
                    {c.fixed(f.fix.before, f.fix.after)}
                  </p>
                )}
                {f.state === 'NEW' && (
                  <div className="flex flex-col gap-3">
                    {scripted && scripted.feedback_question === f.question && (
                      <div className="flex flex-col gap-1">
                        <p className="text-sm">
                          {scripted.fix.type.replace('_', ' ')}: <code>{JSON.stringify(scripted.fix.payload)}</code>
                        </p>
                        <ActionButton action={applyFixAction.bind(null, packId, f.agentId, f.id, null)} label={c.applyScripted} testId="apply-scripted-fix" tone="primary" />
                      </div>
                    )}
                    <SynonymFixForm action={applyFixAction.bind(null, packId, f.agentId, f.id)} metrics={metricsFor(f.agentId)} testId={`synonym-fix-${f.id}`} />
                    <ActionButton action={dismissFeedbackAction.bind(null, packId, f.id)} label={c.dismiss} testId={`dismiss-${f.id}`} />
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
