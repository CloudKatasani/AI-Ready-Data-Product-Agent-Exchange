/**
 * Pure gate evaluation (06 §2, ADR-0017): quorum counts distinct approving personas; each must hold a
 * required role; together they must cover every required role. A rejection by a required-role holder
 * sends the gate back; by a veto role it is a VETO.
 */
import type { Role } from '@/lib/packs/schema';
import type { GateDef } from './stages';

export interface GateVote {
  personaId: string;
  personaRoles: Role[];
  outcome: 'APPROVE' | 'REJECT' | 'VETO';
}

export interface GateOutcome {
  state: 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
  approvals: number;
  coveredRoles: Role[];
  missingRoles: Role[];
  vetoedBy?: string;
}

export function evaluateGateOutcome(gate: GateDef, votes: GateVote[]): GateOutcome {
  const latest = new Map<string, GateVote>();
  for (const v of votes) latest.set(v.personaId, v);
  const eligible = [...latest.values()].filter((v) => v.personaRoles.some((r) => gate.roles.includes(r)));
  const veto = eligible.find((v) => v.outcome === 'VETO' || (v.outcome === 'REJECT' && v.personaRoles.some((r) => gate.veto.includes(r))));
  const covered = [...new Set(eligible.filter((v) => v.outcome === 'APPROVE').flatMap((v) => v.personaRoles.filter((r) => gate.roles.includes(r))))];
  const missingRoles = gate.roles.filter((r) => !covered.includes(r));
  const approvals = eligible.filter((v) => v.outcome === 'APPROVE').length;
  if (veto) return { state: 'REJECTED', approvals, coveredRoles: covered, missingRoles, vetoedBy: veto.personaId };
  if (eligible.some((v) => v.outcome === 'REJECT')) return { state: 'REJECTED', approvals, coveredRoles: covered, missingRoles };
  if (approvals >= gate.quorum && missingRoles.length === 0) return { state: 'APPROVED', approvals, coveredRoles: covered, missingRoles };
  return { state: 'IN_REVIEW', approvals, coveredRoles: covered, missingRoles };
}
