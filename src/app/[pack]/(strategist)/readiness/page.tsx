import Link from 'next/link';
import { ReadinessRadar } from '@/components/charts/radar-chart';
import { copy } from '@/copy/en';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { assessments } from '@/lib/presenter/strategy';
import { bandOf, DEMO_COMPANY_ANSWERS, DIMENSIONS, dimScore, overallScore, PRESETS, QUESTIONS, questionText, rankGaps } from '@/lib/strategy/readiness';
import { saveAssessmentAction } from '../actions';

const c = copy.strategy.readiness;
type SP = Record<string, string | string[] | undefined>;

export default async function ReadinessPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const rubrics = getRubrics();
  const preset = PRESETS.find((p) => p.id === sp.preset);
  const answers: Record<string, number> = { ...(preset?.answers ?? {}) };
  for (const q of QUESTIONS) {
    const v = Number(sp[q.id]);
    if (Number.isInteger(v) && v >= 1 && v <= 5) answers[q.id] = v;
  }
  const overall = overallScore(answers);
  const gaps = rankGaps(rubrics, answers);
  const saved = await assessments(packId);
  const query = QUESTIONS.filter((q) => answers[q.id]).map((q) => `${q.id}=${answers[q.id]}`).join('&');
  const labels = pack.readiness ?? { preset_labels: {} as Record<string, string>, question_overrides: [] };
  const radar = DIMENSIONS.map((d) => ({ label: d.label, assessed: dimScore(d.id, answers) ?? 0, estate: dimScore(d.id, DEMO_COMPANY_ANSWERS) ?? 0 }));
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <nav aria-label={c.presets} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{c.presets}:</span>
        {PRESETS.map((p) => (
          <Link key={p.id} href={`/${packId}/readiness?preset=${p.id}`} className={`rounded-full border px-3 py-1 ${preset?.id === p.id ? 'border-primary font-semibold' : 'border-border'}`} data-preset={p.id}>
            {labels.preset_labels[p.id] ?? p.label}
          </Link>
        ))}
      </nav>
      <section aria-label={c.score} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-2">
          <p className="text-4xl font-semibold tabular-nums" data-testid="readiness-overall" data-score={overall ?? ''}>
            {overall === undefined ? '—' : overall.toFixed(1)} <span className="text-lg font-normal text-muted-foreground">/ 5 · {overall === undefined ? c.unanswered : bandOf(rubrics, overall)}</span>
          </p>
          <table className="w-full text-sm">
            <caption className="sr-only">{c.radar}</caption>
            <thead className="text-left text-muted-foreground">
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">{c.score}</th>
                <th scope="col">{c.target}</th>
              </tr>
            </thead>
            <tbody>
              {DIMENSIONS.map((d) => (
                <tr key={d.id} className="border-t border-border" data-dim={d.id}>
                  <th scope="row" className="py-1 text-left font-normal">{d.label}</th>
                  <td className="tabular-nums">{dimScore(d.id, answers)?.toFixed(1) ?? '—'}</td>
                  <td className="tabular-nums">{rubrics.readiness.target.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ReadinessRadar data={radar} series={[{ key: 'assessed', name: c.score }, { key: 'estate', name: pack.manifest.company.short, dashed: true }]} label={c.radar} />
      </section>
      {gaps.length > 0 && (
        <section aria-labelledby="gaps-h" className="rounded-lg border border-border bg-surface p-4">
          <h2 id="gaps-h" className="font-semibold">{c.gaps}</h2>
          <ol className="mt-2 flex flex-col gap-2 text-sm" data-testid="readiness-gaps">
            {gaps.map((g) => (
              <li key={g.dim} data-gap={g.dim}>
                <span className="font-medium">{g.label}</span> — {g.score.toFixed(1)} → {g.target.toFixed(1)} (gap {g.gap.toFixed(1)}, weighted {g.weighted.toFixed(1)}): {g.actions.join('; ')}.
              </li>
            ))}
          </ol>
          <Link href={`/${packId}/roadmap?${query}`} className="mt-3 inline-block text-sm font-medium underline" data-testid="readiness-roadmap">
            {c.roadmap}
          </Link>
        </section>
      )}
      <form method="get" className="flex flex-col gap-4" aria-label={c.title} data-testid="readiness-form">
        {DIMENSIONS.map((d) => (
          <fieldset key={d.id} className="rounded-lg border border-border p-3">
            <legend className="px-1 font-semibold">{d.label}</legend>
            {QUESTIONS.filter((q) => q.dim === d.id).map((q) => (
              <fieldset key={q.id} className="mt-2">
                <legend className="text-sm font-medium">
                  {q.id}. {questionText(q, labels.question_overrides)}
                </legend>
                <div className="mt-1 grid gap-1 sm:grid-cols-5">
                  {q.levels.map((l, i) => (
                    <label key={l} className="flex items-start gap-1.5 rounded-md border border-border p-2 text-xs">
                      <input type="radio" name={q.id} value={i + 1} defaultChecked={answers[q.id] === i + 1} />
                      <span>
                        <span className="font-semibold">{i + 1}</span> {l}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </fieldset>
        ))}
        <button type="submit" className="h-10 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="readiness-score">
          {c.calculate}
        </button>
      </form>
      <form action={saveAssessmentAction.bind(null, packId)} className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3">
        {QUESTIONS.filter((q) => answers[q.id]).map((q) => (
          <input key={q.id} type="hidden" name={q.id} value={answers[q.id]} />
        ))}
        <label className="flex flex-col gap-1 text-sm">
          {c.name}
          <input name="name" required maxLength={80} className="h-9 rounded-md border border-border bg-surface px-2" />
        </label>
        <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm font-medium" data-testid="readiness-save">
          {c.save}
        </button>
      </form>
      <section aria-labelledby="saved-h">
        <h2 id="saved-h" className="font-semibold">{c.saved}</h2>
        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{c.noneSaved}</p>
        ) : (
          <ul className="text-sm" data-testid="readiness-saved">
            {saved.map((s) => (
              <li key={s.id}>
                <Link href={`/${packId}/readiness?${Object.entries(s.answers).map(([k, v]) => `${k}=${v}`).join('&')}`} className="underline">
                  {s.name}
                </Link>{' '}
                — {s.scores.overall ?? '—'} · {s.band} · {s.at.slice(0, 10)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
