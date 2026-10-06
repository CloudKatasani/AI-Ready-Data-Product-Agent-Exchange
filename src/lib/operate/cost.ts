/**
 * Cost & Value (01 §M10; ported from AI-Ready `ext/cost.ts` and the marketplace value model). Illustrative
 * only: every rate is a placeholder the presenter can change, and every volume comes from the pack
 * (source row counts, object target lags, products, agents, DQ rules). No real pricing is embedded.
 */
import type { Layer, Pack } from '@/lib/packs/schema';

export type WhSize = 'XS' | 'S' | 'M' | 'L';
export const WH_CREDITS: Record<WhSize, number> = { XS: 1, S: 2, M: 4, L: 8 };

export const COST_RATES = {
  refreshBaseSec: 6,
  refreshSecPerLog10Rows: 7,
  sizeScaling: 0.85,
  dailyJobSec: 45,
  biAvgSec: 3,
  biCacheHit: 0.55,
  queriesPerConsumerDay: 40,
  storageUsdPerMillionRowsMonth: 5,
  tokensPerQuestion: 6800,
  creditsPerMillionTokens: 2,
  sqlPerQuestion: 2,
  sqlSecPerQuery: 1.5,
  dqCreditsPerCheck: 0.001,
  dqRunsPerDay: 24,
};

export interface CostLevers {
  /** Multiplies every target lag (0.25 = four times fresher). */
  lagFactor: number;
  warehouse: WhSize;
  questionsPerDay: number;
  creditPrice: number;
}

export interface CostItem {
  driver: 'Refresh' | 'Transformation jobs' | 'BI and ad-hoc queries' | 'Storage' | 'Agents' | 'Data quality checks';
  layer: Layer;
  label: string;
  ref: string;
  credits: number;
  usd: number;
}

export interface CostResult {
  items: CostItem[];
  total: number;
  byLayer: Partial<Record<Layer, number>>;
  byProduct: { productId: string; usd: number; perConsumer: number; freshnessMin: number; slaMin: number; breach: boolean }[];
  byAgent: { agentId: string; usd: number; questionsPerDay: number; perQuestion: number }[];
}

const LAYER: Record<string, Layer> = { RAW_BRONZE: 'bronze', CURATED_SILVER: 'silver', CONFORMED_GOLD: 'gold' };
const layerOf = (fqn: string): Layer => LAYER[fqn.split('.')[0] ?? ''] ?? 'gold';

/** "5 minutes" / "1 hour" / "1 day" → minutes. */
export function lagMinutes(s: string | undefined): number | undefined {
  const m = s?.match(/(\d+)\s*(minute|min|hour|day)/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  const u = (m[2] ?? '').toLowerCase();
  return u.startsWith('h') ? n * 60 : u.startsWith('d') ? n * 1440 : n;
}

export function defaultLevers(pack: Pack): CostLevers {
  return { lagFactor: 1, warehouse: 'M', questionsPerDay: pack.agents.reduce((a, g) => a + (g.status === 'PRODUCTION' ? 120 : 20), 0), creditPrice: 3 };
}

/** Rows behind an object at scale M: its own source, or the sum of its Bronze ancestors. */
function rowsOf(pack: Pack, fqn: string, seen = new Set<string>()): number {
  if (seen.has(fqn)) return 0;
  seen.add(fqn);
  const src = pack.sources.find((s) => `RAW_BRONZE.${s.name}` === fqn);
  if (src) return src.rows.M;
  const o = pack.objects.find((x) => x.fqn === fqn);
  return o ? o.upstream.reduce((a, u) => a + rowsOf(pack, u, seen), 0) : 0;
}

/** Objects a product depends on, transitively. */
export function productObjects(pack: Pack, productId: string): string[] {
  const p = pack.products.find((x) => x.id === productId);
  const view = p?.semantic_view ? pack.semantic.find((v) => v.name === p.semantic_view) : undefined;
  const out = new Set<string>();
  const walk = (f: string) => {
    if (out.has(f)) return;
    out.add(f);
    pack.objects.find((o) => o.fqn === f)?.upstream.forEach(walk);
  };
  [...(p?.upstream ?? []), ...(view?.tables.map((t) => t.fqn) ?? [])].forEach(walk);
  return [...out].sort();
}

const sizeFactor = (size: WhSize) => Math.pow(WH_CREDITS.M / WH_CREDITS[size], COST_RATES.sizeScaling) * WH_CREDITS[size];

export function computeCost(pack: Pack, lv: CostLevers): CostResult {
  const R = COST_RATES;
  const items: CostItem[] = [];
  const add = (i: Omit<CostItem, 'usd'>) => items.push({ ...i, usd: i.credits * lv.creditPrice });

  for (const s of pack.sources) {
    const fqn = `RAW_BRONZE.${s.name}`;
    items.push({ driver: 'Storage', layer: 'bronze', label: s.name, ref: fqn, credits: 0, usd: (s.rows.M / 1e6) * R.storageUsdPerMillionRowsMonth });
  }
  for (const o of pack.objects) {
    const rows = rowsOf(pack, o.fqn);
    const lag = lagMinutes(o.target_lag);
    if (o.kind === 'DYNAMIC TABLE' && lag) {
      const refreshes = (30 * 1440) / Math.max(1, lag * lv.lagFactor);
      const sec = R.refreshBaseSec + R.refreshSecPerLog10Rows * Math.log10(rows / 1e3 + 1);
      add({ driver: 'Refresh', layer: layerOf(o.fqn), label: o.fqn.split('.')[1] ?? o.fqn, ref: o.fqn, credits: (refreshes * sec * sizeFactor(lv.warehouse)) / 3600 });
    } else if (o.kind === 'TABLE') {
      add({ driver: 'Transformation jobs', layer: layerOf(o.fqn), label: o.fqn.split('.')[1] ?? o.fqn, ref: o.fqn, credits: (30 * R.dailyJobSec * sizeFactor(lv.warehouse)) / 3600 });
    }
  }
  for (const p of pack.products) {
    const q = Math.max(1, p.consumers.length) * R.queriesPerConsumerDay * 30;
    add({ driver: 'BI and ad-hoc queries', layer: 'product', label: p.name, ref: p.id, credits: (q * R.biAvgSec * (1 - R.biCacheHit) * WH_CREDITS.XS) / 3600 });
  }
  const weights = pack.agents.map((a) => (a.status === 'PRODUCTION' ? 120 : 20));
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const byAgent: CostResult['byAgent'] = [];
  pack.agents.forEach((a, i) => {
    const qpd = (lv.questionsPerDay * (weights[i] ?? 0)) / wsum;
    const credits = (qpd * 30 * R.tokensPerQuestion * R.creditsPerMillionTokens) / 1e6 + (qpd * 30 * R.sqlPerQuestion * R.sqlSecPerQuery * WH_CREDITS.S) / 3600;
    add({ driver: 'Agents', layer: 'agent', label: a.name, ref: a.id, credits });
    byAgent.push({ agentId: a.id, usd: credits * lv.creditPrice, questionsPerDay: Math.round(qpd), perQuestion: qpd ? (credits * lv.creditPrice) / (qpd * 30) : 0 });
  });
  add({ driver: 'Data quality checks', layer: 'governance', label: `${pack.dq.length} rules × ${R.dqRunsPerDay}/day`, ref: 'GOVERNANCE.DQ', credits: pack.dq.length * R.dqRunsPerDay * 30 * R.dqCreditsPerCheck });

  const byLayer: CostResult['byLayer'] = {};
  for (const i of items) byLayer[i.layer] = (byLayer[i.layer] ?? 0) + i.usd;
  const total = items.reduce((a, i) => a + i.usd, 0);

  const sharedBy = new Map<string, number>();
  const deps = new Map(pack.products.map((p) => [p.id, productObjects(pack, p.id)]));
  for (const list of deps.values()) for (const f of list) sharedBy.set(f, (sharedBy.get(f) ?? 0) + 1);
  const byProduct = pack.products.map((p) => {
    const objs = new Set(deps.get(p.id));
    const usd = items.filter((i) => i.ref === p.id || objs.has(i.ref)).reduce((a, i) => a + (i.ref === p.id ? i.usd : i.usd / (sharedBy.get(i.ref) ?? 1)), 0);
    const lags = [...objs].map((f) => lagMinutes(pack.objects.find((o) => o.fqn === f)?.target_lag)).filter((x): x is number => x !== undefined);
    const freshnessMin = lags.length ? Math.round(Math.max(...lags) * lv.lagFactor) : 0;
    return { productId: p.id, usd, perConsumer: usd / Math.max(1, p.consumers.length), freshnessMin, slaMin: p.sla.freshness_minutes, breach: freshnessMin > p.sla.freshness_minutes };
  });
  return { items, total, byLayer, byProduct, byAgent };
}

export interface ValueRollup {
  cases: { id: string; productId: string; hypothesis: string; annual: number; measured: number | null; confidence: string | null; annualCost: number; roi: number | null }[];
  annualValue: number;
  measuredValue: number;
  annualCost: number;
}

/** Value cases per product with the product's annualised illustrative run cost; portfolio roll-up. */
export function valueRollup(pack: Pack, cost: CostResult): ValueRollup {
  const cases = pack.value.map((v) => {
    const annualCost = (cost.byProduct.find((p) => p.productId === v.product)?.usd ?? 0) * 12;
    return { id: v.id, productId: v.product, hypothesis: v.hypothesis, annual: v.annual_value_usd, measured: v.measured?.value_usd ?? null, confidence: v.measured?.confidence ?? null, annualCost, roi: annualCost ? v.annual_value_usd / annualCost : null };
  });
  return { cases, annualValue: cases.reduce((a, c) => a + c.annual, 0), measuredValue: cases.reduce((a, c) => a + (c.measured ?? 0), 0), annualCost: cost.total * 12 };
}
