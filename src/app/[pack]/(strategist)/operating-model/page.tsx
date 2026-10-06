import Link from 'next/link';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { raciFor, type RaciStyle, ROLES, STYLES } from '@/lib/strategy/raci';

const c = copy.strategy.operating;

export default async function OperatingModelPage({ params, searchParams }: { params: Promise<{ pack: string }>; searchParams: Promise<{ style?: string }> }) {
  const { pack: packId } = await params;
  const sp = await searchParams;
  getPack(packId);
  const style: RaciStyle = STYLES.find((s) => s.id === sp.style)?.id ?? 'hub';
  const rows = raciFor(style);
  const current = STYLES.find((s) => s.id === style);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{c.title}</h1>
        <p className="text-muted-foreground">{c.intro}</p>
      </header>
      <nav aria-label={c.style} className="flex flex-wrap gap-2 text-sm">
        {STYLES.map((s) => (
          <Link key={s.id} href={`/${packId}/operating-model?style=${s.id}`} aria-current={s.id === style ? 'page' : undefined} className={`rounded-full border px-3 py-1 ${s.id === style ? 'border-primary font-semibold' : 'border-border'}`} data-style={s.id}>
            {s.label}
          </Link>
        ))}
      </nav>
      <p className="text-sm">{current?.when}</p>
      <p className="text-xs text-muted-foreground">{c.legend}</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs" data-testid="raci" data-style={style}>
          <caption className="sr-only">
            {c.title} — {current?.label}
          </caption>
          <thead className="bg-muted text-left">
            <tr>
              <th scope="col" className="px-2 py-2">{c.activity}</th>
              {ROLES.map((r) => (
                <th key={r.id} scope="col" className="px-2 py-2 font-medium">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, layer, route, cells]) => (
              <tr key={name} className="border-t border-border">
                <th scope="row" className="px-2 py-1.5 text-left font-normal">
                  <Link href={`/${packId}/${route}`} className="underline">
                    {name}
                  </Link>{' '}
                  <span className="text-muted-foreground">({layer})</span>
                </th>
                {ROLES.map((r) => (
                  <td key={r.id} className={`px-2 py-1.5 text-center ${cells[r.id]?.includes('A') ? 'font-bold' : ''}`}>
                    {cells[r.id] || '·'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby="roles-h">
        <h2 id="roles-h" className="font-semibold">{c.roles}</h2>
        <ul className="mt-2 grid gap-2 text-sm md:grid-cols-3">
          {ROLES.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2">
              <span className="font-medium">{r.label}</span> <span className="text-xs text-muted-foreground">({r.team})</span>
              <p className="text-xs">{r.accountable}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
