import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { optionalSegments } from '@/components/shell/route-params';
import { Badge } from '@/components/ui/badge';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';

const th = 'px-2 py-2 text-left font-semibold';

export default async function GlossaryPage({ params, searchParams }: { params: Promise<{ pack: string; term?: string[] }>; searchParams: Promise<{ q?: string }> }) {
  const { pack: packId, term: seg } = await params;
  const { q = '' } = await searchParams;
  const { term: termId } = optionalSegments(seg, ['term'] as const);
  const pack = getPack(packId);
  const person = (id: string) => pack.personas.find((p) => p.id === id)?.name ?? id;

  if (!termId) {
    const needle = q.toLowerCase();
    const terms = pack.glossary.filter((t) => !needle || [t.name, t.definition, ...t.synonyms].some((x) => x.toLowerCase().includes(needle)));
    return (
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="text-2xl font-semibold">{copy.glossary.title}</h1>
          <p className="max-w-3xl text-muted-foreground">{copy.glossary.intro}</p>
        </header>
        <form method="get" className="flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            {copy.glossary.search}
            <input name="q" defaultValue={q} className="rounded-md border border-border bg-surface px-2 py-1.5" />
          </label>
        </form>
        <table className="w-full text-sm" data-testid="glossary">
          <thead>
            <tr className="border-b border-border">
              {[copy.glossary.term, copy.glossary.definition, copy.glossary.status, copy.glossary.cde, copy.glossary.owner].map((h) => (
                <th key={h} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {terms.map((t) => (
              <tr key={t.id} className="border-b border-border">
                <td className="px-2 py-1.5"><Link className="font-medium text-primary underline" href={`/${packId}/glossary/${t.id}`}>{t.name}</Link></td>
                <td className="px-2 py-1.5">{t.definition}</td>
                <td className="px-2 py-1.5">{t.status}</td>
                <td className="px-2 py-1.5">{t.cde ? 'CDE' : ''}</td>
                <td className="px-2 py-1.5">{person(t.owner)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const t = pack.glossary.find((x) => x.id === termId);
  if (!t) notFound();
  const metrics = [...new Set([...t.mappings.metrics, ...pack.semantic.flatMap((v) => v.metrics.filter((m) => m.term === t.id).map((m) => m.name))])];
  const views = pack.semantic.filter((v) => v.metrics.some((m) => metrics.includes(m.name)));
  const products = pack.products.filter((p) => views.some((v) => v.products.includes(p.id)) || p.upstream.some((u) => t.mappings.columns.some((c) => c.startsWith(`${u}.`))));
  const agents = pack.agents.filter((a) => a.products.some((p) => products.some((x) => x.id === p.id)));
  const dq = pack.dq.filter((d) => t.mappings.columns.includes(`${d.object}.${d.column}`));
  const strip: [string, { key: string; label: string; href?: string }[]][] = [
    [copy.glossary.columns, t.mappings.columns.map((c) => ({ key: c, label: c, href: `/${packId}/explorer/${c.split('.').slice(0, 2).join('/')}?tab=columns` }))],
    [copy.glossary.metrics, metrics.map((m) => ({ key: m, label: m, href: `/${packId}/semantic/${pack.semantic.find((v) => v.metrics.some((x) => x.name === m))?.name}?tab=playground&metric=${m}` }))],
    [copy.glossary.products, products.map((p) => ({ key: p.id, label: `${p.id} ${p.name}`, href: `/${packId}/marketplace/products/${p.id}` }))],
    [copy.glossary.agents, agents.map((a) => ({ key: a.id, label: a.name, href: `/${packId}/marketplace/agents/${a.id}` }))],
  ];
  return (
    <div className="flex max-w-5xl flex-col gap-6" data-testid="term">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-sm text-muted-foreground">{t.id}</p>
        <h1 className="text-2xl font-semibold">{t.name}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t.status}</Badge>
          {t.cde && <Badge variant="outline">{copy.glossary.cde}</Badge>}
          <Badge variant="muted">{t.domain}</Badge>
        </div>
      </header>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        <dt className="text-muted-foreground">{copy.glossary.definition}</dt>
        <dd>{t.definition}</dd>
        {t.formula && (
          <>
            <dt className="text-muted-foreground">{copy.glossary.formula}</dt>
            <dd className="font-mono">{t.formula}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{copy.glossary.owner}</dt>
        <dd>{person(t.owner)}</dd>
        <dt className="text-muted-foreground">{copy.glossary.steward}</dt>
        <dd>{person(t.steward)}</dd>
        <dt className="text-muted-foreground">{copy.glossary.synonyms}</dt>
        <dd>{t.synonyms.join(', ') || '—'}</dd>
      </dl>
      <section>
        <h2 className="mb-3 font-semibold">{copy.glossary.mappings}</h2>
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {strip.map(([label, items], i) => (
            <li key={label} className="relative rounded-md border border-border bg-surface p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {items.map((x) => (
                  <li key={x.key}>{x.href ? <Link className="inline-block min-h-[24px] break-all py-0.5 text-primary underline" href={x.href}>{x.label}</Link> : x.label}</li>
                ))}
              </ul>
              {i < strip.length - 1 && <ArrowRight aria-hidden className="absolute -right-3 top-1/2 hidden size-4 text-muted-foreground md:block" />}
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h2 className="mb-2 font-semibold">{copy.glossary.dq}</h2>
        {dq.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.glossary.noDq}</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {dq.map((d) => (
              <li key={d.id}>
                <span className="font-mono">{d.id}</span> · {d.dimension} · <span className="font-mono">{d.assertion}</span> — {d.description}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
