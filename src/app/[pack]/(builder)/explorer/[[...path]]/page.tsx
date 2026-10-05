import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function ExplorerPage({ params }: { params: Promise<{ pack: string; path?: string[] }> }) {
  const { path } = await params;
  return <StubPage navId="explorer" params={{ ...optionalSegments(path, ['schema', 'object'] as const) }} />;
}
