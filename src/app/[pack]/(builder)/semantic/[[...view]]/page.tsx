import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function SemanticPage({ params }: { params: Promise<{ pack: string; view?: string[] }> }) {
  const { view } = await params;
  return <StubPage navId="semantic" params={{ ...optionalSegments(view, ['view'] as const) }} />;
}
