import { describe, expect, it } from 'vitest';
import { brandTokens, contrastRatio, DEFAULT_BRAND, parseHex } from '@/lib/presenter/branding';

describe('contrastRatio', () => {
  it('matches WCAG reference values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1d4ed8', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#1d4ed8'), 10);
  });

  it('rejects malformed colours', () => {
    expect(parseHex('blue')).toBeNull();
    expect(() => contrastRatio('#12', '#fff000')).toThrow();
  });
});

describe('brandTokens', () => {
  it('keeps an accessible brand and picks a readable foreground', () => {
    const t = brandTokens({ ...DEFAULT_BRAND, primary: '#0b3d91', accent: '#ffd400' });
    expect(t['--brand-primary']).toBe('#0b3d91');
    expect(t['--brand-primary-foreground']).toBe('#ffffff');
    expect(t['--brand-accent']).toBe('#ffd400');
    expect(t['--brand-accent-foreground']).toBe('#0f172a');
  });

  it('falls back to the neutral default when no foreground reaches AA', () => {
    const t = brandTokens({ ...DEFAULT_BRAND, primary: '#7a7a7a', accent: 'not-a-colour' });
    expect(t['--brand-primary']).toBe(DEFAULT_BRAND.primary);
    expect(t['--brand-accent']).toBe(DEFAULT_BRAND.accent);
  });

  it('default brand colours pass AA against their foregrounds', () => {
    const t = brandTokens(DEFAULT_BRAND);
    expect(contrastRatio(t['--brand-primary'], t['--brand-primary-foreground'])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(t['--brand-accent'], t['--brand-accent-foreground'])).toBeGreaterThanOrEqual(4.5);
  });
});
