import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ImportProfileForm } from '@/components/presenter/import-form';
import { ProfileForm } from '@/components/presenter/profile-form';
import { Footer } from '@/components/shell/footer';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { copy } from '@/copy/en';
import { anthropicApiKey, getEnv } from '@/lib/config/env';
import { getPack, getStories, hasPack, listPackIds } from '@/lib/packs/registry';
import type { Pack } from '@/lib/packs/schema';
import { DEFAULT_BRAND } from '@/lib/presenter/branding';
import { defaultProfileInput, getProfile, listProfiles, overridableTerms } from '@/lib/presenter/profiles';
import { PROFILE_COOKIE, verifyProfile } from '@/lib/presenter/session';
import { archiveAction, duplicateAction, importAction, launchAction, saveProfileAction } from './actions';

export const dynamic = 'force-dynamic';

const c = copy.presenter.profile;

/** Demo launcher (01 §M1): industry cards, profile setup, saved profiles, import/export. Kiosk-locked profiles skip it. */
export default async function LaunchPage({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const sp = await searchParams;
  const active = await getProfile(verifyProfile((await cookies()).get(PROFILE_COOKIE)?.value, getEnv().SESSION_SECRET));
  if (active?.locked && !active.archived) redirect(`/${active.packId}/home`);
  const packs = listPackIds().flatMap((id): Pack[] => {
    try {
      return [getPack(id)];
    } catch {
      return [];
    }
  });
  const setup = sp.pack && hasPack(sp.pack) ? getPack(sp.pack) : null;
  const profiles = await listProfiles();
  const stories = getStories().map((s) => ({ id: s.id, title: s.title, minutes: s.minutes }));
  const name = (packId: string) => packs.find((p) => p.manifest.id === packId)?.manifest.company.name ?? packId;
  return (
    <div className="grid min-h-screen grid-rows-[1fr_auto]">
      <main id="main" className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-12">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{DEFAULT_BRAND.productName}</p>
          <h1 className="text-3xl font-semibold">{copy.launcher.title}</h1>
          <p className="text-muted-foreground">{copy.launcher.subtitle}</p>
        </header>

        {profiles.length > 0 && (
          <section aria-labelledby="saved-h" className="flex flex-col gap-3">
            <h2 id="saved-h" className="text-xl font-semibold">{c.saved}</h2>
            <ul className="flex flex-col gap-2" data-testid="saved-profiles">
              {profiles.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3" data-profile={p.id} data-profile-name={p.name}>
                  <span aria-hidden className="size-6 rounded" style={{ background: p.brand.primary }} />
                  <span className="flex-1">
                    <span className="font-medium">{p.name}</span>{' '}
                    <span className="text-sm text-muted-foreground">
                      · {name(p.packId)} · {stories.find((s) => s.id === p.storyId)?.title ?? copy.presenter.freeRoam} · {c.lastUsed} {p.lastUsedAt?.slice(0, 10) ?? c.never}
                    </span>
                  </span>
                  <form action={launchAction.bind(null, p.id)}>
                    <button type="submit" className={buttonVariants({ size: 'sm' })} data-testid="launch-profile">
                      {c.launch}
                    </button>
                  </form>
                  <form action={duplicateAction.bind(null, p.id)}>
                    <button type="submit" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                      {c.duplicate}
                    </button>
                  </form>
                  <a href={`/api/profile/${p.id}`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                    {c.export}
                  </a>
                  <form action={archiveAction.bind(null, p.id)}>
                    <button type="submit" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
                      {c.archive}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {setup && (
          <section aria-labelledby="setup-h" className="flex flex-col gap-3" id="setup">
            <h2 id="setup-h" className="text-xl font-semibold">
              {c.setup} — {setup.manifest.company.name}
            </h2>
            <ProfileForm
              action={saveProfileAction}
              packId={setup.manifest.id}
              defaults={(() => {
                const d = defaultProfileInput(setup.manifest.id);
                return { name: d.name, companyName: d.brand.companyName, productName: d.brand.productName, primary: d.brand.primary, accent: d.brand.accent };
              })()}
              terms={overridableTerms(setup.manifest.id)}
              stories={stories}
              liveAvailable={Boolean(anthropicApiKey())}
            />
          </section>
        )}

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
                  <CardContent className="mt-auto flex flex-col gap-2">
                    <span className="text-sm text-muted-foreground">
                      {p.products.length} {copy.launcher.products} · {p.agents.length} {copy.launcher.agents} · {p.kpis.length} {copy.launcher.kpis}
                    </span>
                    <div className="flex gap-2">
                      <Link href={`/launch?pack=${p.manifest.id}#setup`} className={buttonVariants({ size: 'sm' })} data-testid={`setup-${p.manifest.id}`}>
                        {c.setup}
                      </Link>
                      <Link href={`/${p.manifest.id}/home`} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                        {copy.launcher.open}
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <ImportProfileForm action={importAction} />
      </main>
      <Footer />
    </div>
  );
}
