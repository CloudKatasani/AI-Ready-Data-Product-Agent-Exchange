import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function HealthPage({ params }: { params: Promise<{ pack: string; tab?: string[] }> }) {
  const { tab } = await params;
  return <StubPage navId="health" params={{ ...optionalSegments(tab, ['tab'] as const) }} />;
}
