import Link from 'next/link';
import { IntakeWizard } from '@/components/lifecycle/intake-wizard';
import { copy } from '@/copy/en';
import { db } from '@/lib/db';
import { getPack } from '@/lib/packs/registry';
import { checkDuplicates, submitRequest } from '../actions';

export default async function RequestNewPage({ params }: { params: Promise<{ pack: string }> }) {
  const { pack: packId } = await params;
  getPack(packId);
  const requests = await db().productRequest.findMany({ where: { packId }, orderBy: { createdAt: 'desc' } }).catch(() => []);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-2xl font-semibold">{copy.intake.title}</h1>
          <p className="text-muted-foreground">{copy.intake.intro}</p>
        </header>
        <IntakeWizard packId={packId} check={checkDuplicates.bind(null, packId)} submit={submitRequest.bind(null, packId)} />
      </div>
      <section aria-labelledby="reqs-h" className="flex flex-col gap-2">
        <h2 id="reqs-h" className="text-lg font-semibold">
          {copy.intake.requests}
        </h2>
        <ul className="flex flex-col gap-2 text-sm" data-testid="request-list">
          {requests.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2">
              <Link href={`/${packId}/request/${r.id}`} className="font-medium text-primary underline">
                {r.reference} · {r.title}
              </Link>
              <span className="block text-xs text-muted-foreground">{copy.intake.states[r.state as keyof typeof copy.intake.states] ?? r.state}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
