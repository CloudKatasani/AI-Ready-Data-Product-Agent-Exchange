import { notFound } from 'next/navigation';
import { copy } from '@/copy/en';
import { getPack } from '@/lib/packs/registry';
import { resolveStory } from '@/lib/presenter/stories';

const c = copy.presenter.printPage;

/** Printable cue cards for one story (09 §3 leave-behind; print to PDF from the browser). */
export default async function StoryPrintPage({ params }: { params: Promise<{ pack: string; storyId: string }> }) {
  const { pack: packId, storyId } = await params;
  const pack = getPack(packId);
  const story = resolveStory(pack, storyId);
  if (!story) notFound();
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4" data-testid="story-print">
      <header>
        <h1 className="text-2xl font-semibold">
          {story.title} — {c.title}
        </h1>
        <p className="text-muted-foreground">
          {pack.manifest.company.name} · {story.minutes}′ · {story.audience.join(', ')}
        </p>
      </header>
      <ol className="flex flex-col gap-3">
        {story.steps.map((s, i) => (
          <li key={s.id} className="break-inside-avoid rounded-lg border border-border bg-surface p-4" data-step={s.id}>
            <h2 className="font-semibold">
              {c.step} {i + 1}. {s.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {c.persona}: {pack.personas.find((p) => p.id === s.personaId)?.name} · {c.route}: {s.href}
            </p>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {s.do.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm italic">“{s.say}”</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
