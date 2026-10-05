import { StubPage } from '@/components/shell/stub-page';
import { copy } from '@/copy/en';
import { optionalSegments } from '@/components/shell/route-params';

export default async function StudioWorkspacePage({ params }: { params: Promise<{ pack: string; productId: string; stage?: string[] }> }) {
  const { productId, stage } = await params;
  return <StubPage navId="studio" title={copy.navDetail.studioWorkspace} params={{ productId: decodeURIComponent(productId), ...optionalSegments(stage, ['stage'] as const) }} />;
}
