/**
 * Policy engine (05 §2): entitlement, row access, masking, incident effects (Phase 7), limits.
 * Applied by QueryService to every request kind. Pure functions over pack + principal.
 */
import type { Pack, Role, SensitiveClass } from '@/lib/packs/schema';
import { type PolicyApplication, PolicyDenied, type Principal } from './types';

/** Roles that may read raw (Bronze/Silver) layers in Explorer and the worksheet. */
const RAW_LAYER_ROLES: Role[] = ['ANALYST', 'DATA_ENGINEER', 'DOMAIN_PRODUCT_OWNER', 'DATA_STEWARD', 'PLATFORM_ADMIN'];
/** Roles that bypass product entitlements (still logged). */
const BYPASS_ROLES: Role[] = ['DATA_STEWARD', 'PLATFORM_ADMIN'];
const RAW_SCHEMAS = ['RAW_BRONZE', 'CURATED_SILVER'];
const METADATA_SCHEMAS = ['GLOSSARY', 'CONTEXT', 'AGENTS', 'GOVERNANCE'];

/** Demo-state inputs the policy engine depends on (certification fixes applied; open incidents from Phase 7). */
export interface PolicyState {
  appliedFixes: string[];
}

export const EMPTY_STATE: PolicyState = { appliedFixes: [] };

export function sqlLiteral(v: string | number | boolean): string {
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return `'${v.replace(/'/g, "''")}'`;
}

/** Products an object belongs to: semantic-view tables, upstream objects and SQL output ports. */
export function productsForObject(pack: Pack, fqn: string): string[] {
  const out = new Set<string>();
  for (const p of pack.products) {
    if (p.upstream.includes(fqn) || p.output_ports.some((o) => o.kind === 'sql' && o.ref === fqn)) out.add(p.id);
    const view = p.semantic_view ? pack.semantic.find((v) => v.name === p.semantic_view) : undefined;
    if (view?.tables.some((t) => t.fqn === fqn) || fqn === `SEMANTIC.${p.semantic_view}`) out.add(p.id);
  }
  return [...out].sort();
}

const hasRole = (p: Principal, roles: Role[]) => p.roles.some((r) => roles.includes(r));

/**
 * Entitlement for touching objects. `required` is a list of alternatives per object: the principal needs
 * one entitled product from each non-empty set. Throws PolicyDenied with a requestable product.
 */
export function checkEntitlement(pack: Pack, who: Principal, objects: string[], opts: { rowLevel: boolean; requiredProducts?: string[] }): PolicyApplication[] {
  const applied: PolicyApplication[] = [];
  if (opts.rowLevel && who.aggregatesOnly) throw new PolicyDenied('This persona sees aggregates only; row-level data is not available.', null, false);
  const bypass = hasRole(who, BYPASS_ROLES);
  const sets: { target: string; products: string[] }[] = [];
  if (opts.requiredProducts?.length) sets.push({ target: opts.requiredProducts.join(','), products: opts.requiredProducts });
  else {
    for (const fqn of objects) {
      const schema = fqn.split('.')[0] ?? '';
      if (METADATA_SCHEMAS.includes(schema)) continue;
      if (RAW_SCHEMAS.includes(schema)) {
        if (!hasRole(who, RAW_LAYER_ROLES)) throw new PolicyDenied(`${fqn} is a raw-layer object; it is visible to builders and analysts only.`, null, false);
        applied.push({ kind: 'entitlement', target: fqn, detail: 'raw-layer access by role' });
        continue;
      }
      const products = productsForObject(pack, fqn);
      if (products.length) sets.push({ target: fqn, products });
    }
  }
  for (const s of sets) {
    const granted = s.products.find((p) => who.entitlements.includes(p));
    if (granted) applied.push({ kind: 'entitlement', target: s.target, detail: `entitled via ${granted}`, ruleOrPolicyId: granted });
    else if (bypass) applied.push({ kind: 'entitlement', target: s.target, detail: 'steward bypass (logged)', ruleOrPolicyId: s.products[0] });
    else {
      const product = s.products[0] ?? null;
      const name = pack.products.find((p) => p.id === product)?.name ?? product;
      throw new PolicyDenied(`You don't have access to ${name}. You can request it.`, product, true);
    }
  }
  return applied;
}

/** Row-access predicate for one object, or null when no policy binds it for this principal. */
export function rowFilterFor(pack: Pack, who: Principal, fqn: string): { predicate: string; policyId: string; detail: string } | null {
  for (const rf of who.rowFilters) {
    const rap = pack.policies.row_access_policies.find((r) => r.dimension === rf.dimension && r.bindings.some((b) => b.object === fqn));
    const binding = rap?.bindings.find((b) => b.object === fqn);
    if (rap && binding) {
      return {
        predicate: `"${binding.column}" IN (${rf.allowed.map(sqlLiteral).join(', ')})`,
        policyId: rap.id,
        detail: `${rf.dimension} in (${rf.allowed.join(', ')})`,
      };
    }
  }
  return null;
}

const DEFAULT_MACRO: Partial<Record<SensitiveClass, string>> = { PII: 'mask_pii', PCI: 'mask_pci', GOV_ID: 'mask_gov_id' };

export interface MaskSpec {
  macro: string;
  policyId: string;
  classes: SensitiveClass[];
}

/** Masking for one column, or null if the principal may see it in clear (or masking is not attached yet). */
export function maskFor(pack: Pack, who: Principal, columnFqn: string, state: PolicyState = EMPTY_STATE): MaskSpec | null {
  const [schema, obj, col] = columnFqn.split('.');
  let classes: SensitiveClass[] = [];
  let policyId: string | undefined;
  const tag = pack.policies.column_tags.find((t) => t.column === columnFqn);
  if (tag) {
    classes = tag.classes;
    policyId = tag.masking;
    if (tag.mask_pending_fix && !state.appliedFixes.includes(tag.mask_pending_fix)) return null;
  } else if (schema === 'RAW_BRONZE') {
    classes = pack.sources.find((s) => s.name === obj)?.columns.find((c) => c.name === col)?.tags ?? [];
  }
  const hidden = classes.filter((c) => !who.unmasked.includes(c));
  if (hidden.length === 0) return null;
  const policy = policyId ? pack.policies.masking_policies.find((m) => m.id === policyId) : pack.policies.masking_policies.find((m) => m.class === hidden[0]);
  const macro = policy?.macro ?? DEFAULT_MACRO[hidden[0] as SensitiveClass] ?? 'mask_redact';
  return { macro, policyId: policy?.id ?? `MASK_${hidden[0]}`, classes: hidden };
}

/**
 * Source-level governance for row-level reads (preview, worksheet): a subquery that applies masking to
 * every tagged column and the row-access predicate. Returns the FROM item text plus what was applied.
 */
export function governedSource(
  pack: Pack,
  who: Principal,
  fqn: string,
  columns: string[],
  state: PolicyState = EMPTY_STATE,
): { sql: string; masked: string[]; applied: PolicyApplication[]; rowFiltered: boolean } {
  const applied: PolicyApplication[] = [];
  const masked: string[] = [];
  const projections = columns.map((c) => {
    const m = maskFor(pack, who, `${fqn}.${c}`, state);
    if (!m) return `"${c}"`;
    masked.push(c);
    applied.push({ kind: 'masking', target: `${fqn}.${c}`, detail: `${m.classes.join(', ')} masked with ${m.macro}`, ruleOrPolicyId: m.policyId });
    return `GOVERNANCE.${m.macro}("${c}") AS "${c}"`;
  });
  const rf = rowFilterFor(pack, who, fqn);
  if (rf) applied.push({ kind: 'row_access', target: fqn, detail: rf.detail, ruleOrPolicyId: rf.policyId });
  if (masked.length === 0 && !rf) return { sql: fqn, masked, applied, rowFiltered: false };
  return { sql: `(SELECT ${projections.join(', ')} FROM ${fqn}${rf ? ` WHERE ${rf.predicate}` : ''})`, masked, applied, rowFiltered: Boolean(rf) };
}
