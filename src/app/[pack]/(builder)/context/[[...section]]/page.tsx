import { TriangleAlert } from 'lucide-react';
import { LinkTabs } from '@/components/explorer/tabs';
import { optionalSegments } from '@/components/shell/route-params';
import { Badge } from '@/components/ui/badge';
import { copy } from '@/copy/en';
import { searchDocuments } from '@/lib/packs/doc-search';
import { getPack } from '@/lib/packs/registry';

const SECTIONS = ['instructions', 'rules', 'verified', 'synonyms', 'documents'] as const;
type Section = (typeof SECTIONS)[number];
const th = 'px-2 py-2 text-left font-semibold';
const td = 'px-2 py-1.5 align-top';

function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-in-certification/20 px-0.5 text-foreground">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export default async function ContextPage({ params, searchParams }: { params: Promise<{ pack: string; section?: string[] }>; searchParams: Promise<{ q?: string }> }) {
  const { pack: packId, section: seg } = await params;
  const { q = '' } = await searchParams;
  const { section: raw } = optionalSegments(seg, ['section'] as const);
  const section: Section = (SECTIONS as readonly string[]).includes(raw ?? '') ? (raw as Section) : 'instructions';
  const pack = getPack(packId);
  const agentName = (id: string) => pack.agents.find((a) => a.id === id)?.name ?? id;
  const hits = section === 'documents' ? searchDocuments(pack, q, 8) : [];

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{copy.context.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{copy.context.intro}</p>
      </header>
      <LinkTabs label="Context" active={section} tabs={SECTIONS.map((s) => ({ id: s, label: copy.context.tabs[s], href: `/${packId}/context/${s}` }))} />

      {section === 'instructions' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Id', copy.context.agent, copy.context.kind, copy.context.version, ''].map((h, i) => (
                <th key={i} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pack.instructions.map((i) => (
              <tr key={i.id} className="border-b border-border">
                <td className={`${td} font-mono`}>{i.id}</td>
                <td className={td}>{agentName(i.agent)}</td>
                <td className={td}>{i.kind}</td>
                <td className={td}>v{i.version}</td>
                <td className={td}>{i.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {section === 'rules' && (
        <table className="w-full text-sm" data-testid="rules">
          <thead>
            <tr className="border-b border-border">
              {[copy.context.rule, copy.context.kind, '', copy.context.applies, copy.context.source].map((h, i) => (
                <th key={i} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pack.rules.map((r) => (
              <tr key={r.id} id={r.id} className="border-b border-border">
                <td className={`${td} font-mono`}>{r.id}</td>
                <td className={td}>{r.kind}</td>
                <td className={td}>{r.text}</td>
                <td className={`${td} font-mono text-xs`}>{r.apply ? `${r.apply.filter.dimension} ${r.apply.filter.op} ${JSON.stringify(r.apply.filter.value)}` : ''}</td>
                <td className={td}>
                  <a className="text-primary underline" href={`/${packId}/context/documents?q=${encodeURIComponent(r.text.split(' ').slice(0, 4).join(' '))}`}>{r.source_doc}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {section === 'verified' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Id', '', 'View', 'Status'].map((h, i) => (
                <th key={i} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pack.verifiedQueries.map((v) => (
              <tr key={v.id} className="border-b border-border">
                <td className={`${td} font-mono`}>{v.id}</td>
                <td className={td}>{v.question}</td>
                <td className={`${td} font-mono`}><a className="text-primary underline" href={`/${packId}/semantic/${v.query.view}?tab=verified`}>{v.query.view}</a></td>
                <td className={td}>{v.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {section === 'synonyms' && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {[copy.context.term, copy.context.synonyms, copy.context.mapsTo].map((h) => (
                <th key={h} scope="col" className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pack.synonyms.map((s) => (
              <tr key={s.term} className="border-b border-border">
                <td className={td}>{s.term}</td>
                <td className={td}>{s.synonyms.join(', ')}</td>
                <td className={`${td} font-mono text-xs`}>{s.maps_to.kind}: {s.maps_to.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {section === 'documents' && (
        <div className="flex flex-col gap-4">
          <form method="get" className="flex items-end gap-2">
            <label className="flex flex-col gap-1 text-sm">
              {copy.context.searchDocs}
              <input name="q" defaultValue={q} className="w-96 rounded-md border border-border bg-surface px-2 py-1.5" data-testid="doc-search" />
            </label>
            <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">{copy.context.search}</button>
          </form>
          {q ? (
            hits.length === 0 ? (
              <p className="text-muted-foreground">{copy.context.noHits}</p>
            ) : (
              <ol className="flex flex-col gap-3" data-testid="doc-hits">
                {hits.map((h) => (
                  <li key={`${h.docId}#${h.chunk}`} className="rounded-md border border-border bg-surface p-3 text-sm">
                    <p className="mb-1 font-semibold">
                      {h.title} <span className="font-mono text-xs text-muted-foreground">{h.docId}#{h.chunk} · {h.score}</span>
                    </p>
                    <p className="whitespace-pre-line"><Highlight text={h.text} terms={h.terms} /></p>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {pack.docs.map((d) => (
                <li key={d.meta.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                  <p className="font-semibold">{d.meta.title}</p>
                  <p className="font-mono text-xs text-muted-foreground">{d.meta.id} · v{d.meta.version} · {d.meta.effective}</p>
                  {d.meta.contains_injection && (
                    <Badge variant="outline" className="mt-2 border-degraded text-degraded">
                      <TriangleAlert aria-hidden className="size-3" /> {copy.context.injection}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
