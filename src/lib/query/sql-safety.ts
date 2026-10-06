/**
 * Worksheet SQL safety (05 §3, ADR-0014): DuckDB parses the text (never executes it here); exactly one
 * SELECT is accepted; deny-listed functions and every table function are rejected; table references are
 * collected with their character offsets so the policy engine can rewrite them.
 */
import type { WarehouseAdapter } from '@/lib/warehouse/adapter';

export interface TableRef {
  fqn: string;
  alias: string;
  /** Character offset and length of the reference in the original SQL. */
  start: number;
  length: number;
}

export type SafetyResult = { ok: true; tables: TableRef[] } | { ok: false; reason: string; hint: string };

const DENY_FUNCTION = /^(read_.*|glob|system|pragma_.*|current_setting|getenv|query|query_table|sniff_csv|parquet_.*|json_execute_serialized_sql|duckdb_.*|load_extension|install_extension)$/i;

const fail = (reason: string, hint: string): SafetyResult => ({ ok: false, reason, hint });

type Node = Record<string, unknown>;

function walk(node: unknown, visit: (n: Node) => void): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === 'object') {
    visit(node as Node);
    for (const v of Object.values(node)) walk(v, visit);
  }
}

/** Parses and checks worksheet SQL against the known object list. */
export async function checkWorksheetSql(sql: string, w: WarehouseAdapter, knownObjects: ReadonlySet<string>): Promise<SafetyResult> {
  if (sql.trim().length === 0) return fail('The worksheet is empty.', 'Write a SELECT query, for example SELECT * FROM SCHEMA.OBJECT LIMIT 10.');
  if (sql.length > 20_000) return fail('The query is too long for the worksheet.', 'Keep worksheet queries under 20,000 characters.');
  const r = await w.query('SELECT json_serialize_sql(CAST(? AS VARCHAR))', [sql]);
  let parsed: { error: boolean; error_message?: string; statements?: unknown[] };
  try {
    parsed = JSON.parse(String(r.rows[0]?.[0] ?? '{}')) as typeof parsed;
  } catch {
    return fail('The query could not be parsed.', 'Check the SQL syntax.');
  }
  if (parsed.error) {
    const msg = parsed.error_message ?? '';
    if (/Only SELECT statements/i.test(msg)) {
      return fail('Only read-only SELECT queries can run in the worksheet.', 'Statements such as INSERT, UPDATE, DELETE, CREATE, COPY, ATTACH, INSTALL, SET or PRAGMA are not allowed here.');
    }
    return fail(`The query has a syntax error: ${msg}`, 'Check the SQL near the position mentioned.');
  }
  const statements = parsed.statements ?? [];
  if (statements.length !== 1) return fail('Run one statement at a time.', 'Remove the extra statements (the ";" separators).');

  const cteNames = new Set<string>();
  const tables: { schema: string; table: string; alias: string; location: number }[] = [];
  let denied: string | null = null;
  walk(statements[0], (n) => {
    const cte = n.cte_map as { map?: { key: string }[] } | undefined;
    for (const e of cte?.map ?? []) cteNames.add(e.key.toUpperCase());
    if (n.type === 'TABLE_FUNCTION') denied ??= String((n.function as Node | undefined)?.function_name ?? 'table function');
    if (n.class === 'FUNCTION' && typeof n.function_name === 'string' && DENY_FUNCTION.test(n.function_name)) denied ??= n.function_name;
    if (n.type === 'BASE_TABLE') {
      tables.push({ schema: String(n.schema_name ?? ''), table: String(n.table_name ?? ''), alias: String(n.alias ?? ''), location: Number(n.query_location ?? -1) });
    }
  });
  if (denied) return fail(`The function ${denied}() is not allowed in the worksheet.`, 'File, system and table functions are disabled; query warehouse objects by name instead.');

  const refs: TableRef[] = [];
  for (const t of tables) {
    if (!t.schema && cteNames.has(t.table.toUpperCase())) continue;
    if (!t.schema) return fail(`Qualify ${t.table} with its schema.`, `Write SCHEMA.OBJECT, for example CONFORMED_GOLD.${t.table.toUpperCase()}.`);
    const fqn = `${t.schema.toUpperCase()}.${t.table.toUpperCase()}`;
    if (!knownObjects.has(fqn)) return fail(`${fqn} is not an object in this warehouse.`, 'Browse the Explorer tree for available objects.');
    const m = /^("?)([A-Za-z_][\w$]*)\1\s*\.\s*("?)([A-Za-z_][\w$]*)\3/.exec(sql.slice(t.location));
    if (t.location < 0 || !m) return fail('The query could not be prepared for governance.', 'Write table references as SCHEMA.OBJECT without a catalog prefix.');
    refs.push({ fqn, alias: t.alias, start: t.location, length: m[0].length });
  }
  return { ok: true, tables: refs };
}

/** Replaces each table reference with its governed source (right to left so offsets stay valid). */
export function rewriteTables(sql: string, refs: TableRef[], sourceFor: (ref: TableRef) => string): string {
  let out = sql;
  for (const ref of [...refs].sort((a, b) => b.start - a.start)) {
    const replacement = sourceFor(ref);
    if (replacement === ref.fqn) continue;
    const named = ref.alias ? replacement : `${replacement} AS "${ref.fqn.split('.')[1]}"`;
    out = `${out.slice(0, ref.start)}${named}${out.slice(ref.start + ref.length)}`;
  }
  return out;
}
