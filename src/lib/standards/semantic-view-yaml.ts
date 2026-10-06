import { stringify } from 'yaml';
import type { Pack, SemanticView } from '@/lib/packs/schema';

/** Snowflake semantic-view-compatible YAML (Cortex Analyst semantic model) for one view (01 §M9). */
export function semanticViewYaml(pack: Pack, view: SemanticView): string {
  const db = pack.manifest.database;
  const rels = view.relationships.map((r, i) => {
    const [la, lc] = r.from.split('.');
    const [ra, rc] = r.to.split('.');
    const left = view.tables.find((t) => t.alias === la)?.fqn.split('.')[1];
    const right = view.tables.find((t) => t.alias === ra)?.fqn.split('.')[1];
    return { name: `rel_${i + 1}`, left_table: left, right_table: right, relationship_columns: [{ left_column: lc?.toUpperCase(), right_column: rc?.toUpperCase() }], join_type: 'inner', relationship_type: 'many_to_one' };
  });
  const tables = view.tables.map((t) => {
    const [schema, table] = t.fqn.split('.');
    // An expression belongs to this table when every alias it references is this table's alias.
    const mine = (expr: string) => {
      const used = [...expr.matchAll(/\b([a-z][a-z0-9_]*)\.[a-z_]/g)].map((m) => m[1]);
      return used.length > 0 && used.every((a) => a === t.alias);
    };
    return {
      name: table,
      base_table: { database: db, schema, table },
      primary_key: { columns: t.pk.split(',').map((c) => c.trim().toUpperCase()) },
      dimensions: view.dimensions.filter((d) => mine(d.expr)).map((d) => ({ name: d.name, expr: d.expr.replace(`${t.alias}.`, '').toUpperCase(), synonyms: d.synonyms, description: d.description ?? d.label ?? d.name })),
      time_dimensions: view.time_dimensions.filter((d) => mine(d.expr)).map((d) => ({ name: d.name, expr: d.expr.replace(`${t.alias}.`, '').toUpperCase() })),
      facts: view.facts.filter((f) => mine(f.expr)).map((f) => ({ name: f.name, expr: f.expr.replace(new RegExp(`\\b${t.alias}\\.`, 'g'), '').toUpperCase() })),
    };
  });
  const verified = pack.verifiedQueries
    .filter((q) => q.query.view === view.name && q.status === 'active')
    .map((q) => ({ name: q.id, question: q.question, verified_by: q.verified_by, verified_at: q.verified_at, use_as_onboarding_question: false }));
  return stringify(
    {
      name: view.name,
      description: view.description,
      tables,
      relationships: rels,
      metrics: view.metrics.map((m) => ({ name: m.name, description: m.description, expr: m.expr, synonyms: m.synonyms })),
      verified_queries: verified,
    },
    { lineWidth: 0 },
  );
}
