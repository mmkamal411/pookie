// Unit tests: SLA engine (FR-SUPPORT-003, MD decision D4).
// Window: 4h inside 09:00–17:00 America/New_York, 7 days/week.
// Run: npm test   (node --test, no extra deps)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSlaDueAt,
  defaultOnCallIndex,
  isSupportHoliday,
  resolveOnCallAgent,
  slaStatus,
} from '../sla.ts';

// October 2026 is EDT (UTC-4); December 2026 is EST (UTC-5).
const et = (y: number, mo: number, d: number, h: number, mi: number, off: number) =>
  new Date(Date.UTC(y, mo - 1, d, h + off, mi));

test('Monday 10:00 ET -> due 14:00 ET same day', () => {
  const due = computeSlaDueAt(et(2026, 10, 19, 10, 0, 4));
  assert.equal(due.toISOString(), '2026-10-19T18:00:00.000Z'); // 14:00 ET
});

test('15:00 ET -> 2h today + 2h tomorrow -> 11:00 ET next day', () => {
  const due = computeSlaDueAt(et(2026, 10, 19, 15, 0, 4));
  assert.equal(due.toISOString(), '2026-10-20T15:00:00.000Z');
});

test('Friday 16:00 ET -> Saturday 12:00 ET (window runs 7 days/week)', () => {
  const due = computeSlaDueAt(et(2026, 10, 16, 16, 0, 4));
  assert.equal(due.toISOString(), '2026-10-17T16:00:00.000Z');
});

test('before window (07:00 ET) -> 13:00 ET same day', () => {
  const due = computeSlaDueAt(et(2026, 10, 19, 7, 0, 4));
  assert.equal(due.toISOString(), '2026-10-19T17:00:00.000Z');
});

test('after window (18:00 ET) -> 13:00 ET next day', () => {
  const due = computeSlaDueAt(et(2026, 10, 19, 18, 0, 4));
  assert.equal(due.toISOString(), '2026-10-20T17:00:00.000Z');
});

test('D4 example: holiday 23:00 ET -> due 13:00 ET next day', () => {
  // Christmas 2026 (Friday) 23:00 ET -> Sat 2026-12-26 09:00 + 4h = 13:00 ET.
  const due = computeSlaDueAt(et(2026, 12, 25, 23, 0, 5));
  assert.equal(due.toISOString(), '2026-12-26T18:00:00.000Z');
});

test('isSupportHoliday: federal holidays incl. observed days', () => {
  assert.equal(isSupportHoliday(et(2026, 12, 25, 12, 0, 5)), true);
  assert.equal(isSupportHoliday(et(2026, 10, 12, 12, 0, 4)), true); // Columbus Day
  assert.equal(isSupportHoliday(et(2026, 10, 13, 12, 0, 4)), false);
  assert.equal(isSupportHoliday(et(2027, 7, 5, 12, 0, 4)), true); // observed
});

test('computeSlaDueAt rejects non-positive hours', () => {
  assert.throws(() => computeSlaDueAt(new Date(), 0), /positive/);
});

test('slaStatus: breached flag wins; terminal states stop the clock', () => {
  const future = new Date(Date.now() + 3_600_000).toISOString();
  const past = new Date(Date.now() - 3_600_000).toISOString();
  assert.equal(slaStatus({ sla_due_at: future, sla_breached: false, status: 'open' }), 'on-track');
  assert.equal(slaStatus({ sla_due_at: past, sla_breached: false, status: 'open' }), 'breached');
  assert.equal(slaStatus({ sla_due_at: past, sla_breached: true, status: 'open' }), 'breached');
  assert.equal(slaStatus({ sla_due_at: past, sla_breached: true, status: 'closed' }), 'breached');
  assert.equal(slaStatus({ sla_due_at: future, sla_breached: false, status: 'resolved' }), 'on-track');
});

test('on-call: override wins; default alternates ISO weeks; empty -> null', () => {
  const agents = ['agent-a', 'agent-b'];
  const overrides = new Map([['2026-12-25', 'agent-b']]);
  const christmas = et(2026, 12, 25, 23, 0, 5);
  assert.equal(resolveOnCallAgent(christmas, agents, overrides), 'agent-b');

  const plain = et(2026, 10, 19, 10, 0, 4);
  const idx = defaultOnCallIndex(plain, 2);
  assert.equal(resolveOnCallAgent(plain, agents, new Map()), agents[idx]);

  const nextWeek = et(2026, 10, 26, 10, 0, 4);
  assert.notEqual(defaultOnCallIndex(nextWeek, 2), idx); // rotation alternates
  assert.equal(resolveOnCallAgent(plain, [], new Map()), null);
});
