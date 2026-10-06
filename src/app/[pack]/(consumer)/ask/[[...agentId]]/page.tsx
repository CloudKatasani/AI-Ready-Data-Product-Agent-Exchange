import { notFound } from 'next/navigation';
import { AskConsole } from '@/components/answer/ask-console';
import { optionalSegments } from '@/components/shell/route-params';
import { copy } from '@/copy/en';
import { getEnv, hasApiKey } from '@/lib/config/env';
import { livePack } from '@/lib/presenter/factory';

export default async function AskPage({ params, searchParams }: { params: Promise<{ pack: string; agentId?: string[] }>; searchParams: Promise<{ q?: string }> }) {
  const { pack: packId, agentId: seg } = await params;
  const { q } = await searchParams;
  const { agentId } = optionalSegments(seg, ['agentId'] as const);
  const pack = await livePack(packId);
  const agent = agentId ? pack.agents.find((a) => a.id === agentId) : undefined;
  if (agentId && !agent) notFound();

  const question = (id: string) => pack.scenarios.find((s) => s.id === id)?.question;
  const suggestions = agent
    ? agent.scenarios.map(question).filter((s): s is string => Boolean(s)).slice(0, 8)
    : [pack.manifest.home.heroQuestion, ...pack.agents.map((a) => (a.scenarios[0] ? question(a.scenarios[0]) : undefined)).filter((s): s is string => Boolean(s))].slice(0, 8);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{agent ? agent.name : copy.ask.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{agent ? agent.capability : copy.ask.intro}</p>
      </header>
      <AskConsole
        key={agentId ?? 'router'}
        packId={packId}
        locale={pack.manifest.locale}
        agents={pack.agents.map((a) => ({ id: a.id, name: a.name, capability: a.capability, status: a.status, hue: a.avatar.hue }))}
        agentId={agent?.id}
        suggestions={[...new Set(suggestions)]}
        initialQuestion={q?.slice(0, 500)}
        defaultMode={getEnv().AGENT_MODE_DEFAULT}
        liveAvailable={hasApiKey()}
      />
    </div>
  );
}
