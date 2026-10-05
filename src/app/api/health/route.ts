import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Liveness probe (12-deployment §5): the process is up. Readiness (`/api/ready`) arrives with packs and the warehouse. */
export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok' });
}
