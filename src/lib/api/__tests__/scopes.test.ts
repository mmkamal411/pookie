// Unit tests: scope-filtering choke point (FR-ACCESS-006, sol-access §2.5).
// Run: npm test   (node --test, no extra deps)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyScopeFilter,
  hasScopePure,
  resolveVisibleScopesPure,
  sanitizeScopes,
  withScope,
  type Scope,
} from '../scopes.ts';

const teen = { isTeen: true, grantStatus: null, allowedScopes: [] as Scope[] };
const parentDefault = {
  isTeen: false,
  grantStatus: 'active' as const,
  allowedScopes: ['performance', 'communications'] as Scope[],
};
const stranger = { isTeen: false, grantStatus: null, allowedScopes: [] as Scope[] };

test('teen sees all 7 scopes', () => {
  assert.deepEqual(resolveVisibleScopesPure(teen), [
    'performance', 'communications', 'reflection', 'wellness',
    'location', 'itinerary', 'safety_comms',
  ]);
});

test('parent with default grant sees performance + communications + safety_comms', () => {
  assert.deepEqual(resolveVisibleScopesPure(parentDefault), [
    'communications', 'performance', 'safety_comms',
  ]);
});

test('stranger / revoked viewer sees safety_comms only', () => {
  assert.deepEqual(resolveVisibleScopesPure(stranger), ['safety_comms']);
  assert.deepEqual(
    resolveVisibleScopesPure({ ...parentDefault, grantStatus: 'revoked' }),
    ['safety_comms'],
  );
});

test('cooling states keep the grant scopes (view frozen by time, not scope)', () => {
  for (const s of ['pending_cooling', 'scheduled_revoke'] as const) {
    assert.deepEqual(resolveVisibleScopesPure({ ...parentDefault, grantStatus: s }), [
      'communications', 'performance', 'safety_comms',
    ]);
  }
});

test('teen-private scopes never resolve for a parent', () => {
  assert.equal(hasScopePure(parentDefault, 'reflection'), false);
  assert.equal(hasScopePure(parentDefault, 'wellness'), false);
  assert.equal(hasScopePure(parentDefault, 'performance'), true);
  assert.equal(hasScopePure(teen, 'reflection'), true);
  assert.equal(hasScopePure(teen, 'wellness'), true);
});

test('sanitizeScopes drops unknown scopes and dedupes', () => {
  assert.deepEqual(sanitizeScopes(['performance', 'hacker_scope', 'performance']), ['performance']);
});

test('applyScopeFilter strips reflection/wellness rows for a parent', () => {
  const payload = {
    grades: [withScope({ class: 'Geometry', pct: 69.5 }, 'performance')],
    checkins: [withScope({ date: '2026-10-12', text: 'rough day' }, 'reflection')],
    mood: [withScope({ score: 2 }, 'wellness', 'H2')],
  };
  const visible = new Set(resolveVisibleScopesPure(parentDefault));
  const out = applyScopeFilter(payload, visible, { isTeen: false }) as typeof payload;
  assert.equal(out.grades.length, 1);
  assert.equal(out.checkins.length, 0);
  assert.equal(out.mood.length, 0);
});

test('applyScopeFilter keeps teen-private rows for the teen', () => {
  const payload = {
    checkins: [withScope({ date: '2026-10-12', text: 'rough day' }, 'reflection')],
  };
  const visible = new Set(resolveVisibleScopesPure(teen));
  const out = applyScopeFilter(payload, visible, { isTeen: true }) as typeof payload;
  assert.equal(out.checkins.length, 1);
  assert.equal(out.checkins[0].text, 'rough day');
});

test('H2/H3 wellness rows stay teen-only even when wellness is granted', () => {
  const granted = {
    isTeen: false,
    grantStatus: 'active' as const,
    allowedScopes: ['performance', 'communications', 'wellness'] as Scope[],
  };
  const payload = {
    vitals: [
      withScope({ metric: 'steps', value: 8000 }, 'wellness', 'H1'),
      withScope({ metric: 'weight', value: 250 }, 'wellness', 'H2'),
      withScope({ metric: 'medication', value: 'x' }, 'wellness', 'H3'),
    ],
  };
  const visible = new Set(resolveVisibleScopesPure(granted));
  const parentOut = applyScopeFilter(payload, visible, { isTeen: false }) as typeof payload;
  assert.deepEqual(parentOut.vitals.map((v) => v.metric), ['steps']);
  const teenOut = applyScopeFilter(payload, new Set(resolveVisibleScopesPure(teen)), {
    isTeen: true,
  }) as typeof payload;
  assert.equal(teenOut.vitals.length, 3);
});

test('scope tags never leak into serialized output', () => {
  const payload = { rows: [withScope({ a: 1 }, 'performance')] };
  const out = applyScopeFilter(payload, new Set(['performance'] as Scope[]), { isTeen: false });
  assert.deepEqual(out, { rows: [{ a: 1 }] });
});

test('untagged data passes through untouched', () => {
  const payload = { ok: true, count: 3, nested: { x: [1, 2] } };
  assert.deepEqual(applyScopeFilter(payload, new Set(['safety_comms'] as Scope[]), { isTeen: false }), payload);
});
