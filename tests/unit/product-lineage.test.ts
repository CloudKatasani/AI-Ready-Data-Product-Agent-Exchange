import { describe, expect, it } from 'vitest';
import { lineageAround, productForObject, REGISTRY_FQN, registryLineage } from '@/lib/packs/lineage';
import { getPack, listPackIds } from '@/lib/packs/registry';

/** Every DATA_PRODUCTS object has lineage back to its sources, in every pack. */
describe('data product lineage', () => {
  for (const id of listPackIds()) {
    it(`${id}: each product's SQL output port traces to its product and down to Bronze`, () => {
      const pack = getPack(id);
      for (const p of pack.products) {
        for (const port of p.output_ports.filter((o) => o.kind === 'sql')) {
          expect(productForObject(pack, port.ref)?.id).toBe(p.id);
          const g = lineageAround(pack, port.ref);
          expect(g.edges).toContainEqual({ from: p.id, to: port.ref });
          if (p.semantic_view || p.upstream.length) expect(g.nodes.length, `${p.id} ${port.ref}`).toBeGreaterThan(2);
        }
      }
      const reg = registryLineage(pack);
      expect(reg.nodes.map((n) => n.id)).toEqual([REGISTRY_FQN, ...pack.products.map((p) => p.id)]);
    });
  }
});
