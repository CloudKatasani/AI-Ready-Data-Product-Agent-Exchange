/**
 * Snowflake-dialect DDL for display (05 §4), ported from AI-Ready `mock-snowflake/ddl.ts` and re-pointed
 * at pack metadata: Bronze → Iceberg tables, Silver/Gold → Dynamic Tables (body = the pack SQL),
 * semantic views → CREATE SEMANTIC VIEW. Masking/row-access/tags rendered as attached policies.
 */
import type { Pack } from '@/lib/packs/schema';

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const SCHEMAS = /\b(RAW_BRONZE|CURATED_SILVER|CONFORMED_GOLD|SEMANTIC|GOVERNANCE)\.([A-Z][A-Z0-9_]*)/g;

export interface DdlColumn {
  name: string;
  type: string;
  nullable: boolean;
}

function snowType(t: string): string {
  if (t === 'DOUBLE') return 'FLOAT';
  if (t === 'TIMESTAMP') return 'TIMESTAMP_NTZ';
  if (t === 'BIGINT' || t === 'INTEGER' || t === 'HUGEINT') return 'NUMBER(38,0)';
  return t;
}

function tagsFor(pack: Pack, fqn: string, col: string): { classes: string[]; masking?: string; cde: boolean; pending?: string } {
  const tag = pack.policies.column_tags.find((t) => t.column === `${fqn}.${col}`);
  if (tag) return { classes: tag.classes, masking: tag.masking, cde: tag.cde, pending: tag.mask_pending_fix };
  const [schema, obj] = fqn.split('.');
  if (schema === 'RAW_BRONZE') return { classes: pack.sources.find((s) => s.name === obj)?.columns.find((c) => c.name === col)?.tags ?? [], cde: false };
  return { classes: [], cde: false };
}

function columnLines(pack: Pack, fqn: string, cols: DdlColumn[]): string {
  const db = pack.manifest.database;
  return cols
    .map((c) => {
      const parts = [`  ${c.name.toUpperCase().padEnd(28)} ${snowType(c.type)}`];
      if (!c.nullable) parts.push('NOT NULL');
      const t = tagsFor(pack, fqn, c.name);
      if (t.masking && !t.pending) parts.push(`WITH MASKING POLICY ${db}.GOVERNANCE.${t.masking}`);
      if (t.masking && t.pending) parts.push(`/* masking ${t.masking} pending ${t.pending} */`);
      const tags = [...t.classes.map((cls) => `${db}.GOVERNANCE.SENSITIVITY = ${q(cls)}`), ...(t.cde ? [`${db}.GOVERNANCE.CDE = 'TRUE'`] : [])];
      if (tags.length) parts.push(`WITH TAG (${tags.join(', ')})`);
      return parts.join(' ');
    })
    .join(',\n');
}

function rowAccess(pack: Pack, fqn: string): string {
  const rap = pack.policies.row_access_policies.find((r) => r.bindings.some((b) => b.object === fqn));
  const b = rap?.bindings.find((x) => x.object === fqn);
  return rap && b ? `\n  WITH ROW ACCESS POLICY ${pack.manifest.database}.GOVERNANCE.${rap.id} ON (${b.column.toUpperCase()})` : '';
}

/** The SELECT body of the pack SQL statement that builds `fqn`. */
export function buildStatement(pack: Pack, fqn: string): string | null {
  for (const f of pack.sql) {
    const i = f.sql.indexOf(`TABLE ${fqn} AS`);
    if (i < 0) continue;
    const body = f.sql.slice(i + `TABLE ${fqn} AS`.length);
    const end = body.search(/;\s*(\n|$)/);
    return (end >= 0 ? body.slice(0, end) : body).trim();
  }
  return null;
}

export function renderDdl(pack: Pack, fqn: string, cols: DdlColumn[]): string {
  const db = pack.manifest.database;
  const full = `${db}.${fqn}`;
  const [schema = '', name = ''] = fqn.split('.');
  const lines = columnLines(pack, fqn, cols);
  if (schema === 'RAW_BRONZE') {
    const src = pack.sources.find((s) => s.name === name);
    return `CREATE OR REPLACE ICEBERG TABLE ${full} (\n${lines}\n)\n  CATALOG = 'SNOWFLAKE'\n  EXTERNAL_VOLUME = 'EV_LANDING'\n  BASE_LOCATION = 'cdc/${name.toLowerCase()}/'${rowAccess(pack, fqn)}\n  COMMENT = ${q(`${src?.system ?? 'Source'}: ${src?.description ?? ''}`)};`;
  }
  if (schema === 'CURATED_SILVER' || schema === 'CONFORMED_GOLD') {
    const meta = pack.objects.find((o) => o.fqn === fqn);
    const body = (buildStatement(pack, fqn) ?? `SELECT * FROM ${fqn}`).replace(SCHEMAS, `${db}.$1.$2`);
    const kind = meta?.kind === 'TABLE' ? 'TABLE' : 'DYNAMIC TABLE';
    const lag = kind === 'DYNAMIC TABLE' ? `\n  TARGET_LAG = '${meta?.target_lag ?? '1 hour'}'\n  WAREHOUSE = WH_TRANSFORM_M\n  REFRESH_MODE = INCREMENTAL` : '';
    return `CREATE OR REPLACE ${kind} ${full} (\n${lines}\n)${lag}${rowAccess(pack, fqn)}\n  COMMENT = ${q(meta?.description ?? '')}\nAS\n${body};`;
  }
  if (schema === 'SEMANTIC') {
    const v = pack.semantic.find((x) => x.name === name);
    if (v) {
      const t = v.tables.map((x) => `    ${x.alias} AS ${db}.${x.fqn} PRIMARY KEY (${x.pk.toUpperCase()})`).join(',\n');
      const r = v.relationships.map((x) => `    ${x.from.split('.')[0]} (${x.from.split('.')[1]?.toUpperCase()}) REFERENCES ${x.to.split('.')[0]}`).join(',\n');
      const d = [...v.dimensions, ...v.time_dimensions].map((x) => `    ${x.name} AS ${x.expr}`).join(',\n');
      const m = v.metrics.map((x) => `    ${x.name} AS ${x.expr}${x.synonyms.length ? ` WITH SYNONYMS = (${x.synonyms.map(q).join(', ')})` : ''}`).join(',\n');
      return `CREATE OR REPLACE SEMANTIC VIEW ${full}\n  TABLES (\n${t}\n  )${r ? `\n  RELATIONSHIPS (\n${r}\n  )` : ''}\n  DIMENSIONS (\n${d}\n  )\n  METRICS (\n${m}\n  )\n  COMMENT = ${q(v.description)};`;
    }
  }
  return `CREATE OR REPLACE VIEW ${full} (\n${lines}\n);`;
}
