import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function ContextPage({ params }: { params: Promise<{ pack: string; section?: string[] }> }) {
  const { section } = await params;
  return <StubPage navId="context" params={{ ...optionalSegments(section, ['section'] as const) }} />;
}
