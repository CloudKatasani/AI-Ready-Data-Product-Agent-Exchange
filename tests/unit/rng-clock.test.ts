import { describe, expect, it } from 'vitest';
import { clockFor, dayParts, epochDayToIso, isoToEpochDay, resolveDay } from '@/lib/warehouse/clock';
import { hashSeed, mulberry32, Rng } from '@/lib/warehouse/rng';

describe('rng', () => {
  it('mulberry32 is a pure function of the seed (ported AI-Ready stream)', () => {
    const a = mulberry32(20261003);
    const b = mulberry32(20261003);
    const xs = Array.from({ length: 5 }, () => a());
    expect(xs).toEqual(Array.from({ length: 5 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('hashSeed separates streams by part and order', () => {
    expect(hashSeed(1, 'T', 'c')).toBe(hashSeed(1, 'T', 'c'));
    expect(hashSeed(1, 'T', 'c')).not.toBe(hashSeed(1, 'Tc'));
    expect(hashSeed(1, 'a', 'b')).not.toBe(hashSeed(1, 'b', 'a'));
  });

  it('weighted picks follow weights and poisson/lognormal are sane', () => {
    const r = new Rng(7);
    const n = 20000;
    let hits = 0;
    for (let i = 0; i < n; i++) if (r.weighted(['x', 'y'], [9, 1]) === 'x') hits++;
    expect(hits / n).toBeGreaterThan(0.88);
    expect(hits / n).toBeLessThan(0.92);
    let sum = 0;
    for (let i = 0; i < n; i++) sum += r.poisson(4);
    expect(sum / n).toBeGreaterThan(3.9);
    expect(sum / n).toBeLessThan(4.1);
    expect(r.lognormal(0, 0)).toBeCloseTo(1);
  });
});

describe('pack clock', () => {
  it('round-trips ISO dates through epoch days', () => {
    expect(isoToEpochDay('1970-01-02')).toBe(1);
    expect(epochDayToIso(isoToEpochDay('2026-09-30'))).toBe('2026-09-30');
  });

  it('resolves the asOf keyword and day parts', () => {
    const clock = clockFor('2026-09-30');
    expect(resolveDay('asOf', clock)).toBe(clock.asOfDay);
    expect(dayParts(isoToEpochDay('2026-09-30'))).toEqual({ month: 8, weekday: 2, year: 2026 });
    expect(() => isoToEpochDay('not-a-date')).toThrow();
  });
});
