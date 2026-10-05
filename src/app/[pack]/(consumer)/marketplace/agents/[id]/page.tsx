import { StubPage } from '@/components/shell/stub-page';
import { copy } from '@/copy/en';

export default async function MarketplacePageDetail({ params }: { params: Promise<{ pack: string; id: string }> }) {
  const { id } = await params;
  return <StubPage navId="marketplace" title={copy.navDetail.agentDetail} params={{ id: decodeURIComponent(id) }} />;
}
