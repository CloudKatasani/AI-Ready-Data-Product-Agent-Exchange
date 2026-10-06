import type { Pack } from '@/lib/packs/schema';
import type { Principal } from './types';

/** Builds a Principal from a pack persona and its live entitlements (product ids). */
export function principalFor(pack: Pack, personaId: string, entitlements?: string[]): Principal {
  const p = pack.personas.find((x) => x.id === personaId);
  if (!p) throw new Error(`Unknown persona ${personaId} in pack ${pack.manifest.id}`);
  const seeded = pack.policies.grants.find((g) => g.persona === personaId)?.products ?? [];
  return {
    packId: pack.manifest.id,
    personaId: p.id,
    archetype: p.archetype,
    roles: p.roles,
    rowFilters: p.row_filter ? [p.row_filter] : [],
    unmasked: p.unmasked,
    entitlements: [...new Set([...(entitlements ?? seeded), ...pack.policies.public_products])].sort(),
    aggregatesOnly: p.aggregates_only,
  };
}

/** A system principal for platform jobs (DQ, profiling, validator): sees everything, still logged. */
export function systemPrincipal(pack: Pack): Principal {
  return {
    packId: pack.manifest.id,
    personaId: `${pack.manifest.id}:system`,
    archetype: 'D',
    roles: ['PLATFORM_ADMIN'],
    rowFilters: [],
    unmasked: ['PII', 'PHI', 'PCI', 'CPNI', 'NPI', 'GOV_ID', 'TRADE_SECRET'],
    entitlements: pack.products.map((x) => x.id),
    aggregatesOnly: false,
  };
}
