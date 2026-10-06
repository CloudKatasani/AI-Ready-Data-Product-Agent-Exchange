import type { SourceTable } from '@/lib/packs/schema';

/** A generated cell. DATE = epoch day, TIMESTAMP = epoch seconds (UTC). */
export type Cell = string | number | boolean | null;

export interface GeneratedTable {
  spec: SourceTable;
  /** Column-major values for the declared columns (base rows, then CDC noise rows). */
  data: Cell[][];
  /** Parent-row index picked by each `fk` column (base rows only), for `derive_from`. */
  fkIndex: Map<string, Int32Array>;
  /** CDC operation per row: I (insert), U (duplicate update), D (tombstone). */
  ops: ('I' | 'U' | 'D')[];
  /** `_loaded_at` per row, epoch seconds. */
  loadedAt: number[];
  /** Number of base (pre-noise) rows. */
  baseRows: number;
}
