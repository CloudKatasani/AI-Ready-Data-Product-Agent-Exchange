import { dqMetricSql, dqPasses } from '@/lib/packs/dq';
import type { Pack } from '@/lib/packs/schema';
import { type CheckResult, Checks } from '@/lib/packs/validate';
import type { WarehouseAdapter } from './adapter';
import { LAYER_SCHEMAS } from './layout';

const ALIAS_REF = /\b([a-z][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/g;
const SENSITIVE_NAME = /(^|_)(email|phone|first_name|last_name|full_name|street_address|card_number|tax_id|ssn|date_of_birth)$/;

async function columnsByObject(w: WarehouseAdapter): Promise<Map<string, Set<string>>> {
  const r = await w.query('SELECT table_schema, table_name, column_name FROM information_schema.columns');
  const out = new Map<string, Set<string>>();
  for (const [schema, table, column] of r.rows) {
    const key = `${String(schema)}.${String(table)}`;
    let set = out.get(key);
    if (!set) out.set(key, (set = new Set()));
    set.add(String(column));
  }
  return out;
}

/**
 * Category 4 (warehouse) and the warehouse-backed parts of 5–6 (04 §7), run against a built warehouse.
 * Metric compilation checks join in Phase 2 (they need `compileMetricQuery`).
 */
export async function warehouseChecks(pack: Pack, w: WarehouseAdapter, results: CheckResult[] = []): Promise<CheckResult[]> {
  const c = new Checks(results, 4);
  const cols = await columnsByObject(w);
  const has = (fqn: string) => cols.has(fqn);
  const hasCol = (fqn: string, col: string) => cols.get(fqn)?.has(col) ?? false;

  for (const schema of Object.values(LAYER_SCHEMAS)) {
    c.expect([...cols.keys()].some((k) => k.startsWith(`${schema}.`)), 'warehouse.schema', `schema ${schema} has no objects`, schema);
  }
  for (const s of pack.sources) {
    const fqn = `RAW_BRONZE.${s.name}`;
    c.expect(has(fqn), 'warehouse.bronze', `${fqn} was not built`, fqn);
    for (const col of ['_op', '_loaded_at']) c.expect(hasCol(fqn, col), 'warehouse.bronze_cdc', `${fqn} lacks CDC column ${col}`, fqn);
  }
  for (const o of pack.objects) {
    if (!c.expect(has(o.fqn), 'warehouse.object', `${o.fqn} declared in objects.yaml but not built`, o.fqn)) continue;
    const n = await w.query(`SELECT count(*) FROM ${o.fqn}`);
    c.expect(Number(n.rows[0]?.[0] ?? 0) > 0, 'warehouse.object_rows', `${o.fqn} is empty`, o.fqn);
  }
  for (const key of cols.keys()) {
    if (key.startsWith('CURATED_SILVER.') || key.startsWith('CONFORMED_GOLD.')) {
      c.expect(pack.objects.some((o) => o.fqn === key), 'warehouse.undeclared', `${key} exists but is not declared in objects.yaml`, key);
    }
  }

  // Semantic views: every alias.column used by any expression exists; the base view returns rows.
  for (const v of pack.semantic) {
    const alias = new Map(v.tables.map((t) => [t.alias, t.fqn]));
    const exprs = [...v.dimensions, ...v.time_dimensions, ...v.facts].map((d) => [d.name, d.expr] as const);
    for (const m of v.metrics) {
      exprs.push([m.name, m.expr]);
      if (m.naive_expr) exprs.push([`${m.name}.naive`, m.naive_expr]);
      for (const s of m.scope_exprs) exprs.push([`${m.name}@${s.dimension}`, s.expr]);
    }
    for (const r of v.relationships) exprs.push(['relationship', `${r.from} = ${r.to}`]);
    for (const t of v.tables) for (const pk of t.pk.split(',').map((x) => x.trim())) exprs.push([`${t.alias}.pk`, `${t.alias}.${pk}`]);
    for (const [name, expr] of exprs) {
      for (const m of expr.matchAll(ALIAS_REF)) {
        const fqn = alias.get(m[1] ?? '');
        if (fqn) c.expect(hasCol(fqn, m[2] ?? ''), 'warehouse.semantic_column', `${v.name}.${name}: ${fqn}.${m[2]} does not exist`, `${v.name}.${name}`);
      }
    }
    const base = `SEMANTIC.${v.name}`;
    if (c.expect(has(base), 'warehouse.semantic_view', `${base} was not built`, base)) {
      const n = await w.query(`SELECT count(*) FROM ${base}`);
      c.expect(Number(n.rows[0]?.[0] ?? 0) > 0, 'warehouse.semantic_rows', `${base} returns no rows`, base);
    }
  }

  // Columns referenced from policies, glossary, row access and DQ exist.
  const colRefs: [string, string][] = [
    ...pack.policies.column_tags.map((t) => [t.column, 'policies.column_tags'] as [string, string]),
    ...pack.glossary.flatMap((t) => t.mappings.columns.map((col) => [col, t.id] as [string, string])),
    ...pack.policies.row_access_policies.flatMap((r) => r.bindings.map((b) => [`${b.object}.${b.column}`, r.id] as [string, string])),
    ...pack.dq.filter((d) => d.column).map((d) => [`${d.object}.${d.column}`, d.id] as [string, string]),
  ];
  for (const [ref, where] of colRefs) {
    const [schema, obj, col] = ref.split('.');
    c.expect(hasCol(`${schema}.${obj}`, col ?? ''), 'warehouse.column_ref', `${where}: column ${ref} does not exist`, where);
  }
  for (const p of pack.products) {
    for (const port of p.output_ports.filter((o) => o.kind === 'sql')) c.expect(has(port.ref), 'warehouse.product_port', `${p.id}: output port ${port.ref} was not built`, p.id);
  }

  // DQ rules execute (05 §5); failures at build are warnings — the scores feed certification, not the build.
  for (const rule of pack.dq) {
    let observed: number | null = null;
    let error = '';
    let spec: ReturnType<typeof dqMetricSql> | undefined;
    try {
      spec = dqMetricSql(rule);
      const r = await w.query(spec.sql);
      const v = r.rows[0]?.[0];
      observed = v === null || v === undefined ? null : Number(v);
    } catch (e) {
      error = (e as Error).message;
    }
    if (c.expect(error === '', 'warehouse.dq_executes', `${rule.id}: ${error}`, rule.id) && spec) {
      c.warn(dqPasses(observed, spec.op, spec.threshold), 'warehouse.dq_passes', `${rule.id}: observed ${observed} vs "${rule.assertion}"`, rule.id);
    }
  }

  // Governance (category 6, warehouse-backed): sensitive-looking Silver/Gold columns are tagged.
  const g = c.in(6);
  const tagged = new Set(pack.policies.column_tags.filter((t) => t.classes.length > 0).map((t) => t.column));
  for (const [fqn, set] of cols) {
    if (!fqn.startsWith('CURATED_SILVER.') && !fqn.startsWith('CONFORMED_GOLD.')) continue;
    for (const col of set) {
      if (SENSITIVE_NAME.test(col)) g.expect(tagged.has(`${fqn}.${col}`), 'governance.column_tag', `${fqn}.${col} looks sensitive but has no sensitivity tag`, `${fqn}.${col}`);
    }
  }
  return results;
}
