import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LinkTabs } from '@/components/explorer/tabs';
import { ModelDiagram } from '@/components/semantic/model-diagram';
import { optionalSegments } from '@/components/shell/route-params';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { semanticViewYaml } from '@/lib/standards/semantic-view-yaml';
import { activePrincipal } from '../../../_server/session';
import { erDiagram } from '../_parts/model';
import { Playground, type PlaygroundParams } from '../_parts/playground';

const TABS = ['model', 'metrics', 'verified', 'yaml', 'playground'] as const;
type Tab = (typeof TABS)[number];
const th = 'px-2 py-2 text-left font-semibold';
const td = 'px-2 py-1.5 align-top';

export default async function SemanticPage({ params, searchParams }: { params: Promise<{ pack: string; view?: string[] }>; searchParams: Promise<PlaygroundParams & { tab?: string }> }) {
  const { pack: packId, view: seg } = await params;
  const sp = await searchParams;
  const { view: viewName } = optionalSegments(seg, ['view'] as const);
  const pack = getPack(packId);

  if (!viewName) {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold">{copy.semantic.title}</h1>
          <p className="max-w-3xl text-muted-foreground">{copy.semantic.intro}</p>
        </header>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pack.semantic.map((v) => (
            <li key={v.name}>
              <Link href={`/${packId}/semantic/${v.name}`} className="block h-full">
                <Card className="h-full hover:border-primary">
                  <CardHeader>
                    <CardTitle className="font-mono text-base">{v.name}</CardTitle>
                    <CardDescription>{v.description}</CardDescription>
                    <p className="text-sm text-muted-foreground">
                      {v.metrics.length} {copy.semantic.metrics} · {v.products.join(', ')}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const view = pack.semantic.find((v) => v.name === viewName);
  if (!view) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : sp.metric ? 'playground' : 'model';
  const vqs = pack.verifiedQueries.filter((q) => q.query.view === view.name);
  const who = tab === 'playground' ? await activePrincipal(pack) : null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-mono text-sm text-muted-foreground">{pack.manifest.database}.SEMANTIC</p>
        <h1 className="font-mono text-2xl font-semibold">{view.name}</h1>
        <p className="text-muted-foreground">{view.description}</p>
        <p className="text-sm">
          {copy.semantic.products}:{' '}
          {view.products.map((p) => (
            <Badge key={p} variant="outline" className="mr-1">
              {p} · {pack.products.find((x) => x.id === p)?.name}
            </Badge>
          ))}
        </p>
      </header>
      <LinkTabs label="Semantic view" active={tab} tabs={TABS.map((t) => ({ id: t, label: copy.semantic.tabs[t], href: `/${packId}/semantic/${view.name}?tab=${t}` }))} />

      {tab === 'model' && (
        <div className="flex flex-col gap-6">
          <ModelDiagram source={erDiagram(view)} label={`${view.name} logical model`} />
          <section>
            <h2 className="mb-2 font-semibold">{copy.semantic.dimensions}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className={th}>{copy.semantic.name}</th>
                  <th scope="col" className={th}>{copy.semantic.expression}</th>
                  <th scope="col" className={th}>{copy.semantic.synonyms}</th>
                  <th scope="col" className={th}>{copy.semantic.term}</th>
                </tr>
              </thead>
              <tbody>
                {[...view.dimensions, ...view.time_dimensions.map((t) => ({ ...t, synonyms: [] as string[], term: undefined, label: `${t.name} (time)` }))].map((d) => (
                  <tr key={d.name} className="border-b border-border">
                    <td className={`${td} font-mono`}>{d.name}</td>
                    <td className={`${td} font-mono text-muted-foreground`}>{d.expr}</td>
                    <td className={td}>{d.synonyms.join(', ')}</td>
                    <td className={td}>{d.term && <Link className="text-primary underline" href={`/${packId}/glossary/${d.term}`}>{d.term}</Link>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === 'metrics' && (
        <table className="w-full text-sm" data-testid="metrics">
          <thead>
            <tr className="border-b border-border">
              {[copy.semantic.name, copy.semantic.expression, copy.semantic.unit, copy.semantic.synonyms, copy.semantic.term, copy.semantic.rules].map((h) => (
                <th key={h} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.metrics.map((m) => (
              <tr key={m.name} className="border-b border-border">
                <td className={td}>
                  <Link className="font-medium text-primary underline" href={`/${packId}/semantic/${view.name}?tab=playground&metric=${m.name}`}>{m.label}</Link>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </td>
                <td className={`${td} font-mono text-xs`}>{m.expr}</td>
                <td className={td}>{m.unit}</td>
                <td className={td}>{m.synonyms.join(', ')}</td>
                <td className={td}><Link className="text-primary underline" href={`/${packId}/glossary/${m.term}`}>{m.term}</Link></td>
                <td className={td}>{m.default_filters.map((f) => f.rule).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'verified' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Id', copy.semantic.question, copy.semantic.metric, copy.semantic.status, copy.semantic.verifiedBy].map((h) => (
                <th key={h} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vqs.map((q) => (
              <tr key={q.id} className="border-b border-border">
                <td className={`${td} font-mono`}>{q.id}</td>
                <td className={td}>{q.question}</td>
                <td className={`${td} font-mono text-xs`}>{q.query.metrics.join(', ')}{q.query.dimensions?.length ? ` by ${q.query.dimensions.join(', ')}` : ''}</td>
                <td className={td}>{q.status}</td>
                <td className={td}>{pack.personas.find((p) => p.id === q.verified_by)?.name ?? q.verified_by} · {q.verified_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'yaml' && <CodeBlock code={semanticViewYaml(pack, view)} lang="yaml" label={`${view.name} semantic view YAML`} />}

      {tab === 'playground' && who && <Playground pack={pack} view={view} params={sp} who={who} />}
    </div>
  );
}
