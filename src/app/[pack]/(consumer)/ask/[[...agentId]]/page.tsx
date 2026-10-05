import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function AskPage({ params }: { params: Promise<{ pack: string; agentId?: string[] }> }) {
  const { agentId } = await params;
  return <StubPage navId="ask" params={{ ...optionalSegments(agentId, ['agentId'] as const) }} />;
}
