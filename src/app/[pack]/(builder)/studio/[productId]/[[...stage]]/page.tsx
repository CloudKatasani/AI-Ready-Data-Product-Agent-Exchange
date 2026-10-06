import { AlertTriangle, Download } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentPanel } from '@/components/lifecycle/agent-panel';
import { ArtifactEditor } from '@/components/lifecycle/artifact-editor';
import { AutopilotConsole } from '@/components/lifecycle/autopilot-console';
import { CertChecklist } from '@/components/lifecycle/cert-checklist';
import { GatePanel } from '@/components/lifecycle/gate-panel';
import { StatusChip } from '@/components/marketplace/chips';
import { optionalSegments } from '@/components/shell/route-params';
import { copy } from '@/copy/en';
import { ARTIFACTS } from '@/lib/lifecycle/artifacts/registry';
import { PHASES, stageDef } from '@/lib/lifecycle/stages';
import type { ProductStatus } from '@/lib/marketplace/catalog';
import { getPack, getRubrics } from '@/lib/packs/registry';
import { studioWorkspace } from '@/lib/presenter/studio';
import { cn } from '@/lib/utils';
import { activePersona } from '../../../../_server/session';
import { StudioTools } from '../../_parts/tools';
import { acceptAllFields, applyCertFix, autopilot, decideField, decideGate, evaluateChecks, runAgent, saveArtifact, submitStage } from '../../actions';

const GATE_DOT: Record<string, string> = { APPROVED: 'bg-certified', IN_REVIEW: 'bg-in-certification', STALE: 'bg-degraded', REJECTED: 'bg-fail', PENDING: 'bg-border' };

export default async function StudioWorkspacePage({ params }: { params: Promise<{ pack: string; productId: string; stage?: string[] }> }) {
  const { pack: packId, productId: raw, stage: seg } = await params;
  const { stage: stageText } = optionalSegments(seg, ['stage'] as const);
  const pack = getPack(packId);
  const persona = await activePersona(pack);
  const productId = decodeURIComponent(raw);
  const ws = await studioWorkspace(pack, getRubrics(), productId, stageText ? Number(stageText) : undefined).catch(() => null);
  if (!ws) notFound();
  const def = stageDef(ws.stage);
  const personaNames = Object.fromEntries(pack.personas.map((p) => [p.id, p.name]));
  const fieldKinds = Object.fromEntries(Object.values(ARTIFACTS).flatMap((a) => a.fields.map((f) => [`${a.type}.${f.path}`, f.kind])));
  const base = `/${packId}/studio/${productId}`;
  const canSubmit = ws.stage <= ws.row.stage;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            <Link href={`/${packId}/studio`} className="hover:underline">
              {copy.studio.title}
            </Link>{' '}
            / {ws.product.domain}
          </p>
          <h1 className="text-2xl font-semibold">{ws.product.name}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <StatusChip status={ws.row.status as ProductStatus} />
            <span>
              {ws.product.id} · v{ws.row.version} · {copy.studio.stage} {ws.row.stage}/12
            </span>
          </p>
        </div>
        <nav aria-label={copy.studio.exports} className="flex flex-wrap gap-2 text-sm">
          {[
            ['evidence', copy.studio.evidencePack],
            ['openlineage', copy.studio.openLineage],
            ['audit', copy.studio.auditBundle],
          ].map(([kind, label]) => (
            <a key={kind} href={`/api/export?kind=${kind}&pack=${packId}&product=${productId}`} className="inline-flex min-h-[24px] items-center gap-1 rounded-md border border-border px-2 py-1" data-testid={`export-${kind}`}>
              <Download aria-hidden className="size-3.5" />
              {label}
            </a>
          ))}
          {ws.row.fromPack && (
            <a href={`/api/contract?pack=${packId}&product=${productId}`} className="inline-flex min-h-[24px] items-center gap-1 rounded-md border border-border px-2 py-1">
              <Download aria-hidden className="size-3.5" />
              {copy.studio.contract}
            </a>
          )}
        </nav>
      </header>

      {ws.staleGates.length > 0 && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-degraded bg-surface px-3 py-2 text-sm" data-testid="stale-banner">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 text-degraded" />
          <div>
            <p className="font-semibold">{copy.studio.staleBanner}</p>
            {ws.staleGates.map((g) => (
              <p key={g.stage}>
                <Link href={`${base}/${g.stage}`} className="underline">
                  Gate {g.stage}
                </Link>
                : {g.reason}
              </p>
            ))}
          </div>
        </div>
      )}

      <nav aria-label={copy.studio.stages} className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface p-2" data-testid="stage-nav">
        {PHASES.map((phase) => (
          <div key={phase} className="flex flex-col gap-1">
            <span className="px-1 text-[11px] font-semibold uppercase text-muted-foreground">{phase}</span>
            <div className="flex gap-1">
              {ws.stages
                .filter((s) => s.phase === phase)
                .map((s) => (
                  <Link
                    key={s.n}
                    href={`${base}/${s.n}`}
                    aria-current={s.n === ws.stage ? 'page' : undefined}
                    title={`${s.n}. ${s.name}${s.gate ? ` — ${s.gate}` : ''}`}
                    data-stage={s.n}
                    data-gate={s.gate ?? ''}
                    className={cn('inline-flex min-h-[28px] min-w-[32px] items-center justify-center gap-1 rounded-md border px-2 text-xs', s.n === ws.stage ? 'border-primary font-semibold' : 'border-border', s.n > ws.row.stage && 'opacity-60')}
                  >
                    {s.n}
                    <span aria-hidden className={cn('size-2 rounded-full', GATE_DOT[s.gate ?? ''] ?? 'bg-transparent')} />
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </nav>

      <h2 className="text-lg font-semibold">
        {ws.stage}. {def.name} <span className="text-sm font-normal text-muted-foreground">· {def.phase}</span>
      </h2>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          {ws.stage === 11 && ws.checks && <CertChecklist checks={ws.checks} applyFix={applyCertFix.bind(null, packId, productId)} evaluate={evaluateChecks.bind(null, packId, productId)} />}
          {ws.artifacts.map((a) => (
            <ArtifactEditor key={a.type} def={ARTIFACTS[a.type]} artifact={a} personaNames={personaNames} save={saveArtifact.bind(null, packId, productId, a.type)} />
          ))}
          <StudioTools packId={packId} productId={productId} stage={ws.stage} />
        </div>
        <aside className="flex flex-col gap-4">
          <AgentPanel
            agent={ws.agent}
            proposals={ws.proposals}
            narrative={ws.narrative}
            fieldKinds={fieldKinds}
            run={runAgent.bind(null, packId, productId, ws.stage)}
            decide={decideField.bind(null, packId, productId)}
            acceptAll={acceptAllFields.bind(null, packId, productId, ws.stage)}
          />
          <GatePanel gate={ws.gate} criteria={ws.criteria} canSubmit={canSubmit} myRoles={persona.roles} submit={submitStage.bind(null, packId, productId, ws.stage)} decide={decideGate.bind(null, packId, productId, ws.gate?.id ?? '')} />
          <AutopilotConsole run={ws.autopilot} act={autopilot.bind(null, packId, productId)} />
          {ws.tasks.length > 0 && (
            <section aria-labelledby="tasks-h" className="rounded-lg border border-border bg-surface p-4 text-sm">
              <h2 id="tasks-h" className="mb-2 font-semibold">
                {copy.studio.tasks}
              </h2>
              <ul className="flex flex-col gap-1">
                {ws.tasks.map((t) => (
                  <li key={t.id}>
                    {t.title} <span className="text-muted-foreground">({t.role})</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
