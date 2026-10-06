/**
 * Pack clock. Every engine reads "now" from the pack's `asOf`, never the wall clock (invariant I08).
 * Dates are epoch days (UTC); timestamps are epoch seconds (UTC).
 */
const DAY_MS = 86_400_000;

export function isoToEpochDay(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) throw new Error(`Invalid ISO date: ${iso}`);
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function epochDayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function epochSecondsToIso(sec: number): string {
  return new Date(sec * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

/** Month (0–11) and weekday (0 = Monday … 6 = Sunday) of an epoch day. */
export function dayParts(day: number): { month: number; weekday: number; year: number } {
  const d = new Date(day * DAY_MS);
  return { month: d.getUTCMonth(), weekday: (d.getUTCDay() + 6) % 7, year: d.getUTCFullYear() };
}

export interface Clock {
  asOf: string;
  asOfDay: number;
  /** End of the asOf day, epoch seconds. */
  asOfEndSec: number;
}

export function clockFor(asOf: string): Clock {
  const asOfDay = isoToEpochDay(asOf);
  return { asOf, asOfDay, asOfEndSec: (asOfDay + 1) * 86_400 - 1 };
}

/** Resolves a generator date bound (`asOf` keyword or ISO date) to an epoch day. */
export function resolveDay(bound: string, clock: Clock): number {
  return bound === 'asOf' ? clock.asOfDay : isoToEpochDay(bound);
}
