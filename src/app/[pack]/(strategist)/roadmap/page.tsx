import Link from 'next/link';
import { copy } from '@/copy/en';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { assessments } from '@/lib/presenter/strategy';
import { coverage, LEVELS, levelHistogram, simulate } from '@/lib/strategy/coverage';
import { PRESETS, QUESTIONS, rankGaps } from '@/lib/strategy/readiness';
import { db } from '@/lib/db';
import { layout, phaseFromGaps, weekToDate, WORKSTREAMS } from '@/lib/strategy/roadmap';

const c = copy.strategy.roadmap;
type SP = Record<string, string | string[] | undefined>;

export default async function RoadmapPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const fromQuery: Record<string, number> = {};
  for (const q of QUESTIONS) {
    const v = Number(sp[q.id]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) fromQuery[q.id] = v;
  }
  const asked = PRESETS.find((p) => p.id === sp.preset);
  if (asked && !Object.keys(fromQuery).length) Object.assign(fromQuery, asked.answers);
  const saved = Object.keys(fromQuery).length ? null : ((await assessments(packId))[0] ?? null);
  const preset = PRESETS.find((p) => p.id === 'mid');
  const answers = Object.keys(fromQuery).length ? fromQuery : (saved?.answers ?? preset?.answers ?? {});
  const source = Object.keys(fromQuery).length ? copy.strategy.readiness.title : saved ? saved.name : (pack.readiness?.preset_labels.mid ?? preset?.label ?? '');
  const gaps = rankGaps(getRubrics(), answers);
  const { phase: current, highlight } = phaseFromGaps(gaps.map((g) => g.dim));
  const phases = layout();
  const total = phases.reduce((n, p) => Math.max(n, p.start + p.length), 0);
  const start = pack.manifest.asOf;
  const pct = (w: number) => `${(w / total) * 100}%`;
  const live = new Map((await db().dataProduct.findMany({ where: { packId }, select: { id: true, status: true } }).catch(() => [])).map((p) => [p.id, p.status]));
  const now = coverage(pack, (id) => live.get(id) ?? pack.products.find((p) => p.id === id)?.initial_status ?? 'DRAFT');
  const weeks = Math.max(0, Math.min(52, Number(sp.simulate) || 0));
  const sim = simulate(now, weeks, current);
  const hist = levelHistogram(sim.rows);
  const view = sp.view === 'coverage' ? 'coverage' : 'plan';
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
        <p className="text-sm">
          {c.source}: <span className="font-medium">{source}</span> · {c.start} {start} ·{' '}
          <Link href={`/${packId}/readiness`} className="underline">
            {copy.strategy.readiness.title}
          </Link>
        </p>
      </header>
      <nav aria-label={c.title} className="flex gap-2 text-sm">
        {(['plan', 'coverage'] as const).map((v) => (
          <Link key={v} href={`/${packId}/roadmap?${v === 'coverage' ? 'view=coverage' : ''}`} aria-current={v === view ? 'page' : undefined} className={`rounded-full border px-3 py-0.5 ${v === view ? 'border-primary font-semibold' : 'border-border'}`}>
            {v === 'plan' ? c.planView : c.coverageView}
          </Link>
        ))}
      </nav>
      {view === 'coverage' && (
        <section aria-labelledby="cov-h" className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4" data-testid="coverage" data-weeks={weeks} data-phase={sim.phase}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="cov-h" className="font-semibold">{c.coverageView}</h2>
            <Link href={`/${packId}/roadmap?view=coverage&simulate=${weeks + 4}`} className="h-8 rounded-md border border-border px-3 py-1.5 text-sm font-medium" data-testid="simulate">
              {c.simulate}
            </Link>
            {weeks > 0 && (
              <span className="text-sm text-muted-foreground">
                +{weeks} {c.weeks} → {c.phaseLabel} {sim.phase}
              </span>
            )}
          </div>
          <ol className="grid grid-cols-7 gap-1 text-center text-xs" data-testid="coverage-histogram">
            {LEVELS.map((l) => (
              <li key={l.n} className="rounded-md border border-border p-2" data-level={l.n} data-count={hist[l.n]} title={l.rule}>
                <span className="block text-lg font-semibold tabular-nums">{hist[l.n]}</span>
                {l.n}. {l.name}
              </li>
            ))}
          </ol>
          <table className="w-full text-sm">
            <caption className="sr-only">{c.coverageView}</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col">{c.sourceTable}</th>
                <th scope="col">{c.level}</th>
                <th scope="col">{c.blocker}</th>
              </tr>
            </thead>
            <tbody>
              {sim.rows.map((r) => (
                <tr key={r.id} className="border-t border-border" data-source={r.id} data-level={r.levelNow}>
                  <th scope="row" className="py-1 text-left font-normal">
                    {r.id.split('.')[1]} <span className="text-xs text-muted-foreground">{r.system}</span>
                  </th>
                  <td>
                    {r.levelNow}. {LEVELS[r.levelNow]?.name}
                  </td>
                  <td className="text-muted-foreground">{r.blocker ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section aria-label={c.title} className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-3" data-testid="roadmap-gantt" data-current={current}>
        {phases.map((p) => (
          <div key={p.id} className="grid grid-cols-[10rem_1fr] items-center gap-2 text-sm" data-phase={p.id} data-highlight={highlight.includes(p.id)}>
            <span className={p.id === current ? 'font-semibold' : ''}>
              {p.id}. {p.name}
            </span>
            <div className="relative h-7 rounded bg-muted">
              <div
                className={`absolute top-0 h-7 rounded px-2 text-xs leading-7 ${highlight.includes(p.id) ? 'bg-primary text-primary-foreground' : 'bg-border text-foreground'}`}
                style={{ left: pct(p.start), width: pct(p.length) }}
                title={`${weekToDate(start, p.start)} → ${weekToDate(start, p.start + p.length)}`}
              >
                {p.length} {c.weeks}
                {p.id === current ? ` · ${c.youAreHere}` : ''}
              </div>
            </div>
          </div>
        ))}
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        {phases.map((p) => (
          <article key={p.id} className={`flex flex-col gap-2 rounded-lg border p-4 ${p.id === current ? 'border-primary' : 'border-border'} bg-surface`}>
            <h2 className="font-semibold">
              {p.id}. {p.name} <span className="text-sm font-normal text-muted-foreground">— {p.goal}</span>
            </h2>
            <p className="text-sm">
              <span className="font-medium">{c.gate}:</span> {p.gate.label}
              {p.gate.proofRoute && (
                <>
                  {' '}
                  ·{' '}
                  <Link href={`/${packId}/${p.gate.proofRoute}`} className="underline">
                    {c.proof}
                  </Link>
                </>
              )}
            </p>
            <p className="text-sm">
              <span className="font-medium">{c.deliverables}:</span> {p.deliverables.join(', ')}
            </p>
            <ul className="text-sm">
              {WORKSTREAMS.filter((w) => p.activities[w.id]).map((w) => (
                <li key={w.id}>
                  <span className="text-muted-foreground">{w.label}:</span> {p.activities[w.id]}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {c.risks}: {p.risks.join('; ')}. {c.roles}: {p.roles.join(', ')}.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
