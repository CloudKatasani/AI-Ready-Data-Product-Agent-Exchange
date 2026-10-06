/**
 * Evidence pack (06 §8): product summary, decision record, approved artifacts (latest versions with
 * hashes), gate decisions with personas and rationales, certification checks, DQ results, lineage, agent
 * contributions with provenance and an audit digest — as a .docx.
 */
import type { PrismaClient } from '@prisma/client';
import { verifyChain } from '@/lib/db/audit';
import { ARTIFACTS } from '@/lib/lifecycle/artifacts/registry';
import { latestChecks, latestVersions } from '@/lib/lifecycle/engine';
import { productModel } from '@/lib/lifecycle/product-model';
import { STAGES, type ArtifactType } from '@/lib/lifecycle/stages';
import { lineageAround } from '@/lib/packs/lineage';
import type { Pack } from '@/lib/packs/schema';
import { type Block, docx } from './docx';

const fmt = (v: unknown): string => (Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? Object.values(x as object).join(' · ') : String(x))).join('; ') : v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export async function evidencePack(client: PrismaClient, pack: Pack, productId: string): Promise<Buffer> {
  const row = await client.dataProduct.findUnique({ where: { id: productId } });
  if (!row) throw new Error('Unknown product');
  const product = productModel(pack, row);
  const persona = (id: string | null | undefined) => pack.personas.find((p) => p.id === id)?.name ?? id ?? '—';
  const latest = await latestVersions(client, productId);
  const gates = await client.gate.findMany({ where: { productId }, orderBy: { stage: 'asc' } });
  const decisions = await client.decision.findMany({ where: { subjectType: 'GATE', subjectId: { in: gates.map((g) => g.id) } }, orderBy: { createdAt: 'asc' } });
  const checks = await latestChecks(client, pack, productId);
  const rules = await client.qualityRuleResult.findMany({ where: { productId }, orderBy: { evaluatedAt: 'desc' } });
  const seen = new Set<string>();
  const latestRules = rules.filter((r) => !seen.has(r.ruleId) && seen.add(r.ruleId));
  const snap = await client.qualityScoreSnapshot.findFirst({ where: { productId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const prov = await client.fieldProvenance.findMany({ where: { versionId: { in: [...latest.values()].map((v) => v.versionId) }, source: 'AGENT' } });
  const events = await client.auditEvent.findMany({ where: { packId: pack.manifest.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
  const mine = events.filter((e) => e.subjectId === productId || e.subjectId.startsWith(`${productId}/`) || gates.some((g) => g.id === e.subjectId));
  const chain = verifyChain(events);

  const b: Block[] = [
    { kind: 'h1', text: `Evidence pack — ${product.name} (${product.id})` },
    { kind: 'p', text: `${pack.manifest.company.name} · v${row.semanticVersion} · ${row.status.replace(/_/g, ' ').toLowerCase()} · stage ${row.currentStage}/12 · as of ${pack.manifest.asOf}. Synthetic demo data.` },
    { kind: 'h2', text: 'Product summary' },
    { kind: 'table', header: ['Field', 'Value'], rows: [['Domain', product.domain], ['Owner', persona(product.owner)], ['Steward', persona(product.steward)], ['Purpose', product.purpose], ['Description', product.description], ['Output ports', product.output_ports.map((o) => `${o.kind}: ${o.ref}`).join('; ')]] },
    { kind: 'h2', text: 'Decision record' },
    { kind: 'table', header: ['', ''], rows: [['Decision', product.decision.decision], ['Who decides', product.decision.persona], ['Cadence', product.decision.cadence], ['Workaround today', product.decision.workaround], ['If wrong', product.decision.consequence]] },
    { kind: 'h2', text: 'Gate decisions' },
    { kind: 'table', header: ['Stage', 'Gate state', 'Decided by', 'Role', 'Outcome', 'Rationale'], rows: decisions.map((d) => { const g = gates.find((x) => x.id === d.subjectId); return [`${g?.stage} ${STAGES.find((s) => s.n === g?.stage)?.name ?? ''}`, g?.state ?? '', persona(d.personaId), d.role, d.outcome, d.rationale]; }) },
    { kind: 'h2', text: 'Certification checks' },
    { kind: 'table', header: ['#', 'Check', 'Status', 'Detail'], rows: (checks ?? []).map((c) => [String(c.n), c.label, c.status, c.detail]) },
    { kind: 'h2', text: `Data quality — score ${snap?.score ?? 'n/a'}` },
    { kind: 'table', header: ['Rule', 'Dimension', 'Observed', 'Threshold', 'Result'], rows: latestRules.map((r) => [r.ruleId, r.dimension, r.observed === null ? '—' : String(Number(r.observed.toPrecision(4))), String(r.threshold), r.passed ? 'pass' : 'fail']) },
    { kind: 'h2', text: 'Approved artifacts (latest versions)' },
  ];
  for (const s of STAGES) {
    for (const t of s.artifacts) {
      const v = latest.get(t as ArtifactType);
      if (!v) continue;
      b.push({ kind: 'h3', text: `${ARTIFACTS[t].label} v${v.version} — stage ${s.n}` }, { kind: 'mono', text: `sha256 ${v.hash} · committed by ${persona(v.committedBy)}` });
      b.push({ kind: 'table', header: ['Field', 'Value'], rows: ARTIFACTS[t].fields.map((f) => [f.label, fmt(v.content[f.path]).slice(0, 600)]) });
    }
  }
  b.push({ kind: 'h2', text: 'Lineage' }, ...lineageAround(pack, product.id).edges.map((e) => ({ kind: 'li' as const, text: `${e.from} → ${e.to}` })));
  b.push({ kind: 'h2', text: 'Agent contributions (accepted by a human)' });
  b.push(prov.length ? { kind: 'table', header: ['Field', 'Agent', 'Accepted by'], rows: prov.map((p) => [p.fieldPath, p.agentId ?? '', persona(p.acceptedBy)]) } : { kind: 'p', text: 'No agent-authored fields in the current versions.' });
  b.push({ kind: 'h2', text: 'Audit digest' }, { kind: 'p', text: `${mine.length} events for this product; pack audit chain ${chain.ok ? 'verified' : `BROKEN at ${chain.brokenAt}`} over ${chain.events} events.` });
  b.push({ kind: 'table', header: ['Action', 'Actor', 'Hash'], rows: mine.slice(-40).map((e) => [e.action, persona(e.actorId), e.hash.slice(0, 16)]) });
  return docx(b, `Evidence pack — ${product.name}`);
}
