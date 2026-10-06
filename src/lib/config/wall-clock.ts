/**
 * Wall-clock time for I/O concerns only: auth token lifetimes, request timeouts. Never for data, answers or
 * generated content (those read the pack clock, invariant I08). Lives outside the deterministic engine
 * directories on purpose, so the determinism lint stays strict there.
 */
export function wallClockMs(): number {
  return Date.now();
}
