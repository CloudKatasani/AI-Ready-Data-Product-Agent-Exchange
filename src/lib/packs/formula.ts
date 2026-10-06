/**
 * Safe expression evaluator for `formula` generator columns (04 §5) — no `eval`, no globals.
 * Grammar: numbers, 'strings', true/false/null, column names, + - * / %, comparisons, && || !,
 * `cond ? a : b`, and functions min, max, abs, round(x, d?), floor, ceil, if(c, a, b), coalesce(a, b).
 */
export type Scalar = string | number | boolean | null;
export type Row = (name: string) => Scalar;
export type Compiled = (row: Row) => Scalar;

type Token = { t: 'num'; v: number } | { t: 'str'; v: string } | { t: 'id'; v: string } | { t: 'op'; v: string };

const OPS = ['&&', '||', '==', '!=', '<=', '>=', '<', '>', '+', '-', '*', '/', '%', '!', '?', ':', '(', ')', ','];

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i++;
    } else if (/[0-9.]/.test(c)) {
      const m = /^\d*\.?\d+(?:e[+-]?\d+)?/i.exec(src.slice(i));
      if (!m) throw new Error(`Bad number at ${i} in "${src}"`);
      out.push({ t: 'num', v: Number(m[0]) });
      i += m[0].length;
    } else if (c === "'") {
      const end = src.indexOf("'", i + 1);
      if (end < 0) throw new Error(`Unterminated string in "${src}"`);
      out.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
    } else if (/[a-z_]/i.test(c)) {
      const m = /^[a-z_][a-z0-9_]*/i.exec(src.slice(i)) as RegExpExecArray;
      out.push({ t: 'id', v: m[0] });
      i += m[0].length;
    } else {
      const op = OPS.find((o) => src.startsWith(o, i));
      if (!op) throw new Error(`Unexpected "${c}" in "${src}"`);
      out.push({ t: 'op', v: op });
      i += op.length;
    }
  }
  return out;
}

const num = (v: Scalar): number => (typeof v === 'number' ? v : typeof v === 'boolean' ? (v ? 1 : 0) : v === null ? 0 : Number(v));
const truthy = (v: Scalar): boolean => (typeof v === 'number' ? v !== 0 : Boolean(v));

const FUNCS: Record<string, (args: Scalar[]) => Scalar> = {
  min: (a) => Math.min(...a.map(num)),
  max: (a) => Math.max(...a.map(num)),
  abs: (a) => Math.abs(num(a[0] ?? 0)),
  floor: (a) => Math.floor(num(a[0] ?? 0)),
  ceil: (a) => Math.ceil(num(a[0] ?? 0)),
  round: (a) => {
    const f = 10 ** num(a[1] ?? 0);
    return Math.round(num(a[0] ?? 0) * f) / f;
  },
  if: (a) => (truthy(a[0] ?? null) ? (a[1] ?? null) : (a[2] ?? null)),
  coalesce: (a) => a.find((v) => v !== null) ?? null,
};

const BINARY: Record<string, { prec: number; fn: (a: Scalar, b: Scalar) => Scalar }> = {
  '||': { prec: 1, fn: (a, b) => truthy(a) || truthy(b) },
  '&&': { prec: 2, fn: (a, b) => truthy(a) && truthy(b) },
  '==': { prec: 3, fn: (a, b) => a === b || (typeof a !== 'string' && typeof b !== 'string' && num(a) === num(b)) },
  '!=': { prec: 3, fn: (a, b) => !(a === b || (typeof a !== 'string' && typeof b !== 'string' && num(a) === num(b))) },
  '<': { prec: 4, fn: (a, b) => num(a) < num(b) },
  '>': { prec: 4, fn: (a, b) => num(a) > num(b) },
  '<=': { prec: 4, fn: (a, b) => num(a) <= num(b) },
  '>=': { prec: 4, fn: (a, b) => num(a) >= num(b) },
  '+': { prec: 5, fn: (a, b) => (typeof a === 'string' || typeof b === 'string' ? `${a ?? ''}${b ?? ''}` : num(a) + num(b)) },
  '-': { prec: 5, fn: (a, b) => num(a) - num(b) },
  '*': { prec: 6, fn: (a, b) => num(a) * num(b) },
  '/': { prec: 6, fn: (a, b) => (num(b) === 0 ? null : num(a) / num(b)) },
  '%': { prec: 6, fn: (a, b) => num(a) % num(b) },
};

/** Compiles an expression; `columns` (if given) restricts identifiers to known earlier columns. */
export function compileFormula(src: string, columns?: ReadonlySet<string>): Compiled {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const isOp = (v: string): boolean => {
    const t = peek();
    return t?.t === 'op' && t.v === v;
  };
  const expect = (v: string): void => {
    if (!isOp(v)) throw new Error(`Expected "${v}" in "${src}"`);
    pos++;
  };

  function primary(): Compiled {
    const t = tokens[pos++];
    if (!t) throw new Error(`Unexpected end of "${src}"`);
    if (t.t === 'num' || t.t === 'str') {
      const v = t.v;
      return () => v;
    }
    if (t.t === 'op' && t.v === '(') {
      const e = ternary();
      expect(')');
      return e;
    }
    if (t.t === 'op' && (t.v === '-' || t.v === '!')) {
      const e = primary();
      return t.v === '-' ? (r) => -num(e(r)) : (r) => !truthy(e(r));
    }
    if (t.t === 'id') {
      if (t.v === 'true' || t.v === 'false') {
        const v = t.v === 'true';
        return () => v;
      }
      if (t.v === 'null') return () => null;
      if (isOp('(')) {
        const fn = FUNCS[t.v];
        if (!fn) throw new Error(`Unknown function ${t.v}() in "${src}"`);
        pos++;
        const args: Compiled[] = [];
        if (!isOp(')')) {
          do args.push(ternary());
          while (isOp(',') && ++pos);
        }
        expect(')');
        return (r) => fn(args.map((a) => a(r)));
      }
      if (columns && !columns.has(t.v)) throw new Error(`Unknown column "${t.v}" in "${src}" (only earlier columns may be referenced)`);
      const name = t.v;
      return (r) => r(name);
    }
    throw new Error(`Unexpected token "${t.v}" in "${src}"`);
  }

  function binary(minPrec: number): Compiled {
    let left = primary();
    for (;;) {
      const t = peek();
      const op = t?.t === 'op' ? BINARY[t.v] : undefined;
      if (!op || op.prec < minPrec) return left;
      pos++;
      const right = binary(op.prec + 1);
      const l = left;
      left = (r) => op.fn(l(r), right(r));
    }
  }

  function ternary(): Compiled {
    const cond = binary(1);
    if (!isOp('?')) return cond;
    pos++;
    const a = ternary();
    expect(':');
    const b = ternary();
    return (r) => (truthy(cond(r)) ? a(r) : b(r));
  }

  const out = ternary();
  if (pos !== tokens.length) throw new Error(`Trailing input in "${src}"`);
  return out;
}

/** Identifiers referenced by a formula (for dependency checks). */
export function formulaColumns(src: string): string[] {
  return tokenize(src)
    .filter((t, i, all) => t.t === 'id' && !['true', 'false', 'null'].includes(t.v) && !(all[i + 1]?.t === 'op' && all[i + 1]?.v === '('))
    .map((t) => t.v as string);
}
