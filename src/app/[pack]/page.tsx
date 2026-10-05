import { redirect } from 'next/navigation';

export default async function PackIndex({ params }: { params: Promise<{ pack: string }> }): Promise<never> {
  const { pack } = await params;
  redirect(`/${encodeURIComponent(pack)}/home`);
}
