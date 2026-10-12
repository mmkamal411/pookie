// Unit tests: support-agent RBAC primitives (FR-SUPPORT-005, MD decision D4).
// Run: npm test   (node --test, no extra deps)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_CREDIT_LIMIT_CENTS,
  canDecideCreditApproval,
  canTransitionTicket,
  creditPathFor,
  grantExpiresAt,
  isGrantableScope,
  isGrantActive,
  isNeverGrantableScope,
} from '../grants.ts';

test('grant allowlist: only the three operational scopes', () => {
  assert.equal(isGrantableScope('school.grades.read'), true);
  assert.equal(isGrantableScope('billing.read'), true);
  assert.equal(isGrantableScope('sync.status.read'), true);
  assert.equal(isGrantableScope('health.vitals.read'), false);
  assert.equal(isGrantableScope('wellbeing.read'), false);
  assert.equal(isGrantableScope('checkin.text.read'), false);
  assert.equal(isGrantableScope(''), false);
});

test('health/wellbeing/mood/check-in scopes are never grantable', () => {
  assert.equal(isNeverGrantableScope('health.vitals.read'), true);
  assert.equal(isNeverGrantableScope('wellbeing.daily.read'), true);
  assert.equal(isNeverGrantableScope('mood.pulse.read'), true);
  assert.equal(isNeverGrantableScope('checkin.text.read'), true);
  assert.equal(isNeverGrantableScope('reflection.journal.read'), true);
  assert.equal(isNeverGrantableScope('wellness.sleep.read'), true);
  assert.equal(isNeverGrantableScope('school.grades.read'), false);
});

test('grant TTL: default 24h, hard cap 72h, min 1h', () => {
  const t0 = new Date('2026-10-12T12:00:00Z');
  assert.equal(grantExpiresAt(t0).toISOString(), '2026-10-13T12:00:00.000Z');
  assert.equal(grantExpiresAt(t0, 100).toISOString(), '2026-10-15T12:00:00.000Z');
  assert.equal(grantExpiresAt(t0, 0).toISOString(), '2026-10-12T13:00:00.000Z');
});

test('isGrantActive: active + unexpired + unrevoked only', () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  assert.equal(isGrantActive({ status: 'active', expires_at: future, revoked_at: null }), true);
  assert.equal(isGrantActive({ status: 'active', expires_at: past, revoked_at: null }), false);
  assert.equal(
    isGrantActive({ status: 'active', expires_at: future, revoked_at: new Date().toISOString() }),
    false,
  );
  assert.equal(isGrantActive({ status: 'pending', expires_at: future, revoked_at: null }), false);
  assert.equal(isGrantActive({ status: 'expired', expires_at: future, revoked_at: null }), false);
});

test('D4 credit authority: <= $50 direct, above needs MD approval', () => {
  assert.equal(AGENT_CREDIT_LIMIT_CENTS, 5000);
  assert.equal(creditPathFor(1), 'direct');
  assert.equal(creditPathFor(5000), 'direct');
  assert.equal(creditPathFor(5001), 'approval_required');
  assert.equal(creditPathFor(100000), 'approval_required');
  assert.throws(() => creditPathFor(0), /positive/);
  assert.throws(() => creditPathFor(-50), /positive/);
});

test('only admin tier (MD) decides credit approvals', () => {
  assert.equal(canDecideCreditApproval('admin'), true);
  assert.equal(canDecideCreditApproval('lead'), false);
  assert.equal(canDecideCreditApproval('agent'), false);
});

test('ticket transitions follow the allowlisted state machine', () => {
  assert.equal(canTransitionTicket('open', 'in_progress', 'agent'), true);
  assert.equal(canTransitionTicket('open', 'resolved', 'agent'), false);
  assert.equal(canTransitionTicket('in_progress', 'resolved', 'agent'), true);
  assert.equal(canTransitionTicket('in_progress', 'closed', 'agent'), false);
  assert.equal(canTransitionTicket('resolved', 'closed', 'user'), true);
  assert.equal(canTransitionTicket('resolved', 'in_progress', 'user'), true);
  assert.equal(canTransitionTicket('resolved', 'closed', 'agent'), false);
  assert.equal(canTransitionTicket('closed', 'in_progress', 'user'), true);
  assert.equal(canTransitionTicket('open', 'open', 'agent'), false);
});
