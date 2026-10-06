import Link from 'next/link';
import { FlowReplay } from '@/components/strategy/flow-replay';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { flowPath, platformLayers } from '@/lib/strategy/platform';

const c = copy.strategy.platform;

export default async function PlatformMapPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<{ replay?: string }> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  const pack = getPack(packId);
  const layers = platformLayers(pack);
  const path = flowPath(pack);
  const hero = pack.manifest.home.heroAgent;
  const guided = [`explorer`, `semantic`, `marketplace`, `ask/${hero}`, `health`];
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <FlowReplay steps={path} label={c.flow} replayLabel={c.replay} autoplay={sp.replay === '1'} />
      <nav aria-label={c.path} className="rounded-lg border border-border bg-surface p-3">
        <h2 className="text-sm font-semibold">{c.path}</h2>
        <ol className="mt-1 flex flex-wrap gap-3 text-sm">
          {guided.map((route, i) => (
            <li key={route}>
              {i + 1}.{' '}
              <Link href={`/${packId}/${route}`} className="underline">
                {c.steps[i]}
              </Link>
            </li>
          ))}
        </ol>
      </nav>
      <ol className="flex flex-col-reverse gap-2" data-testid="platform-layers">
        {layers.map((l) => (
          <li key={l.layer} data-layer={l.layer}>
            <details className="rounded-lg border border-border bg-surface p-3">
              <summary className="cursor-pointer">
                <span className="font-semibold">{l.label}</span> <span className="text-sm text-muted-foreground">· {l.count}</span>
                <span className="block text-sm text-muted-foreground">{l.purpose}</span>
              </summary>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <h3 className="text-sm font-semibold">{c.holds}</h3>
                  <ul className="text-sm">
                    {l.items.map((i) => (
                      <li key={i.id} className="truncate" title={i.label}>
                        {i.label}
                      </li>
                    ))}
                    {l.count > l.items.length && <li className="text-muted-foreground">{c.more(l.count - l.items.length)}</li>}
                  </ul>
                </div>
                <div>
                  <h3 className="text-sm font-semibold">{c.breaks}</h3>
                  {l.breaks.length ? (
                    <ul className="list-disc pl-5 text-sm">
                      {l.breaks.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">{c.nothing}</p>
                  )}
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
