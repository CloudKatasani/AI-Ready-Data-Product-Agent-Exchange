import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FactoryWizard } from '@/components/factory/factory-wizard';
import { copy } from '@/copy/en';
import type { EvalReport } from '@/lib/agents/eval';
import { db } from '@/lib/db';
import { getPack } from '@/lib/packs/registry';
import { latestEval, loadDraft } from '@/lib/presenter/factory';
import { policyState } from '@/lib/presenter/governed';
import { design, evaluate, gate, release, save } from '../actions';

export default async function FactoryDraftPage({ params }: { params: Promise<{ pack: string; draftId: string }> }) {
  const { pack: packId, draftId } = await params;
  const pack = getPack(packId);
  const id = decodeURIComponent(draftId);
  const draft = await loadDraft(packId, id);
  if (!draft) notFound();
  const state = await policyState(packId);
  const ev = await latestEval(id);
  const gateRun = await db().publishGateRun.findFirst({ where: { agentId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }).catch(() => null);
  const suites = ev ? Object.entries(JSON.parse(ev.suitesJson) as EvalReport['suites']).map(([suite, v]) => ({ suite, ...v })) : null;
  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-sm text-muted-foreground">
          <Link href={`/${packId}/factory`} className="hover:underline">
            {copy.factory.title}
          </Link>{' '}
          / {id}
        </p>
        <h1 className="text-2xl font-semibold">{draft.agent.manifest.name}</h1>
        <p className="text-sm text-muted-foreground">
          {copy.factory.status}: {draft.status.toLowerCase()} · {copy.factory.version} {draft.version}
        </p>
      </header>
      <FactoryWizard
        packId={packId}
        agentId={id}
        initial={draft.agent}
        status={draft.status}
        version={draft.version}
        products={pack.products.map((p) => ({ id: p.id, name: p.name, certified: (state.products?.[p.id]?.status ?? p.initial_status) === 'CERTIFIED' }))}
        kpis={pack.kpis.map((k) => ({ id: k.id, name: k.name, products: k.products }))}
        suites={suites}
        failing={(ev?.cases ?? []).filter((c) => !c.pass).map((c) => ({ suite: c.suite, question: c.question, reason: c.reason }))}
        checks={gateRun ? JSON.parse(gateRun.resultsJson) : null}
        save={save.bind(null, packId, id)}
        design={design.bind(null, packId, id)}
        evaluate={evaluate.bind(null, packId, id)}
        gate={gate.bind(null, packId, id)}
        release={release.bind(null, packId, id)}
      />
    </div>
  );
}
