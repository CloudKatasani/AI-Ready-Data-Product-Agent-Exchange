import Link from 'next/link';
import { copy } from '@/copy/en';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-3 p-12">
      <h1 className="text-2xl font-semibold">{copy.errors.notFoundTitle}</h1>
      <p className="text-muted-foreground">{copy.errors.notFoundBody}</p>
      <Link href="/launch" className="text-primary underline">
        {copy.errors.backToLauncher}
      </Link>
    </main>
  );
}
