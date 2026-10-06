import { describe, expect, it } from 'vitest';
import { compileFormula, formulaColumns } from '@/lib/packs/formula';

const row = (vals: Record<string, string | number | boolean | null>) => (name: string) => vals[name] ?? null;

describe('safe formula evaluator', () => {
  it('handles arithmetic, precedence and parentheses', () => {
    expect(compileFormula('1 + 2 * 3')(row({}))).toBe(7);
    expect(compileFormula('(1 + 2) * 3')(row({}))).toBe(9);
    expect(compileFormula('-a + 10 % 4')(row({ a: 3 }))).toBe(-1);
  });

  it('reads columns, compares and branches', () => {
    expect(compileFormula('kwh / 24 * 2.4')(row({ kwh: 48 }))).toBeCloseTo(4.8);
    expect(compileFormula('if(billed > 175, billed * 0.35, 0)')(row({ billed: 200 }))).toBeCloseTo(70);
    expect(compileFormula("status == 'A' ? 1 : 0")(row({ status: 'A' }))).toBe(1);
    expect(compileFormula('a >= 2 && !b')(row({ a: 2, b: false }))).toBe(true);
  });

  it('supports min/max/round/coalesce and treats division by zero as null', () => {
    expect(compileFormula('round(max(1, a, 3) / 7, 2)')(row({ a: 10 }))).toBe(1.43);
    expect(compileFormula('coalesce(x, 5)')(row({ x: null }))).toBe(5);
    expect(compileFormula('1 / 0')(row({}))).toBeNull();
  });

  it('rejects unknown columns, unknown functions and garbage', () => {
    expect(() => compileFormula('a + b', new Set(['a']))).toThrow(/Unknown column "b"/);
    expect(() => compileFormula('process(1)')).toThrow(/Unknown function/);
    expect(() => compileFormula('1 +')).toThrow();
    expect(() => compileFormula('a; b')).toThrow();
  });

  it('lists referenced columns', () => {
    expect(formulaColumns('round(a * b, 2) + if(c, 1, 0)')).toEqual(['a', 'b', 'c']);
  });
});
