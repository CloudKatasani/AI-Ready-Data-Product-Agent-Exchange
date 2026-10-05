import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

const { optionalSegments } = await import('@/components/shell/route-params');

describe('optionalSegments', () => {
  it('maps present and absent segments', () => {
    expect(optionalSegments(['GOLD'], ['schema', 'object'])).toEqual({ schema: 'GOLD', object: undefined });
    expect(optionalSegments(undefined, ['tab'])).toEqual({ tab: undefined });
  });

  it('decodes segments', () => {
    expect(optionalSegments(['a%20b'], ['term'])).toEqual({ term: 'a b' });
  });

  it('404s on extra segments', () => {
    expect(() => optionalSegments(['a', 'b'], ['tab'])).toThrow('NEXT_NOT_FOUND');
  });
});
