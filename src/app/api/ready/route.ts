import { NextResponse } from 'next/server';
import { readinessChecks } from '@/lib/presenter/readiness-check';

export const dynamic = 'force-dynamic';

/** Readiness probe (12 §5): DB reachable, packs load, warehouses built for the current pack content. 503 otherwise. */
export async function GET(): Promise<NextResponse> {
  const checks = await readinessChecks();
  const ready = checks.every((c) => c.ok);
  return NextResponse.json({ status: ready ? 'ready' : 'not-ready', checks }, { status: ready ? 200 : 503 });
}
