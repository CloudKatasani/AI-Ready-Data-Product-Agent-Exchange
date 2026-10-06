import type { SemanticView } from '@/lib/packs/schema';

export interface JoinPlan {
  /** `FROM fact alias LEFT JOIN … ON …` (DuckDB SQL, schema-qualified). */
  from: string;
  aliases: string[];
}

/**
 * Join tree of a semantic view, breadth-first from the fact table (first table). Throws if any table is
 * unreachable (05 §1.2). Shared by the base-view generator and, from Phase 2, the metric compiler.
 */
export function planJoins(view: SemanticView): JoinPlan {
  const [fact, ...rest] = view.tables;
  if (!fact) throw new Error(`${view.name}: no tables`);
  const byAlias = new Map(view.tables.map((t) => [t.alias, t]));
  const edges = view.relationships.map((r) => {
    const [fa, fc] = r.from.split('.');
    const [ta, tc] = r.to.split('.');
    return { fa: fa as string, fc: fc as string, ta: ta as string, tc: tc as string };
  });
  const parts = [`${fact.fqn} ${fact.alias}`];
  const joined = new Set([fact.alias]);
  const queue = [fact.alias];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const e of edges) {
      const [near, nearCol, far, farCol] = e.fa === cur ? [e.fa, e.fc, e.ta, e.tc] : e.ta === cur ? [e.ta, e.tc, e.fa, e.fc] : [];
      if (!near || !far || joined.has(far)) continue;
      const t = byAlias.get(far);
      if (!t) throw new Error(`${view.name}: relationship references unknown alias "${far}"`);
      joined.add(far);
      queue.push(far);
      parts.push(`LEFT JOIN ${t.fqn} ${far} ON ${near}.${nearCol} = ${far}.${farCol}`);
    }
  }
  const missing = rest.filter((t) => !joined.has(t.alias)).map((t) => t.alias);
  if (missing.length > 0) throw new Error(`${view.name}: tables not connected to the fact table: ${missing.join(', ')}`);
  return { from: parts.join('\n  '), aliases: [...joined] };
}

/** `SEMANTIC.<view>`: the base join with every dimension, time dimension and fact as a column (Explorer display). */
export function semanticBaseViewSql(view: SemanticView): string {
  const plan = planJoins(view);
  const cols = [
    ...view.dimensions.map((d) => `${d.expr} AS ${d.name}`),
    ...view.time_dimensions.map((d) => `${d.expr} AS ${d.name}`),
    ...view.facts.map((f) => `${f.expr} AS ${f.name}`),
  ];
  return `CREATE OR REPLACE VIEW SEMANTIC.${view.name} AS\nSELECT\n  ${cols.join(',\n  ')}\nFROM ${plan.from}`;
}
