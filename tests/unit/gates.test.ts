import { describe, expect, it } from 'vitest';
import { evaluateGateOutcome } from '@/lib/lifecycle/gates';
import { publishVersion } from '@/lib/lifecycle/decisions';
import { stageDef, statusForStage } from '@/lib/lifecycle/stages';

const council = stageDef(11).gate;
const charter = stageDef(2).gate;
if (!council || !charter) throw new Error('gates');

describe('evaluateGateOutcome (06 §2, ADR-0017)', () => {
  it('needs quorum from distinct personas', () => {
    expect(evaluateGateOutcome(council, [{ personaId: 'd', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }]).state).toBe('IN_REVIEW');
    expect(evaluateGateOutcome(council, [{ personaId: 'd', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }, { personaId: 'd', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }]).state).toBe('IN_REVIEW');
    expect(evaluateGateOutcome(council, [{ personaId: 'd', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }, { personaId: 'e', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }]).state).toBe('APPROVED');
  });

  it('needs every required role covered', () => {
    const r = evaluateGateOutcome(charter, [{ personaId: 'c', personaRoles: ['DOMAIN_PRODUCT_OWNER'], outcome: 'APPROVE' }, { personaId: 'b', personaRoles: ['ANALYST'], outcome: 'APPROVE' }]);
    expect(r.state).toBe('IN_REVIEW');
    expect(r.missingRoles).toEqual(['PORTFOLIO_LEAD']);
    expect(evaluateGateOutcome(charter, [{ personaId: 'c', personaRoles: ['DOMAIN_PRODUCT_OWNER'], outcome: 'APPROVE' }, { personaId: 'e', personaRoles: ['PORTFOLIO_LEAD'], outcome: 'APPROVE' }]).state).toBe('APPROVED');
  });

  it('a veto role rejection is a veto; ineligible votes are ignored', () => {
    const r = evaluateGateOutcome(council, [{ personaId: 'd', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'APPROVE' }, { personaId: 'e', personaRoles: ['GOVERNANCE_COUNCIL'], outcome: 'REJECT' }]);
    expect(r.state).toBe('REJECTED');
    expect(r.vetoedBy).toBe('e');
    expect(evaluateGateOutcome(council, [{ personaId: 'a', personaRoles: ['DATA_CONSUMER'], outcome: 'REJECT' }]).state).toBe('IN_REVIEW');
  });

  it('the latest vote per persona counts', () => {
    expect(evaluateGateOutcome(stageDef(4).gate ?? council, [{ personaId: 'c', personaRoles: ['DATA_ENGINEER'], outcome: 'REJECT' }, { personaId: 'c', personaRoles: ['DATA_ENGINEER'], outcome: 'APPROVE' }]).state).toBe('APPROVED');
  });
});

describe('versions and status', () => {
  it.each([
    ['1.0.0-rc.1', '1.0.0'],
    ['0.4.0', '1.0.0'],
    ['2.1.0', '2.2.0'],
  ])('publishVersion(%s) = %s', (a, b) => expect(publishVersion(a)).toBe(b));
  it('maps stages to status', () => {
    expect([1, 2, 3, 10, 11, 12].map(statusForStage)).toEqual(['DRAFT', 'DRAFT', 'IN_DEVELOPMENT', 'IN_DEVELOPMENT', 'IN_CERTIFICATION', 'CERTIFIED']);
  });
});
