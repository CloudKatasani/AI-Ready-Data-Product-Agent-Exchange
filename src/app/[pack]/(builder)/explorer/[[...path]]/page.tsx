import { notFound } from 'next/navigation';
import { ObjectTree } from '@/components/explorer/object-tree';
import { LinkTabs } from '@/components/explorer/tabs';
import { Worksheet } from '@/components/explorer/worksheet';
import { optionalSegments } from '@/components/shell/route-params';
import { CodeBlock } from '@/components/ui/code-block';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { describeObject, warehouseCatalog } from '@/lib/presenter/governed';
import { renderDdl } from '@/lib/standards/ddl';
import { activePrincipal } from '../../../_server/session';
import { ColumnsPanel } from '../_panels/columns';
import { GovernancePanel } from '../_panels/governance';
import { LineagePanel } from '../_panels/lineage';
import { PreviewPanel } from '../_panels/preview';
import { QualityPanel } from '../_panels/quality';
import { runWorksheet } from '../actions';

const TABS = ['preview', 'columns', 'ddl', 'lineage', 'quality', 'governance'] as const;
type Tab = (typeof TABS)[number];

export default async function ExplorerPage({ params, searchParams }: { params: Promise<{ pack: string; path?: string[] }>; searchParams: Promise<{ tab?: string }> }) {
  const { pack: packId, path } = await params;
  const { tab: tabParam } = await searchParams;
  const { schema, object } = optionalSegments(path, ['schema', 'object'] as const);
  const pack = getPack(packId);
  const catalog = await warehouseCatalog(packId);
  const worksheet = schema === 'worksheet' && !object;
  const fqn = schema && object ? `${schema}.${object}` : null;
  if (fqn && !catalog.some((o) => `${o.schema}.${o.name}` === fqn)) notFound();
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? '') ? (tabParam as Tab) : 'preview';
  const who = await activePrincipal(pack);

  const presets = [
    ...pack.sources.slice(0, 1).map((s) => ({ label: 'Bronze CDC rows', sql: `SELECT _op, _loaded_at, *\nFROM RAW_BRONZE.${s.name}\nWHERE _op <> 'I'\nLIMIT 20` })),
    ...pack.semantic.slice(0, 1).map((v) => ({ label: `${v.name} base view`, sql: `SELECT *\nFROM SEMANTIC.${v.name}\nLIMIT 20` })),
    ...pack.objects.filter((o) => o.fqn.startsWith('CURATED_SILVER.')).slice(0, 1).map((o) => ({ label: 'Silver sample', sql: `SELECT *\nFROM ${o.fqn}\nLIMIT 20` })),
  ];

  return (
    <div className="grid grid-cols-[18rem_1fr] gap-6">
      <aside className="max-h-[calc(100vh-9rem)] overflow-y-auto rounded-md border border-border bg-surface p-2">
        <ObjectTree pack={packId} database={pack.manifest.database} objects={catalog} active={{ schema, object }} />
      </aside>
      <section className="flex min-w-0 flex-col gap-4">
        {worksheet ? (
          <>
            <h1 className="text-2xl font-semibold">{copy.explorer.worksheet}</h1>
            <Worksheet pack={packId} presets={presets} locale={pack.manifest.locale} run={runWorksheet} />
          </>
        ) : fqn ? (
          <>
            <header>
              <p className="font-mono text-sm text-muted-foreground">{pack.manifest.database}.{schema}</p>
              <h1 className="font-mono text-2xl font-semibold">{object}</h1>
              <p className="text-sm text-muted-foreground">{pack.objects.find((o) => o.fqn === fqn)?.description ?? pack.sources.find((s) => `RAW_BRONZE.${s.name}` === fqn)?.description ?? ''}</p>
            </header>
            <LinkTabs label="Object" active={tab} tabs={TABS.map((t) => ({ id: t, label: copy.explorer.tabs[t], href: `/${packId}/explorer/${schema}/${object}?tab=${t}` }))} />
            {tab === 'preview' && <PreviewPanel pack={pack} fqn={fqn} who={who} />}
            {tab === 'columns' && <ColumnsPanel pack={pack} fqn={fqn} who={who} />}
            {tab === 'ddl' && <CodeBlock code={renderDdl(pack, fqn, await describeObject(packId, fqn))} label="DDL" />}
            {tab === 'lineage' && <LineagePanel pack={pack} fqn={fqn} />}
            {tab === 'quality' && <QualityPanel pack={pack} fqn={fqn} />}
            {tab === 'governance' && <GovernancePanel pack={pack} fqn={fqn} />}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">{copy.explorer.title}</h1>
            <p className="max-w-3xl text-muted-foreground">{copy.explorer.intro}</p>
          </>
        )}
      </section>
    </div>
  );
}
