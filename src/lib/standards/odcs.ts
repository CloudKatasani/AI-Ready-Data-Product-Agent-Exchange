/**
 * Open Data Contract Standard (ODCS v3) export for a data product: fundamentals, schema (from the
 * product's output objects with tags, glossary terms and masking), quality rules, SLA, roles and
 * support. Column types come from the warehouse catalog when supplied.
 */
import { stringify } from 'yaml';
import { productObjects, productRules } from '@/lib/lifecycle/quality';
import type { DataProduct, Pack } from '@/lib/packs/schema';

export interface ContractColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export function odcsContract(pack: Pack, product: DataProduct, version: string, status: string, columns: Record<string, ContractColumn[]>): Record<string, unknown> {
  const tags = new Map(pack.policies.column_tags.map((t) => [t.column, t]));
  const terms = new Map(pack.glossary.flatMap((t) => t.mappings.columns.map((c) => [c, t] as const)));
  const persona = (id: string | null) => pack.personas.find((p) => p.id === id);
  const objects = productObjects(pack, product).filter((o) => !o.startsWith('RAW_BRONZE.'));
  return {
    apiVersion: 'v3.0.0',
    kind: 'DataContract',
    id: `${pack.manifest.id}:${product.id}`,
    name: product.name,
    version,
    status: status.toLowerCase(),
    domain: product.domain,
    dataProduct: product.id,
    tenant: pack.manifest.company.name,
    description: { purpose: product.purpose, usage: product.decision.decision, limitations: 'Synthetic demo data.' },
    schema: objects.map((fqn) => ({
      name: fqn.split('.')[1],
      physicalName: `${pack.manifest.database}.${fqn}`,
      logicalType: 'object',
      properties: (columns[fqn] ?? []).map((c) => {
        const tag = tags.get(`${fqn}.${c.name}`);
        const term = terms.get(`${fqn}.${c.name}`);
        return {
          name: c.name,
          physicalType: c.type,
          required: !c.nullable,
          ...(tag?.classes?.length ? { classification: tag.classes.join(','), tags: tag.classes } : {}),
          ...(tag?.masking ? { customProperties: [{ property: 'maskingPolicy', value: tag.masking }] } : {}),
          ...(tag?.cde ? { criticalDataElement: true } : {}),
          ...(term ? { businessName: term.name, authoritativeDefinitions: [{ type: 'businessDefinition', url: `glossary:${term.id}` }] } : {}),
        };
      }),
    })),
    quality: productRules(pack, product).map((r) => ({ id: r.id, type: 'custom', engine: 'keystone-dq', dimension: r.dimension, description: r.description, implementation: `${r.object}${r.column ? `.${r.column}` : ''}: ${r.assertion}`, severity: r.severity })),
    slaProperties: [
      { property: 'freshness', value: product.sla.freshness_minutes, unit: 'm' },
      { property: 'availability', value: product.sla.availability_pct, unit: '%' },
      { property: 'maxNullRate', value: product.sla.max_null_rate_pct, unit: '%' },
    ],
    team: [
      { role: 'owner', username: product.owner, name: persona(product.owner)?.name },
      ...(product.steward ? [{ role: 'steward', username: product.steward, name: persona(product.steward)?.name }] : []),
    ],
    servers: product.output_ports.map((o) => ({ server: o.kind, type: o.kind === 'sql' || o.kind === 'semantic' ? 'snowflake' : o.kind, ref: o.ref })),
    customProperties: [
      { property: 'kpis', value: product.kpis },
      { property: 'semanticView', value: product.semantic_view },
    ],
  };
}

export function odcsYaml(contract: Record<string, unknown>): string {
  return stringify(contract, { lineWidth: 0 });
}
