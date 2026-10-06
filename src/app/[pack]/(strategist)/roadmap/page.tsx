import Link from 'next/link';
import { copy } from '@/copy/en';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { assessments } from '@/lib/presenter/strategy';
import { PRESETS, QUESTIONS, rankGaps } from '@/lib/strategy/readiness';
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
