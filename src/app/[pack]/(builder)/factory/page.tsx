import { Bot } from 'lucide-react';
import Link from 'next/link';
import { copy } from '@/copy/en';
import { db } from '@/lib/db';
import { getPack } from '@/lib/packs/registry';
import { newAgent } from './actions';

export default async function FactoryPage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  getPack(packId);
  const agents = await db().agent.findMany({ where: { packId, fromPack: false }, orderBy: { id: 'asc' } }).catch(() => []);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{copy.factory.title}</h1>
          <p className="text-muted-foreground">{copy.factory.intro}</p>
        </div>
        <form action={newAgent.bind(null, packId)} className="ml-auto">
          <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" data-testid="new-agent">
            {copy.factory.newAgent}
          </button>
        </form>
      </header>
      {agents.length === 0 ? (
        <p className="text-muted-foreground">{copy.factory.noAgents}</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="factory-agents">
          {agents.map((a) => (
            <li key={a.id}>
              <Link href={`/${packId}/factory/${a.id}`} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-primary" data-agent={a.id}>
                <Bot aria-hidden className="size-6 text-agent" />
                <span>
                  <span className="block font-semibold">{a.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {a.id} · {a.status.toLowerCase()} · v{a.currentVersion}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
