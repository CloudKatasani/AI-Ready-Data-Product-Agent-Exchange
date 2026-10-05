import { StubPage } from '@/components/shell/stub-page';
import { copy } from '@/copy/en';

export default async function RequestPageDetail({ params }: { params: Promise<{ pack: string; id: string }> }) {
  const { id } = await params;
  return <StubPage navId="request" title={copy.navDetail.requestDetail} params={{ id: decodeURIComponent(id) }} />;
}
