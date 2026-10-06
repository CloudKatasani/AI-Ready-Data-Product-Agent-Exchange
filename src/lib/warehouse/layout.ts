import type { Layer } from '@/lib/packs/schema';

/** DuckDB schemas mirror the nine layers (03-data-model §2). */
export const LAYER_SCHEMAS: Record<Layer, string> = {
  bronze: 'RAW_BRONZE',
  silver: 'CURATED_SILVER',
  gold: 'CONFORMED_GOLD',
  semantic: 'SEMANTIC',
  glossary: 'GLOSSARY',
  context: 'CONTEXT',
  product: 'DATA_PRODUCTS',
  agent: 'AGENTS',
  governance: 'GOVERNANCE',
};

export const SCHEMA_LAYERS: Record<string, Layer> = Object.fromEntries(Object.entries(LAYER_SCHEMAS).map(([layer, schema]) => [schema, layer as Layer]));

export const CDC_COLUMNS = ['_op', '_loaded_at'] as const;

/** Masking macros created at build (05 §2.3). Masking applies to row-level projections only. */
export const MASKING_MACROS: Record<string, string> = {
  mask_pii: "CASE WHEN v IS NULL THEN NULL ELSE '•••' END",
  mask_email: "CASE WHEN v IS NULL THEN NULL ELSE concat(substr(md5(split_part(v, '@', 1)), 1, 6), '@', split_part(v, '@', 2)) END",
  mask_phone: "CASE WHEN v IS NULL THEN NULL ELSE concat('•••-•••-', right(CAST(v AS VARCHAR), 4)) END",
  mask_pci: "CASE WHEN v IS NULL THEN NULL ELSE concat('•••• ', right(regexp_replace(CAST(v AS VARCHAR), '[^0-9]', '', 'g'), 4)) END",
  mask_gov_id: "CASE WHEN v IS NULL THEN NULL ELSE concat('***-**-', right(CAST(v AS VARCHAR), 4)) END",
  mask_redact: "CASE WHEN v IS NULL THEN NULL ELSE '[redacted]' END",
};
