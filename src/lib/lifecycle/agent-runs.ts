/**
 * Runs a lifecycle agent on a stage (08 §7): gathers evidence (pack blueprint plus real profiling, DQ
 * score and certification checks), asks the provider for proposals and persists them as an AgentAction
 * plus OPEN AgentProposals. Proposals change nothing until a human accepts or edits them. The commit
 * then records field provenance `AGENT — accepted by <persona>`.
 */
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { heuristicPropose } from '@/lib/agents/lifecycle-agents/heuristic';
import { agentForStage } from '@/lib/agents/lifecycle-agents/registry';
import { appendAudit, canonicalJson } from '@/lib/db/audit';
import type { DataProduct, Pack, Rubrics } from '@/lib/packs/schema';
import type { QueryService } from '@/lib/query/query-service';
import { type BlueprintFacts, blueprint } from './artifacts/blueprint';
import { ARTIFACTS, type ArtifactContent } from './artifacts/registry';
import { evaluateCertification } from './certification';
import { type Provenance, certificationFacts, commitArtifact, latestVersions, LifecycleError } from './engine';
import { productModel } from './product-model';
import { profileProduct, profileSummary } from './profiling';
import { runProductQuality } from './quality';
import { type ArtifactType, stageDef } from './stages';

export async function stageEvidence(client: PrismaClient, pack: Pack, rubrics: Rubrics, product: DataProduct, stage: number, qs?: QueryService): Promise<BlueprintFacts> {
  const facts: BlueprintFacts = { asOf: pack.manifest.asOf };
  if (stage === 3 && qs) facts.profile = (await profileProduct(pack, qs, product)).map(profileSummary);
  if (stage === 8) {
    const snap = await client.qualityScoreSnapshot.findFirst({ where: { productId: product.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    facts.qualityScore = snap?.score ?? (qs ? (await runProductQuality(pack, rubrics, qs, product)).score : undefined);
  }
  if (stage === 11) facts.checks = evaluateCertification(pack, rubrics, product, await certificationFacts(client, pack, product, { qs })).map((c) => ({ check: c.label, status: c.status, detail: c.detail }));
  return facts;
}

export interface AgentRunResult {
  actionId: string;
  narrative: string;
  proposals: number;
}

export async function runLifecycleAgent(client: PrismaClient, pack: Pack, rubrics: Rubrics, input: { productId: string; stage: number; trigger: 'MANUAL' | 'AUTOPILOT' | 'STAGE_ENTRY'; requestedBy: string; qs?: QueryService }): Promise<AgentRunResult> {
  const row = await client.dataProduct.findUnique({ where: { id: input.productId } });
  if (!row) throw new LifecycleError('Unknown product');
  const product = productModel(pack, row);
  const agent = agentForStage(input.stage);
  if (!agent) throw new LifecycleError(`No lifecycle agent works stage ${input.stage}.`);
  const facts = await stageEvidence(client, pack, rubrics, product, input.stage, input.qs);
  const latest = await latestVersions(client, product.id);
  const open = await client.agentProposal.findMany({ where: { productId: product.id, stage: input.stage, state: 'OPEN' }, select: { artifactType: true, fieldPath: true } });
  const openKeys = new Set(open.map((o) => `${o.artifactType}:${o.fieldPath}`));
  const outputs: { type: ArtifactType; narrative: string; proposals: { fieldPath: string; value: unknown; rationale: string }[]; redacted: string[] }[] = [];
  for (const type of stageDef(input.stage).artifacts) {
    const def = ARTIFACTS[type];
    const evidence = blueprint(pack, product, type, facts);
    const out = heuristicPropose({
      agentName: agent.name,
      artifactLabel: def.label.toLowerCase(),
      fields: def.fields,
      current: latest.get(type)?.content ?? {},
      evidence,
      evidenceSources: evidenceSources(input.stage),
      allowSampleData: agent.wantsSampleData,
    });
    outputs.push({ type, narrative: out.narrative, proposals: out.proposals.filter((p) => !openKeys.has(`${type}:${p.fieldPath}`)), redacted: out.redactedFields });
  }
  const proposals = outputs.flatMap((o) => o.proposals.map((p) => ({ ...p, type: o.type })));
  const narrative = outputs.map((o) => o.narrative).join(' ');
  const output = { narrative, proposals: proposals.length };
  const action = await client.agentAction.create({
    data: {
      packId: pack.manifest.id,
      agentId: agent.id,
      productId: product.id,
      stage: input.stage,
      trigger: input.trigger,
      scopeJson: JSON.stringify({ artifacts: stageDef(input.stage).artifacts, readScope: agent.readScope }),
      inputHash: createHash('sha256').update(canonicalJson({ facts, latest: [...latest.entries()].map(([k, v]) => [k, v.hash]) })).digest('hex'),
      model: 'heuristic-v1',
      provider: 'heuristic',
      outputJson: JSON.stringify(output),
      redactedFieldsJson: JSON.stringify(outputs.flatMap((o) => o.redacted.map((f) => `${o.type}.${f}`))),
      disposition: proposals.length ? 'PROPOSED' : 'NO_CHANGE',
    },
  });
  if (proposals.length) {
    await client.agentProposal.createMany({
      data: proposals.map((p) => ({ actionId: action.id, productId: product.id, stage: input.stage, artifactType: p.type, fieldPath: p.fieldPath, proposedJson: JSON.stringify(p.value), rationale: p.rationale, state: 'OPEN' })),
    });
  }
  await appendAudit(client, { packId: pack.manifest.id, actorType: 'AGENT', actorId: agent.id, action: 'AGENT_PROPOSED', subjectType: 'PRODUCT', subjectId: product.id, detail: { stage: input.stage, proposals: proposals.length, requestedBy: input.requestedBy, trigger: input.trigger } });
  return { actionId: action.id, narrative, proposals: proposals.length };
}

function evidenceSources(stage: number): string[] {
  const m: Record<number, string[]> = { 3: ['live profiling results', 'source catalog'], 8: ['declared DQ rules', 'latest DQ run'], 11: ['the eight certification checks'], 6: ['semantic view', 'glossary', 'verified queries'], 9: ['column tags', 'masking and row policies', 'control library'] };
  return m[stage] ?? ['pack metadata', 'the decision record'];
}

export type ProposalOutcome = 'ACCEPT' | 'EDIT' | 'REJECT';

/** A human decides a proposal; accept/edit commits a new artifact version with field provenance. */
export async function decideProposal(client: PrismaClient, pack: Pack, input: { proposalId: string; personaId: string; outcome: ProposalOutcome; editedValue?: unknown }): Promise<{ state: string; versionId?: string }> {
  const p = await client.agentProposal.findUnique({ where: { id: input.proposalId } });
  if (!p || p.state !== 'OPEN') throw new LifecycleError('This proposal is no longer open.');
  if (!pack.personas.some((x) => x.id === input.personaId)) throw new LifecycleError('Unknown persona');
  if (input.outcome === 'REJECT') {
    await client.agentProposal.update({ where: { id: p.id }, data: { state: 'REJECTED', decidedBy: input.personaId, decidedAt: new Date() } });
    await appendAudit(client, { packId: pack.manifest.id, actorType: 'HUMAN', actorId: input.personaId, action: 'PROPOSAL_REJECTED', subjectType: 'PROPOSAL', subjectId: p.id, detail: { field: `${p.artifactType}.${p.fieldPath}` } });
    return { state: 'REJECTED' };
  }
  const value = input.outcome === 'EDIT' ? input.editedValue : (JSON.parse(p.proposedJson) as unknown);
  const latest = (await latestVersions(client, p.productId)).get(p.artifactType as ArtifactType);
  const content: ArtifactContent = { ...(latest?.content ?? {}), [p.fieldPath]: value };
  const provenance: Record<string, Provenance> = { [p.fieldPath]: input.outcome === 'EDIT' ? { source: 'HUMAN' } : { source: 'AGENT', agentId: (await client.agentAction.findUnique({ where: { id: p.actionId } }))?.agentId, acceptedBy: input.personaId } };
  const prevProv = latest ? await client.fieldProvenance.findMany({ where: { versionId: latest.versionId } }) : [];
  for (const pp of prevProv) if (pp.fieldPath !== p.fieldPath) provenance[pp.fieldPath] = { source: pp.source as Provenance['source'], agentId: pp.agentId ?? undefined, acceptedBy: pp.acceptedBy ?? undefined };
  const commit = await commitArtifact(client, pack, { productId: p.productId, type: p.artifactType as ArtifactType, content, committedBy: input.personaId, message: `${input.outcome === 'EDIT' ? 'Edited' : 'Accepted'} agent proposal for ${p.fieldPath}`, provenance });
  const state = input.outcome === 'EDIT' ? 'EDITED' : 'ACCEPTED';
  await client.agentProposal.update({ where: { id: p.id }, data: { state, acceptedJson: JSON.stringify(value), decidedBy: input.personaId, decidedAt: new Date() } });
  return { state, versionId: commit.versionId };
}

/** Accept every open non-sensitive proposal on a stage (sensitive fields need one-by-one review). */
export async function acceptAll(client: PrismaClient, pack: Pack, productId: string, stage: number, personaId: string): Promise<{ accepted: number; skippedSensitive: number }> {
  const open = await client.agentProposal.findMany({ where: { productId, stage, state: 'OPEN' }, orderBy: { createdAt: 'asc' } });
  let accepted = 0;
  let skippedSensitive = 0;
  for (const p of open) {
    const field = ARTIFACTS[p.artifactType as ArtifactType]?.fields.find((f) => f.path === p.fieldPath);
    if (field?.sensitive) {
      skippedSensitive += 1;
      continue;
    }
    await decideProposal(client, pack, { proposalId: p.id, personaId, outcome: 'ACCEPT' });
    accepted += 1;
  }
  return { accepted, skippedSensitive };
}
