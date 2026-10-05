import { StubPage } from '@/components/shell/stub-page';
import { optionalSegments } from '@/components/shell/route-params';

export default async function GlossaryPage({ params }: { params: Promise<{ pack: string; term?: string[] }> }) {
  const { term } = await params;
  return <StubPage navId="glossary" params={{ ...optionalSegments(term, ['term'] as const) }} />;
}
