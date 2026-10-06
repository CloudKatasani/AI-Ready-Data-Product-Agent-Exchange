/**
 * White-label branding (CLAUDE.md §7). Colours are derived from brand primary/accent and contrast-checked
 * to WCAG AA; a failing pair falls back to the neutral default.
 */
export interface Brand {
  productName: string;
  companyName: string;
  logoSvg?: string;
  primary: string;
  accent: string;
  font?: string;
}

/** Neutral default used until a Demo Profile is active (Phase 9). Codename only — components read brand.productName. */
export const DEFAULT_BRAND: Brand = {
  productName: 'Keystone',
  companyName: '',
  primary: '#1d4ed8',
  accent: '#0f766e',
};

export const AA_NORMAL_TEXT = 4.5;

const HEX = /^#([0-9a-f]{6})$/i;

export function parseHex(hex: string): [number, number, number] | null {
  const m = HEX.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) throw new Error(`Invalid colour: ${hex}`);
  const [r, g, b] = rgb;
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface BrandTokens {
  '--brand-primary': string;
  '--brand-primary-foreground': string;
  '--brand-accent': string;
  '--brand-accent-foreground': string;
}

const WHITE = '#ffffff';
const INK = '#0f172a';

function foregroundFor(bg: string): string | null {
  if (contrastRatio(bg, WHITE) >= AA_NORMAL_TEXT) return WHITE;
  if (contrastRatio(bg, INK) >= AA_NORMAL_TEXT) return INK;
  return null;
}

/** CSS custom properties for a brand; any colour without an AA-compliant foreground falls back to the default. */
export function brandTokens(brand: Brand): BrandTokens {
  const pick = (colour: string, fallback: string): [string, string] => {
    if (parseHex(colour)) {
      const fg = foregroundFor(colour);
      if (fg) return [colour, fg];
    }
    return [fallback, foregroundFor(fallback) ?? WHITE];
  };
  const [primary, primaryFg] = pick(brand.primary, DEFAULT_BRAND.primary);
  const [accent, accentFg] = pick(brand.accent, DEFAULT_BRAND.accent);
  return {
    '--brand-primary': primary,
    '--brand-primary-foreground': primaryFg,
    '--brand-accent': accent,
    '--brand-accent-foreground': accentFg,
  };
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** True when the colour carries white or ink text at WCAG AA (normal text). */
export function passesAA(hex: string): boolean {
  return Boolean(parseHex(hex) && foregroundFor(hex));
}

/**
 * The nearest accessible alternative for a brand colour that fails AA: darken it step by step (towards
 * white text) or, for light colours, towards ink text — deterministic, keeping the hue.
 */
export function accessibleAlternative(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return DEFAULT_BRAND.primary;
  if (foregroundFor(hex)) return hex.toLowerCase();
  for (let k = 0.95; k > 0; k -= 0.05) {
    const c = toHex(rgb[0] * k, rgb[1] * k, rgb[2] * k);
    if (contrastRatio(c, WHITE) >= AA_NORMAL_TEXT) return c;
  }
  return INK;
}

export interface BrandCheck {
  ok: boolean;
  problems: { field: 'primary' | 'accent'; colour: string; suggestion: string }[];
}

/** AC1.2: reject brand colours that fail AA, each with a suggested accessible alternative. */
export function checkBrand(brand: Pick<Brand, 'primary' | 'accent'>): BrandCheck {
  const problems = (['primary', 'accent'] as const).filter((f) => !passesAA(brand[f])).map((f) => ({ field: f, colour: brand[f], suggestion: accessibleAlternative(brand[f]) }));
  return { ok: problems.length === 0, problems };
}
