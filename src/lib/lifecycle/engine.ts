/**
 * Lifecycle engine (06 §2): artifact commits (append-only, content-hashed, field provenance) with
 * cascade-to-STALE, fact gathering for exit criteria, submit-for-review with evidence snapshot,
 * certification evaluation and certification fixes. Approvals happen only in recordDecision().
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { appendAudit, canonicalJson, type Db } from '@/lib/db/audit';
import type { DataProduct, Pack, Rubrics } from '@/lib/packs/schema';
import { systemPrincipal } from '@/lib/query/principal';
import type { QueryService } from '@/lib/query/query-service';
import { upstreamObjects } from './artifacts/blueprint';
import type { ArtifactContent } from './artifacts/registry';
import { CHECKS, type CertificationFacts, type CheckResult, activeVerifiedQueries, evaluateCertification } from './certification';
import { type Criterion, type CriteriaFacts, criteriaMet, exitCriteria } from './criteria';
import { productModel } from './product-model';
import { type ArtifactType, stageDef, stageOfArtifact } from './stages';

export class LifecycleError extends Error {
  constructor(
    message: string,
    readonly criteria: Criterion[] = [],
  ) {
    super(message);
    this.name = 'LifecycleError';
  }
}

export const contentHash = (content: ArtifactContent) => createHash('sha256').update(canonicalJson(content)).digest('hex');

export interface Provenance {
  source: 'HUMAN' | 'AGENT';
  agentId?: string;
  acceptedBy?: string;
}

export interface CommitInput {
  productId: string;
  type: ArtifactType;
  content: ArtifactContent;
  committedBy: string;
  message: string;
  /** Per field path; fields not listed are HUMAN-authored by `committedBy`. */
  provenance?: Record<string, Provenance>;
}

/** Ensures the StageRun and Gate rows for a stage exist. */
export async function ensureStage(tx: Db, productId: string, stage: number, state: 'NOT_STARTED' | 'IN_PROGRESS' = 'IN_PROGRESS'): Promise<void> {
  const run = await tx.stageRun.findFirst({ where: { productId, stage } });
  if (!run) await tx.stageRun.create({ data: { productId, stage, state, startedAt: state === 'IN_PROGRESS' ? new Date() : null } });
  const def = stageDef(stage);
  if (def.gate && !(await tx.gate.findUnique({ where: { productId_stage: { productId, stage } } }))) {
    await tx.gate.create({ data: { productId, stage, state: 'PENDING', quorum: def.gate.quorum, requiredRolesJson: JSON.stringify(def.gate.roles), vetoRolesJson: JSON.stringify(def.gate.veto) } });
  }
}

export interface LatestVersion {
  artifactId: string;
  versionId: string;
  version: number;
  content: ArtifactContent;
  hash: string;
  committedBy: string;
  createdAt: Date;
}

export async function latestVersions(tx: Db, productId: string): Promise<Map<ArtifactType, LatestVersion>> {
  const arts = await tx.artifact.findMany({ where: { productId }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
  const out = new Map<ArtifactType, LatestVersion>();
  for (const a of arts) {
    const v = a.versions[0];
    if (v) out.set(a.type as ArtifactType, { artifactId: a.id, versionId: v.id, version: v.version, content: JSON.parse(v.contentJson) as ArtifactContent, hash: v.contentHash, committedBy: v.committedBy, createdAt: v.createdAt });
  }
  return out;
}

/** Appends a new artifact version; approved gates that relied on an earlier version go STALE (cascade). */
export async function commitArtifact(client: PrismaClient, pack: Pack, input: CommitInput): Promise<{ versionId: string; version: number; hash: string; staleGates: number[]; unchanged: boolean }> {
  return client.$transaction(async (tx) => {
    const stage = stageOfArtifact(input.type);
    const artifact = (await tx.artifact.findUnique({ where: { productId_type: { productId: input.productId, type: input.type } } })) ?? (await tx.artifact.create({ data: { productId: input.productId, type: input.type, stage } }));
    const prev = await tx.artifactVersion.findFirst({ where: { artifactId: artifact.id }, orderBy: { version: 'desc' } });
    const hash = contentHash(input.content);
    if (prev && prev.contentHash === hash) return { versionId: prev.id, version: prev.version, hash, staleGates: [], unchanged: true };
    const version = (prev?.version ?? 0) + 1;
    const v = await tx.artifactVersion.create({ data: { artifactId: artifact.id, version, contentJson: canonicalJson(input.content), contentHash: hash, committedBy: input.committedBy, message: input.message } });
    const paths = Object.keys(input.content);
    await tx.fieldProvenance.createMany({
      data: paths.map((fieldPath) => {
        const p = input.provenance?.[fieldPath];
        return { versionId: v.id, fieldPath, source: p?.source ?? 'HUMAN', agentId: p?.agentId ?? null, acceptedBy: p?.acceptedBy ?? (p?.source === 'AGENT' ? input.committedBy : null) };
      }),
    });
    // Cascade (06 §2): approved gates whose evidence includes an earlier version of this artifact.
    const staleGates: number[] = [];
    if (prev) {
      const evidence = await tx.gateEvidence.findMany({ where: { artifactType: input.type, gate: { productId: input.productId, state: 'APPROVED' } }, include: { gate: true } });
      for (const e of evidence) {
        if (e.contentHash === hash || staleGates.includes(e.gate.stage)) continue;
        await tx.gate.update({ where: { id: e.gateId }, data: { state: 'STALE', staleReason: `${input.type} changed to v${version} after gate ${e.gate.stage} approved v${prev.version}` } });
        staleGates.push(e.gate.stage);
        for (const role of JSON.parse(e.gate.requiredRolesJson) as string[]) {
          await tx.task.create({ data: { packId: pack.manifest.id, productId: input.productId, kind: 'REAPPROVE', title: `Re-approve gate ${e.gate.stage} (${stageDef(e.gate.stage).name}) after ${input.type} v${version}`, assigneeRole: role, state: 'OPEN' } });
        }
      }
    }
    await appendAudit(tx, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: input.committedBy, action: 'ARTIFACT_COMMITTED', subjectType: 'ARTIFACT', subjectId: `${input.productId}/${input.type}`, detail: { version, hash, message: input.message, agentFields: Object.entries(input.provenance ?? {}).filter(([, p]) => p.source === 'AGENT').map(([k]) => k), staleGates } });
    return { versionId: v.id, version, hash, staleGates, unchanged: false };
  });
}

export interface FactsOptions {
  qs?: QueryService;
  /** Skip the warehouse-backed facts (semantic compile, VQ execution, contract columns). */
  offline?: boolean;
}

/** Live certification facts for a product. */
export async function certificationFacts(tx: Db, pack: Pack, product: DataProduct, opts: FactsOptions = {}): Promise<CertificationFacts> {
  const fixes = (await tx.appliedFix.findMany({ where: { packId: pack.manifest.id, productId: product.id } })).map((f) => f.fixId);
  const snap = await tx.qualityScoreSnapshot.findFirst({ where: { productId: product.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const gates = await tx.gate.findMany({ where: { productId: product.id, state: 'APPROVED' } });
  const contract = (await latestVersions(tx, product.id)).get('data-contract')?.content;
  let contractColumnsMissing: string[] = [];
  let vqExecRate = 1;
  if (opts.qs && !opts.offline) {
    const cols = new Map<string, Set<string>>();
    for (const col of (contract?.columns as string[] | undefined) ?? []) {
      const obj = col.split('.').slice(0, 2).join('.');
      if (!cols.has(obj)) cols.set(obj, new Set((await opts.qs.describe(obj).catch(() => [])).map((c) => c.name)));
      if (!cols.get(obj)?.has(col.split('.')[2] ?? '')) contractColumnsMissing.push(col);
    }
    const vqs = activeVerifiedQueries(pack, fixes).filter((q) => q.query.view === product.semantic_view);
    let ok = 0;
    for (const q of vqs) {
      try {
        const r = await opts.qs.run({ kind: 'metric', query: q.query, purpose: 'eval', question: q.question }, systemPrincipal(pack));
        if (r.rowCount > 0) ok += 1;
      } catch {
        // counts as a failed verified query
      }
    }
    vqExecRate = vqs.length ? ok / vqs.length : 0;
  }
  contractColumnsMissing = [...new Set(contractColumnsMissing)];
  return { appliedFixes: fixes, qualityScore: snap?.score ?? null, approvedGates: gates.map((g) => g.stage), contractColumnsMissing, vqExecRate };
}

/** Evaluates the 8 certification checks and stores the results (append-only rows). */
export async function evaluateAndStoreChecks(client: PrismaClient, pack: Pack, rubrics: Rubrics, productId: string, opts: FactsOptions = {}): Promise<CheckResult[]> {
  const row = await client.dataProduct.findUnique({ where: { id: productId } });
  if (!row) throw new LifecycleError('Unknown product');
  const product = productModel(pack, row);
  const checks = evaluateCertification(pack, rubrics, product, await certificationFacts(client, pack, product, opts));
  await client.certificationCheckResult.createMany({ data: checks.map((c) => ({ productId, checkId: c.id, status: c.status, detail: c.detail, fixApplied: c.fix?.applied ?? false })) });
  return checks;
}

export async function latestChecks(tx: Db, pack: Pack, productId: string): Promise<CheckResult[] | null> {
  const rows = await tx.certificationCheckResult.findMany({ where: { productId }, orderBy: [{ evaluatedAt: 'desc' }, { id: 'desc' }], take: 64 });
  if (!rows.length) return null;
  const seen = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!seen.has(r.checkId)) seen.set(r.checkId, r);
  const product = pack.products.find((p) => p.id === productId);
  return [...seen.values()].map((r) => {
    const fix = product?.certification_script?.fixes.find((f) => f.check === r.checkId);
    const n = CHECKS.findIndex((c) => c.id === r.checkId) + 1;
    return { id: r.checkId, n, label: CHECKS[n - 1]?.label ?? r.checkId, status: r.status as CheckResult['status'], detail: r.detail, ...(fix ? { fix: { id: fix.id, label: fix.label, applied: r.fixApplied } } : {}) };
  }).sort((a, b) => a.n - b.n);
}

/** Facts for a stage's exit criteria. */
export async function gatherCriteriaFacts(client: PrismaClient, pack: Pack, rubrics: Rubrics, productId: string, stage: number, opts: FactsOptions = {}): Promise<CriteriaFacts> {
  const row = await client.dataProduct.findUnique({ where: { id: productId } });
  if (!row) throw new LifecycleError('Unknown product');
  const product = productModel(pack, row);
  const latest = await latestVersions(client, productId);
  const contents: CriteriaFacts['contents'] = {};
  for (const t of stageDef(stage).artifacts) {
    const v = latest.get(t);
    if (v) contents[t] = v.content;
  }
  const openProposals = await client.agentProposal.count({ where: { productId, stage, state: 'OPEN' } });
  const snap = await client.qualityScoreSnapshot.findFirst({ where: { productId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  let semanticErrors: string[] | null = null;
  if (stage === 6 && opts.qs && !opts.offline) {
    const view = pack.semantic.find((v) => v.name === product.semantic_view);
    semanticErrors = view ? [] : ['No semantic view bound'];
    for (const m of view?.metrics ?? []) {
      try {
        const r = await opts.qs.run({ kind: 'metric', query: { view: view?.name ?? '', metrics: [m.name] }, purpose: 'eval' }, systemPrincipal(pack));
        if (r.rows[0]?.[0] === null || r.rows[0]?.[0] === undefined) semanticErrors.push(`${m.name} returned no value`);
      } catch (e) {
        semanticErrors.push(`${m.name}: ${(e as Error).message}`);
      }
    }
  }
  const checks = stage === 11 ? await latestChecks(client, pack, productId) : null;
  return { contents, openProposals, qualityScore: snap?.score ?? null, semanticErrors, checks, profileTargets: upstreamObjects(pack, product).filter((o) => o.layer !== 'bronze').map((o) => o.fqn) };
}

/** Submit a stage for gate review: exit criteria must pass; evidence (artifact versions + hashes) is snapshotted. */
export async function submitForReview(client: PrismaClient, pack: Pack, rubrics: Rubrics, productId: string, stage: number, personaId: string, opts: FactsOptions = {}): Promise<{ criteria: Criterion[] }> {
  const def = stageDef(stage);
  if (!def.gate) throw new LifecycleError(`Stage ${stage} has no gate.`);
  const persona = pack.personas.find((p) => p.id === personaId);
  if (!persona) throw new LifecycleError('Unknown persona');
  const criteria = exitCriteria(stage, rubrics, await gatherCriteriaFacts(client, pack, rubrics, productId, stage, opts));
  if (!criteriaMet(criteria)) throw new LifecycleError('Exit criteria are not met yet.', criteria);
  await client.$transaction(async (tx) => {
    await ensureStage(tx, productId, stage);
    const gate = await tx.gate.findUnique({ where: { productId_stage: { productId, stage } } });
    if (!gate) throw new LifecycleError('Gate missing');
    if (gate.state === 'IN_REVIEW') throw new LifecycleError('Already in review.');
    if (gate.state === 'APPROVED') throw new LifecycleError('This gate is already approved.');
    const latest = await latestVersions(tx, productId);
    await tx.gate.update({ where: { id: gate.id }, data: { state: 'IN_REVIEW', submittedBy: personaId, submittedAt: new Date(), staleReason: gate.state === 'STALE' ? gate.staleReason : null } });
    for (const t of def.artifacts) {
      const v = latest.get(t);
      if (v) await tx.gateEvidence.create({ data: { gateId: gate.id, artifactVersionId: v.versionId, artifactType: t, contentHash: v.hash } });
    }
    const run = await tx.stageRun.findFirst({ where: { productId, stage }, orderBy: { attempt: 'desc' } });
    if (run && run.state !== 'COMPLETE') await tx.stageRun.update({ where: { id: run.id }, data: { state: 'IN_REVIEW' } });
    await appendAudit(tx, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: personaId, action: 'GATE_SUBMITTED', subjectType: 'GATE', subjectId: gate.id, detail: { productId, stage, evidence: def.artifacts.filter((t) => latest.has(t)).map((t) => `${t}@v${latest.get(t)?.version}`) } });
  });
  return { criteria };
}

/** Applies a scripted certification fix (its effect is real state) and re-evaluates the checks. */
export async function applyFix(client: PrismaClient, pack: Pack, rubrics: Rubrics, productId: string, fixId: string, personaId: string, opts: FactsOptions = {}): Promise<CheckResult[]> {
  const product = pack.products.find((p) => p.id === productId);
  const fix = product?.certification_script?.fixes.find((f) => f.id === fixId);
  if (!product || !fix) throw new LifecycleError('Unknown fix');
  const existing = await client.appliedFix.findUnique({ where: { packId_productId_fixId: { packId: pack.manifest.id, productId, fixId } } });
  if (!existing) {
    await client.appliedFix.create({ data: { packId: pack.manifest.id, productId, fixId, appliedBy: personaId } });
    if ('overlay' in fix.effect) {
      for (const key of fix.effect.keys) await client.knowledgeOverlay.create({ data: { packId: pack.manifest.id, kind: 'VERIFIED_QUERY', key, payloadJson: JSON.stringify({ status: 'active', fix: fixId }), createdBy: personaId } });
    }
    await appendAudit(client, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: personaId, action: 'CERT_FIX_APPLIED', subjectType: 'PRODUCT', subjectId: productId, detail: { fixId, label: fix.label, effect: fix.effect } });
  }
  return evaluateAndStoreChecks(client, pack, rubrics, productId, opts);
}
