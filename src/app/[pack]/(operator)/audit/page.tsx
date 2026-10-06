import { LinkTabs } from '@/components/explorer/tabs';
import { LineageGraph } from '@/components/graph/lineage-graph';
import { copy } from '@/copy/en';
import { estateLineage } from '@/lib/packs/lineage';
import { getPack } from '@/lib/packs/registry';
import { type AuditFilter, auditStream } from '@/lib/presenter/operate';

const c = copy.operate.audit;
type SP = { tab?: string; actor?: string; subject?: string };
const ACTORS = ['HUMAN', 'AGENT', 'SYSTEM'] as const;

export default async function AuditPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<SP> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const tab = sp.tab === 'lineage' ? 'lineage' : 'stream';
  const filter: AuditFilter = { ...(ACTORS.find((a) => a === sp.actor) ? { actorType: sp.actor as AuditFilter['actorType'] } : {}), ...(sp.subject ? { subjectType: sp.subject } : {}) };
  const s = tab === 'stream' ? await auditStream(packId, filter).catch(() => null) : null;
  const subjects = s ? [...new Set(s.events.map((e) => e.subjectType))].sort() : [];
  const lineage = tab === 'lineage' ? estateLineage(pack) : null;
  const who = (id: string) => pack.personas.find((p) => p.id === id)?.name ?? pack.agents.find((a) => a.id === id)?.name ?? id;
  const field = 'h-9 rounded-md border border-border bg-surface px-2';
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.title}</h1>
          <p className="text-muted-foreground">{c.intro}</p>
        </div>
        <a href={`/api/export?pack=${packId}&kind=audit`} className="ml-auto h-9 rounded-md border border-border px-3 py-2 text-sm" data-testid="audit-export">
          {c.export}
        </a>
      </header>
      <LinkTabs label={c.title} active={tab} tabs={[{ id: 'stream', label: c.tabs.stream, href: `/${packId}/audit` }, { id: 'lineage', label: c.tabs.lineage, href: `/${packId}/audit?tab=lineage` }]} />
      {s && (
        <>
          <p role="status" data-testid="audit-chain" data-ok={s.chain.ok} className={s.chain.ok ? 'text-certified' : 'font-medium text-fail'}>
            {s.chain.ok ? c.chainOk(s.chain.events) : c.chainBroken(s.chain.brokenAt ?? '')}
          </p>
          <form method="get" className="flex flex-wrap items-end gap-3" aria-label={c.filter}>
            <label className="flex flex-col gap-1 text-sm">
              {c.actorType}
              <select name="actor" defaultValue={filter.actorType ?? ''} className={field}>
                <option value="">{c.all}</option>
                {ACTORS.map((a) => (
                  <option key={a} value={a}>
                    {a.toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {c.subject}
              <select name="subject" defaultValue={filter.subjectType ?? ''} className={field}>
                <option value="">{c.all}</option>
                {subjects.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-9 rounded-md border border-border px-3 text-sm">
              {c.filter}
            </button>
          </form>
          <p className="text-sm text-muted-foreground">{c.showing(s.events.length, s.total)}</p>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm" data-testid="audit-stream">
              <caption className="sr-only">{c.tabs.stream}</caption>
              <thead className="bg-muted text-left">
                <tr>
                  <th scope="col" className="px-3 py-2">{c.when}</th>
                  <th scope="col" className="px-3 py-2">{c.actor}</th>
                  <th scope="col" className="px-3 py-2">{c.action}</th>
                  <th scope="col" className="px-3 py-2">{c.subject}</th>
                  <th scope="col" className="px-3 py-2">hash</th>
                </tr>
              </thead>
              <tbody>
                {s.events.map((e) => (
                  <tr key={e.id} className="border-t border-border" data-actor-type={e.actorType}>
                    <td className="px-3 py-1.5 whitespace-nowrap tabular-nums">{e.at.slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-3 py-1.5">
                      <span className={e.actorType === 'AGENT' ? 'text-agent' : ''}>{e.actorType.toLowerCase()}</span> · {who(e.actorId)}
                    </td>
                    <td className="px-3 py-1.5">{e.action}</td>
                    <td className="px-3 py-1.5">
                      {e.subjectType} {e.subjectId}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs">{e.hash.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {lineage && <LineageGraph nodes={lineage.nodes.map((n) => ({ id: n.id, label: n.label, layer: n.layer }))} edges={lineage.edges} height={640} />}
    </div>
  );
}
