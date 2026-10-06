import type { DataProduct as DbProduct } from '@prisma/client';
import type { DataProduct, Pack } from '@/lib/packs/schema';

/** The pack-shaped product for a live record: the pack definition when it came from the pack, else built from the DB row. */
export function productModel(pack: Pack, row: DbProduct): DataProduct {
  const fromPack = pack.products.find((p) => p.id === row.id);
  if (fromPack) return fromPack;
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    archetype: row.archetype as DataProduct['archetype'],
    initial_status: 'DRAFT',
    seed_stage: row.currentStage,
    version: row.semanticVersion,
    owner: row.ownerPersonaId,
    steward: row.stewardPersonaId,
    description: row.description,
    purpose: row.purpose,
    decision: JSON.parse(row.decisionJson) as DataProduct['decision'],
    sample_questions: JSON.parse(row.sampleQuestionsJson) as string[],
    semantic_view: row.semanticView,
    output_ports: JSON.parse(row.outputPortsJson) as DataProduct['output_ports'],
    sla: JSON.parse(row.slaJson) as DataProduct['sla'],
    kpis: JSON.parse(row.kpiIdsJson) as string[],
    upstream: JSON.parse(row.upstreamJson) as string[],
    consumers: [],
    lifecycle_seed: { artifacts: 'auto', open_proposals: false },
    certification_script: null,
    value_case: null,
  } as DataProduct;
}
