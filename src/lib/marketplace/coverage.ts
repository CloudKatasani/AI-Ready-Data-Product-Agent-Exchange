/**
 * "Can I answer it?" (01 §M5): for each KPI, whether some agent covers it and the persona is entitled to
 * a product exposing its metric — with the reason (the agent it would go via, or the product it needs).
 */
import type { Pack } from '@/lib/packs/schema';
import type { Principal } from '@/lib/query/types';

export interface KpiCoverage {
  kpiId: string;
  name: string;
  answerable: boolean;
  viaAgent?: { id: string; name: string };
  needsProduct?: { id: string; name: string };
}

export function kpiCoverage(pack: Pack, who: Principal): KpiCoverage[] {
  return pack.kpis.map((k) => {
    const agents = pack.agents.filter((a) => a.kpi_coverage.some((c) => c.kpi === k.id));
    const products = k.products;
    const entitled = products.find((p) => who.entitlements.includes(p));
    const agent = agents.find((a) => a.products.some((b) => b.id === entitled)) ?? agents[0];
    const name = (id: string) => pack.products.find((p) => p.id === id)?.name ?? id;
    if (entitled && agent) return { kpiId: k.id, name: k.name, answerable: true, viaAgent: { id: agent.id, name: agent.name } };
    const need = products[0];
    return { kpiId: k.id, name: k.name, answerable: false, ...(agent ? { viaAgent: { id: agent.id, name: agent.name } } : {}), ...(need ? { needsProduct: { id: need, name: name(need) } } : {}) };
  });
}
