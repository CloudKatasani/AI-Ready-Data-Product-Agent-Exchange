import { notFound } from 'next/navigation';

/**
 * Maps an optional catch-all segment (`[[...rest]]`) onto named optional parameters, e.g.
 * `/explorer/[schema?]/[object?]`. More segments than names is a 404.
 */
export function optionalSegments<const N extends readonly string[]>(
  segments: string[] | undefined,
  names: N,
): Record<N[number], string | undefined> {
  const segs = segments ?? [];
  if (segs.length > names.length) notFound();
  return Object.fromEntries(names.map((name, i) => [name, segs[i] === undefined ? undefined : decodeURIComponent(segs[i])])) as Record<
    N[number],
    string | undefined
  >;
}
