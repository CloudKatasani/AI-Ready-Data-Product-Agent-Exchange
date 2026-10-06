/** Warehouse abstraction (02-architecture §4). DuckDB in v1; Snowflake behind the same interface later. */
export type CellValue = string | number | boolean | null;

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
}

export interface QueryResult {
  columns: { name: string; type: string }[];
  rows: CellValue[][];
  rowCount: number;
  elapsedMs: number;
  truncated: boolean;
}

export interface QueryOptions {
  timeoutMs?: number;
  maxRows?: number;
}

export interface WarehouseAdapter {
  dialect: 'duckdb' | 'snowflake';
  query(sql: string, params?: CellValue[], opts?: QueryOptions): Promise<QueryResult>;
  describe(fqn: string): Promise<ColumnInfo[]>;
  close(): Promise<void>;
}

export type AppendColumnType = 'VARCHAR' | 'INTEGER' | 'BIGINT' | 'DOUBLE' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP';

/** Build-time capabilities (warehouse build only — never handed to request handlers). */
export interface WarehouseBuilder extends WarehouseAdapter {
  exec(sql: string): Promise<void>;
  /**
   * Bulk-loads rows into an existing table. Values are column-major; DATE = epoch day, TIMESTAMP = epoch seconds.
   * `types` gives the append type per column (DECIMAL columns append as DOUBLE).
   */
  append(fqn: string, types: AppendColumnType[], columns: CellValue[][], rowCount: number): Promise<void>;
}
