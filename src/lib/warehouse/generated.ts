import type { Pack } from '@/lib/packs/schema';
import type { AppendColumnType, CellValue, WarehouseBuilder } from './adapter';
import { isoToEpochDay } from './clock';
import { MASKING_MACROS } from './layout';
import { chunkDocument } from '@/lib/packs/chunk';
import { semanticBaseViewSql } from './semantic-base';

interface Table {
  fqn: string;
  columns: [name: string, type: AppendColumnType][];
  rows: CellValue[][];
}

async function load(w: WarehouseBuilder, t: Table): Promise<void> {
  await w.exec(`CREATE OR REPLACE TABLE ${t.fqn} (${t.columns.map(([n, ty]) => `${n} ${ty}`).join(', ')})`);
  if (t.rows.length === 0) return;
  const columnMajor = t.columns.map((_, c) => t.rows.map((r) => r[c] ?? null));
  await w.append(t.fqn, t.columns.map(([, ty]) => ty), columnMajor, t.rows.length);
}

const json = (v: unknown): string => JSON.stringify(v);

export async function createBuildMacros(w: WarehouseBuilder, pack: Pack): Promise<void> {
  for (const [name, body] of Object.entries(MASKING_MACROS)) await w.exec(`CREATE OR REPLACE MACRO GOVERNANCE.${name}(v) AS ${body}`);
  await w.exec(`CREATE OR REPLACE MACRO GOVERNANCE.as_of() AS DATE '${pack.manifest.asOf}'`);
}

export async function createSemanticViews(w: WarehouseBuilder, pack: Pack): Promise<void> {
  for (const view of pack.semantic) await w.exec(semanticBaseViewSql(view));
}

/** GLOSSARY, CONTEXT, DATA_PRODUCTS, AGENTS and GOVERNANCE objects generated from pack content. */
export async function createGeneratedObjects(w: WarehouseBuilder, pack: Pack): Promise<void> {
  const V = 'VARCHAR' as const;
  const tables: Table[] = [
    {
      fqn: 'GLOSSARY.TERMS',
      columns: [['term_id', V], ['name', V], ['definition', V], ['formula', V], ['domain', V], ['owner', V], ['steward', V], ['status', V], ['cde', 'BOOLEAN'], ['synonyms', V]],
      rows: pack.glossary.map((g) => [g.id, g.name, g.definition, g.formula ?? null, g.domain, g.owner, g.steward, g.status, g.cde, g.synonyms.join(', ')]),
    },
    {
      fqn: 'GLOSSARY.TERM_MAPPINGS',
      columns: [['term_id', V], ['kind', V], ['ref', V]],
      rows: pack.glossary.flatMap((g) => [...g.mappings.columns.map((c) => [g.id, 'column', c]), ...g.mappings.metrics.map((m) => [g.id, 'metric', m])]),
    },
    {
      fqn: 'CONTEXT.BUSINESS_RULES',
      columns: [['rule_id', V], ['domain', V], ['kind', V], ['metric', V], ['text', V], ['source_doc', V], ['apply_json', V]],
      rows: pack.rules.map((r) => [r.id, r.domain, r.kind, r.metric ?? null, r.text, r.source_doc, r.apply ? json(r.apply) : null]),
    },
    {
      fqn: 'CONTEXT.VERIFIED_QUERIES',
      columns: [['vq_id', V], ['question', V], ['semantic_view', V], ['metric_query_json', V], ['agent', V], ['verified_by', V], ['verified_at', 'DATE'], ['status', V]],
      rows: pack.verifiedQueries.map((q) => [q.id, q.question, q.query.view, json(q.query), q.agent ?? null, q.verified_by, isoToEpochDay(q.verified_at), q.status]),
    },
    {
      fqn: 'CONTEXT.SYNONYMS',
      columns: [['term', V], ['synonym', V], ['maps_to_kind', V], ['maps_to_ref', V]],
      rows: pack.synonyms.flatMap((s) => s.synonyms.map((syn) => [s.term, syn, s.maps_to.kind, s.maps_to.ref])),
    },
    {
      fqn: 'CONTEXT.INSTRUCTIONS',
      columns: [['instruction_id', V], ['agent_id', V], ['kind', V], ['version', 'INTEGER'], ['text', V]],
      rows: pack.instructions.map((i) => [i.id, i.agent, i.kind, i.version, i.text]),
    },
    {
      fqn: 'CONTEXT.DOCUMENTS',
      columns: [['doc_id', V], ['title', V], ['domain', V], ['owner', V], ['version', V], ['effective', 'DATE'], ['body', V]],
      rows: pack.docs.map((d) => [d.meta.id, d.meta.title, d.meta.domain, d.meta.owner, d.meta.version, isoToEpochDay(d.meta.effective), d.body]),
    },
    {
      fqn: 'CONTEXT.DOCUMENT_CHUNKS',
      columns: [['doc_id', V], ['chunk_no', 'INTEGER'], ['text', V]],
      rows: pack.docs.flatMap((d) => chunkDocument(d.body).map((text, i) => [d.meta.id, i + 1, text])),
    },
    {
      fqn: 'DATA_PRODUCTS.DP_REGISTRY',
      columns: [['product_id', V], ['name', V], ['domain', V], ['status', V], ['version', V], ['owner', V], ['steward', V], ['semantic_view', V], ['output_ports', V]],
      rows: pack.products.map((p) => [p.id, p.name, p.domain, p.initial_status, p.version, p.owner, p.steward, p.semantic_view, json(p.output_ports)]),
    },
    {
      fqn: 'AGENTS.AGENT_REGISTRY',
      columns: [['agent_id', V], ['name', V], ['domain', V], ['status', V], ['owner', V], ['products', V], ['kpis', V]],
      rows: pack.agents.map((a) => [a.id, a.name, a.domain, a.status, a.owner, a.products.map((p) => p.id).join(','), a.kpi_coverage.map((k) => k.kpi).join(',')]),
    },
    {
      fqn: 'AGENTS.AGENT_EVAL_RESULTS',
      columns: [['agent_id', V], ['suite', V], ['score', 'DOUBLE'], ['run_at', 'TIMESTAMP']],
      rows: [],
    },
    {
      fqn: 'GOVERNANCE.TAGS',
      columns: [['object', V], ['column_name', V], ['tag', V], ['value', V]],
      rows: [
        ...pack.sources.flatMap((s) => s.columns.flatMap((c) => c.tags.map((tag) => [`RAW_BRONZE.${s.name}`, c.name, 'SENSITIVITY', tag]))),
        ...pack.policies.column_tags.flatMap((t) => {
          const [schema = '', obj = '', col = ''] = t.column.split('.');
          return [...t.classes.map((cls) => [`${schema}.${obj}`, col, 'SENSITIVITY', cls]), ...(t.cde ? [[`${schema}.${obj}`, col, 'CDE', 'true']] : [])];
        }),
      ],
    },
    {
      fqn: 'GOVERNANCE.MASKING_POLICIES',
      columns: [['policy_id', V], ['class', V], ['macro', V], ['description', V], ['attached_to', V], ['pending_fix', V]],
      rows: pack.policies.masking_policies.flatMap((m) => {
        const attached = pack.policies.column_tags.filter((t) => t.masking === m.id);
        if (attached.length === 0) return [[m.id, m.class, m.macro, m.description, null, null]];
        return attached.map((t) => [m.id, m.class, m.macro, m.description, t.column, t.mask_pending_fix ?? null]);
      }),
    },
    {
      fqn: 'GOVERNANCE.ROW_ACCESS_POLICIES',
      columns: [['policy_id', V], ['dimension', V], ['object', V], ['column_name', V], ['description', V]],
      rows: pack.policies.row_access_policies.flatMap((r) => r.bindings.map((b) => [r.id, r.dimension, b.object, b.column, r.description])),
    },
    {
      fqn: 'GOVERNANCE.GRANTS',
      columns: [['persona_id', V], ['grant_kind', V], ['target', V]],
      rows: pack.policies.grants.flatMap((g) => [...g.products.map((p) => [g.persona, 'PRODUCT', p]), ...g.agents.map((a) => [g.persona, 'AGENT', a])]),
    },
    {
      fqn: 'GOVERNANCE.DQ_RULES',
      columns: [['rule_id', V], ['object', V], ['column_name', V], ['dimension', V], ['assertion', V], ['severity', V], ['description', V]],
      rows: pack.dq.map((d) => [d.id, d.object, d.column ?? null, d.dimension, d.assertion, d.severity, d.description]),
    },
    {
      fqn: 'GOVERNANCE.DQ_RESULTS',
      columns: [['rule_id', V], ['run_at', 'TIMESTAMP'], ['observed', 'DOUBLE'], ['passed', 'BOOLEAN']],
      rows: [],
    },
    {
      fqn: 'GOVERNANCE.ACCESS_HISTORY',
      columns: [['query_log_id', V], ['persona_id', V], ['object', V], ['policies', V], ['accessed_at', 'TIMESTAMP']],
      rows: [],
    },
  ];
  for (const t of tables) await load(w, t);

  for (const p of pack.products) {
    for (const port of p.output_ports.filter((o) => o.kind === 'sql')) {
      const source = p.semantic_view ? `SEMANTIC.${p.semantic_view}` : p.upstream[0];
      await w.exec(`CREATE OR REPLACE VIEW ${port.ref} AS SELECT * FROM ${source}`);
    }
  }
}
