/** Tiny `--flag value` / `--flag` parser for repo scripts. */
export function parseArgs(argv: string[]): { flags: Record<string, string | true>; positional: string[] } {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    } else positional.push(a);
  }
  return { flags, positional };
}
