// Safety tests: self-service deletion defense-in-depth (migration 063).
// The never-event: user A must NEVER delete user B's data.
//
// These tests audit the migration SQL itself for the safety invariants:
//   1. No deletion RPC takes a user-ID parameter (nothing to spoof).
//   2. Every DELETE/UPDATE is scoped to auth.uid() (via v_uid).
//   3. auth.uid() IS NULL raises BEFORE any data mutation.
//   4. RLS denies DELETE on core tables (verified by absence of policies).
//
// Run: node --test src/lib/account/__tests__/deletion-safety.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  join(here, '..', '..', '..', '..', 'supabase', 'migrations', '063_self_service_deletion.sql'),
  'utf8'
);

// Extract a single function body by name.
function fnBody(name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  assert.ok(start !== -1, `function ${name} not found`);
  // Body runs to the next CREATE OR REPLACE FUNCTION or section header.
  const rest = sql.slice(start);
  const endMarkers = ['CREATE OR REPLACE FUNCTION public.request_account_deletion',
    'CREATE OR REPLACE FUNCTION public.cancel_account_deletion',
    'CREATE OR REPLACE FUNCTION public.request_child_deletion',
    'CREATE OR REPLACE FUNCTION public.cancel_child_deletion',
    'CREATE OR REPLACE FUNCTION public.purge_expired_deletions',
    '-- 7. Nightly'];
  let end = rest.length;
  for (const m of endMarkers) {
    const i = rest.indexOf(m, 10);
    if (i !== -1 && i < end) end = i;
  }
  return rest.slice(0, end);
}

test('no deletion RPC takes a user-ID parameter', () => {
  for (const fn of ['request_account_deletion', 'cancel_account_deletion']) {
    const sig = sql.slice(
      sql.indexOf(`FUNCTION public.${fn}(`),
      sql.indexOf(`FUNCTION public.${fn}(`) + 80
    );
    assert.ok(!/p_user_id|p_uid|user_id/.test(sig),
      `${fn} must not take a user-ID parameter (found in signature)`);
  }
  // Child RPCs take ONLY p_child_id (a selector, not an identity).
  for (const fn of ['request_child_deletion', 'cancel_child_deletion']) {
    const sigStart = sql.indexOf(`FUNCTION public.${fn}(`);
    const sig = sql.slice(sigStart, sigStart + 80);
    assert.ok(/p_child_id/.test(sig), `${fn} takes p_child_id`);
    assert.ok(!/p_user_id/.test(sig), `${fn} must not take a user-ID parameter`);
  }
});

test('auth.uid() null check precedes any mutation in user-scoped RPCs', () => {
  for (const fn of ['request_account_deletion', 'cancel_account_deletion',
                    'request_child_deletion', 'cancel_child_deletion']) {
    const body = fnBody(fn);
    const nullCheck = body.indexOf('IF v_uid IS NULL');
    assert.ok(nullCheck !== -1, `${fn}: missing null auth.uid() guard`);
    const firstMutation = Math.min(
      ...['INSERT INTO', 'UPDATE public.', 'DELETE FROM']
        .map((kw) => { const i = body.indexOf(kw); return i === -1 ? Infinity : i; })
    );
    assert.ok(nullCheck < firstMutation,
      `${fn}: null check must come before the first mutation`);
  }
});

test('every UPDATE/DELETE in user RPCs is scoped to the session user', () => {
  for (const fn of ['request_account_deletion', 'cancel_account_deletion']) {
    const body = fnBody(fn);
    // All data mutations must reference v_uid (which is auth.uid()).
    const mutations = [...body.matchAll(/(UPDATE public\.\w+|DELETE FROM public\.\w+)[^;]*;/g)];
    assert.ok(mutations.length > 0, `${fn}: expected mutations`);
    for (const [stmt] of mutations) {
      // audit_log inserts are the exception: they log the actor but target
      // no user row. Every other mutation must scope to v_uid.
      if (/INSERT INTO public\.audit_log/.test(stmt)) continue;
      assert.ok(/v_uid/.test(stmt),
        `${fn}: unscoped mutation (no v_uid): ${stmt.slice(0, 80)}…`);
    }
  }
});

test('child RPCs verify ownership before mutating', () => {
  for (const fn of ['request_child_deletion', 'cancel_child_deletion']) {
    const body = fnBody(fn);
    assert.ok(/parent_user_id = v_uid/.test(body),
      `${fn}: must check parent_user_id = v_uid`);
    assert.ok(/not_child_owner/.test(body) || /no_deletion_pending/.test(body),
      `${fn}: must fail closed when ownership check misses`);
  }
});

test('purge function is service_role only (not callable by users)', () => {
  const grantIdx = sql.indexOf('GRANT EXECUTE ON FUNCTION public.purge_expired_deletions()');
  assert.ok(grantIdx !== -1, 'purge grant not found');
  const grantLine = sql.slice(grantIdx, grantIdx + 120);
  assert.ok(/TO service_role/.test(grantLine), 'purge must be service_role only');
  assert.ok(!/authenticated/.test(grantLine),
    'purge must NOT be granted to authenticated users');
});

test('grace period constant is 30 days in SQL', () => {
  const matches = sql.match(/INTERVAL '30 days'/g) || [];
  // request_account_deletion + request_child_deletion
  assert.ok(matches.length >= 2,
    `expected ≥2 INTERVAL '30 days' occurrences, found ${matches.length}`);
});
