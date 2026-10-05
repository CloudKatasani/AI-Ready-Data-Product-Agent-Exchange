import Link from 'next/link';
import { Footer } from '@/components/shell/footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { copy } from '@/copy/en';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';

/** Placeholder pack id for browsing the shell before any pack is installed (Phase 0 only). */
const EMPTY_SHELL_PACK = 'sample';

export default function LaunchPage() {
  return (
    <div className="grid min-h-screen grid-rows-[1fr_auto]">
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{DEFAULT_BRAND.productName}</p>
          <h1 className="text-3xl font-semibold">{copy.launcher.title}</h1>
          <p className="text-muted-foreground">{copy.launcher.subtitle}</p>
        </header>
        <Card data-testid="launcher-empty">
          <CardHeader>
            <CardTitle>{copy.launcher.noPacks}</CardTitle>
            <CardDescription>{copy.launcher.noPacksHint}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/${EMPTY_SHELL_PACK}/home`} className={buttonVariants()}>
              {copy.launcher.openShell}
            </Link>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
