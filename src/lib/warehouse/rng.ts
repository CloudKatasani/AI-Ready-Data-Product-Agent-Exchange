/**
 * Seeded PRNG — ported from AI-Ready `src/mock-snowflake/rng.ts` (mulberry32). Same seed ⇒ same stream.
 * Engines never use Math.random (invariant I08).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the parts, used to derive independent per-table/per-column streams from the pack seed. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261;
  for (const part of parts) {
    for (const ch of `${String(part)}\u0000`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return h >>> 0;
}

export class Rng {
  private next: () => number;

  constructor(seed: number) {
    this.next = mulberry32(seed);
  }

  float(): number {
    return this.next();
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[Math.floor(this.next() * items.length)];
    if (item === undefined) throw new Error('pick from empty list');
    return item;
  }

  /** Index into a cumulative weight table (binary search). */
  pickCumulative(cumulative: Float64Array): number {
    const total = cumulative[cumulative.length - 1] ?? 0;
    const r = this.next() * total;
    let lo = 0;
    let hi = cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((cumulative[mid] ?? 0) > r) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    return items[this.pickCumulative(cumulativeOf(weights))] as T;
  }

  /** Standard normal via Box–Muller. */
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Log-normal with `mu`/`sigma` of the underlying normal. */
  lognormal(mu: number, sigma: number): number {
    return Math.exp(this.normal(mu, sigma));
  }

  poisson(lambda: number): number {
    if (lambda > 30) return Math.max(0, Math.round(this.normal(lambda, Math.sqrt(lambda))));
    const l = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= this.next();
    } while (p > l);
    return k - 1;
  }
}

export function cumulativeOf(weights: readonly number[]): Float64Array {
  const out = new Float64Array(weights.length);
  let acc = 0;
  weights.forEach((w, i) => {
    acc += w;
    out[i] = acc;
  });
  return out;
}
