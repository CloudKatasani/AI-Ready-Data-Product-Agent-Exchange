/**
 * Server-side Product Studio loaders: board (all products by phase) and a product workspace (stages,
 * gates with decisions, artifacts with provenance, proposals, exit criteria, certification checks,
 * autopilot, tasks). Reads the app DB; criteria facts use the governed warehouse path.
 */
import { db } from '@/lib/db';
import { agentForStage } from '@/lib/agents/lifecycle-agents/registry';
import { exitCriteria, type Criterion } from '@/lib/lifecycle/criteria';
import { gatherCriteriaFacts, latestChecks, latestVersions } from '@/lib/lifecycle/engine';
import { productModel } from '@/lib/lifecycle/product-model';
import { type ArtifactType, STAGES, stageDef } from '@/lib/lifecycle/stages';
import type { CheckResult } from '@/lib/lifecycle/certification';
import type { Pack, Rubrics } from '@/lib/packs/schema';
import { governedService } from './governed';

export interface BoardCard {
  id: string;
  name: string;
  domain: string;
  status: string;
  stage: number;
  phase: string;
  version: string;
  gateState: string | null;
  openProposals: number;
  stale: number;
  owner: string;
  fromPack: boolean;
}

export async function studioBoard(pack: Pack): Promise<BoardCard[]> {
  const prisma = db();
  const rows = await prisma.dataProduct.findMany({ where: { packId: pack.manifest.id }, orderBy: { id: 'asc' } });
  const gates = await prisma.gate.findMany({ where: { productId: { in: rows.map((r) => r.id) } } });
  const proposals = await prisma.agentProposal.groupBy({ by: ['productId'], where: { productId: { in: rows.map((r) => r.id) }, state: 'OPEN' }, _count: { _all: true } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    status: r.status,
    stage: r.currentStage,
    phase: stageDef(r.currentStage).phase,
    version: r.semanticVersion,
    gateState: gates.find((g) => g.productId === r.id && g.stage === r.currentStage)?.state ?? null,
    openProposals: proposals.find((p) => p.productId === r.id)?._count._all ?? 0,
    stale: gates.filter((g) => g.productId === r.id && g.state === 'STALE').length,
    owner: pack.personas.find((p) => p.id === r.ownerPersonaId)?.name ?? r.ownerPersonaId,
    fromPack: r.fromPack,
  }));
}

export interface FieldValue {
  path: string;
  value: unknown;
  source: 'HUMAN' | 'AGENT' | null;
  agentId: string | null;
  acceptedBy: string | null;
}

export interface ArtifactView {
  type: ArtifactType;
  version: number | null;
  hash: string | null;
  committedBy: string | null;
  fields: FieldValue[];
}

export interface GateView {
  id: string;
  stage: number;
  state: string;
  quorum: number;
  roles: string[];
  veto: string[];
  staleReason: string | null;
  decisions: { personaId: string; name: string; role: string; outcome: string; rationale: string; at: string }[];
  evidence: { type: string; hash: string }[];
}

export interface Workspace {
  product: ReturnType<typeof productModel>;
  row: { status: string; stage: number; version: string; fromPack: boolean; isCertDemo: boolean };
  stage: number;
  stages: { n: number; name: string; phase: string; gate: string | null; run: string | null }[];
  artifacts: ArtifactView[];
  proposals: { id: string; artifactType: string; fieldPath: string; value: unknown; rationale: string; agentId: string }[];
  criteria: Criterion[];
  gate: GateView | null;
  staleGates: { stage: number; reason: string | null }[];
  checks: CheckResult[] | null;
  agent: { id: string; name: string; charter: string } | null;
  autopilot: { id: string; state: string; steps: { stage: number; kind: string; text: string }[] } | null;
  tasks: { id: string; title: string; role: string }[];
  narrative: string | null;
}

export async function studioWorkspace(pack: Pack, rubrics: Rubrics, productId: string, stageParam?: number): Promise<Workspace | null> {
  const prisma = db();
  const row = await prisma.dataProduct.findUnique({ where: { id: productId } });
  if (!row || row.packId !== pack.manifest.id) return null;
  const product = productModel(pack, row);
  const stage = stageParam && stageParam >= 1 && stageParam <= 12 ? stageParam : row.currentStage;
  const [runs, gates, latest, proposals, run, tasks] = await Promise.all([
    prisma.stageRun.findMany({ where: { productId } }),
    prisma.gate.findMany({ where: { productId }, include: { evidence: true } }),
    latestVersions(prisma, productId),
    prisma.agentProposal.findMany({ where: { productId, stage, state: 'OPEN' }, orderBy: { createdAt: 'asc' } }),
    prisma.autopilotRun.findFirst({ where: { productId }, orderBy: { createdAt: 'desc' } }),
    prisma.task.findMany({ where: { productId, state: 'OPEN' } }),
  ]);
  const versionIds = stageDef(stage).artifacts.flatMap((t) => (latest.get(t) ? [latest.get(t)?.versionId ?? ''] : []));
  const prov = await prisma.fieldProvenance.findMany({ where: { versionId: { in: versionIds } } });
  const artifacts: ArtifactView[] = stageDef(stage).artifacts.map((t) => {
    const v = latest.get(t);
    const fieldsProv = prov.filter((p) => p.versionId === v?.versionId);
    return {
      type: t,
      version: v?.version ?? null,
      hash: v?.hash ?? null,
      committedBy: v?.committedBy ?? null,
      fields: Object.keys(v?.content ?? {}).map((path) => {
        const p = fieldsProv.find((x) => x.fieldPath === path);
        return { path, value: v?.content[path], source: (p?.source as FieldValue['source']) ?? null, agentId: p?.agentId ?? null, acceptedBy: p?.acceptedBy ?? null };
      }),
    };
  });
  const actions = await prisma.agentAction.findMany({ where: { id: { in: [...new Set(proposals.map((p) => p.actionId))] } } });
  const lastAction = await prisma.agentAction.findFirst({ where: { productId, stage }, orderBy: { createdAt: 'desc' } });
  const g = gates.find((x) => x.stage === stage) ?? null;
  const decisions = g ? await prisma.decision.findMany({ where: { subjectType: 'GATE', subjectId: g.id }, orderBy: { createdAt: 'asc' } }) : [];
  let criteria: Criterion[] = [];
  if (stageDef(stage).gate) {
    try {
      criteria = exitCriteria(stage, rubrics, await gatherCriteriaFacts(prisma, pack, rubrics, productId, stage, { qs: await governedService(pack.manifest.id) }));
    } catch {
      criteria = exitCriteria(stage, rubrics, await gatherCriteriaFacts(prisma, pack, rubrics, productId, stage, { offline: true }));
    }
  }
  const agent = agentForStage(stage);
  return {
    product,
    row: { status: row.status, stage: row.currentStage, version: row.semanticVersion, fromPack: row.fromPack, isCertDemo: row.isCertDemo },
    stage,
    stages: STAGES.map((s) => ({ n: s.n, name: s.name, phase: s.phase, gate: gates.find((x) => x.stage === s.n)?.state ?? null, run: runs.find((r) => r.stage === s.n)?.state ?? null })),
    artifacts,
    proposals: proposals.map((p) => ({ id: p.id, artifactType: p.artifactType, fieldPath: p.fieldPath, value: JSON.parse(p.proposedJson) as unknown, rationale: p.rationale, agentId: actions.find((a) => a.id === p.actionId)?.agentId ?? '' })),
    criteria,
    gate: g
      ? {
          id: g.id,
          stage: g.stage,
          state: g.state,
          quorum: g.quorum,
          roles: JSON.parse(g.requiredRolesJson) as string[],
          veto: JSON.parse(g.vetoRolesJson) as string[],
          staleReason: g.staleReason,
          decisions: decisions.map((d) => ({ personaId: d.personaId, name: pack.personas.find((p) => p.id === d.personaId)?.name ?? d.personaId, role: d.role, outcome: d.outcome, rationale: d.rationale, at: d.createdAt.toISOString() })),
          evidence: g.evidence.map((e) => ({ type: e.artifactType, hash: e.contentHash })),
        }
      : null,
    staleGates: gates.filter((x) => x.state === 'STALE').map((x) => ({ stage: x.stage, reason: x.staleReason })),
    checks: stage === 11 ? await latestChecks(prisma, pack, productId) : null,
    agent: agent ? { id: agent.id, name: agent.name, charter: agent.charter } : null,
    autopilot: run ? { id: run.id, state: run.state, steps: JSON.parse(run.stepsJson) as Workspace['autopilot'] extends infer A ? (A extends { steps: infer S } ? S : never) : never } : null,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, role: t.assigneeRole })),
    narrative: lastAction ? ((JSON.parse(lastAction.outputJson) as { narrative?: string }).narrative ?? null) : null,
  };
}
