import Link from 'next/link';
import { Footer } from '@/components/shell/footer';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { copy } from '@/copy/en';
import { getPack, listPackIds } from '@/lib/packs/registry';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';

export const dynamic = 'force-dynamic';

/** Phase 2 launcher: pack cards. Profile setup, branding and stories arrive in Phase 9. */
export default function LaunchPage() {
  const packs = listPackIds().map((id) => getPack(id));
  return (
    <div className="grid min-h-screen grid-rows-[1fr_auto]">
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{DEFAULT_BRAND.productName}</p>
          <h1 className="text-3xl font-semibold">{copy.launcher.title}</h1>
          <p className="text-muted-foreground">{copy.launcher.subtitle}</p>
        </header>
        {packs.length === 0 ? (
          <Card data-testid="launcher-empty">
            <CardHeader>
              <CardTitle>{copy.launcher.noPacks}</CardTitle>
              <CardDescription>{copy.launcher.noPacksHint}</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {packs.map((p) => (
              <li key={p.manifest.id}>
                <Card data-pack={p.manifest.id} className="flex h-full flex-col">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle>{p.manifest.company.name}</CardTitle>
                      <Badge variant="muted">{copy.launcher.depth[p.manifest.depth]}</Badge>
                    </div>
                    <CardDescription>
                      {p.manifest.name} · {p.manifest.hook}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      {p.products.length} {copy.launcher.products} · {p.agents.length} {copy.launcher.agents} · {p.kpis.length} {copy.launcher.kpis}
                    </span>
                    <Link href={`/${p.manifest.id}/home`} className={buttonVariants({ size: 'sm' })}>
                      {copy.launcher.open}
                    </Link>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
