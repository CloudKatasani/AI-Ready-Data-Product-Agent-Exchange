import { StubPage } from '@/components/shell/stub-page';
import { copy } from '@/copy/en';

export default async function FactoryPageDetail({ params }: { params: Promise<{ pack: string; draftId: string }> }) {
  const { draftId } = await params;
  return <StubPage navId="factory" title={copy.navDetail.factoryDraft} params={{ draftId: decodeURIComponent(draftId) }} />;
}
