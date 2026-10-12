// App-layer safety tests: the server actions must never accept a user ID.
// The never-event: authenticated as user A, a spoofed user-B ID in the
// request must not delete user B's data. These actions defeat the attack
// structurally — there is no parameter to spoof.
//
// Run: node --test src/lib/account/__tests__/actions-safety.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  CHILD_DELETION_GRACE_DAYS,
  ACCOUNT_DELETE_CONFIRM_PHRASE,
} from '../constants.ts';
import { deletionErrorMessage } from '../error-messages.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'actions.ts'), 'utf8');

test('requestAccountDeletion takes no arguments', () => {
  const m = src.match(/export async function requestAccountDeletion\(([^)]*)\)/);
  assert.ok(m, 'requestAccountDeletion not found');
  assert.equal(m[1].trim(), '',
    'requestAccountDeletion must take zero parameters (nothing to spoof)');
});

test('cancelAccountDeletion takes no arguments', () => {
  const m = src.match(/export async function cancelAccountDeletion\(([^)]*)\)/);
  assert.ok(m, 'cancelAccountDeletion not found');
  assert.equal(m[1].trim(), '',
    'cancelAccountDeletion must take zero parameters');
});

test('child actions take only childId (selector), never a user ID', () => {
  for (const fn of ['requestChildDeletion', 'cancelChildDeletion']) {
    const m = src.match(new RegExp(`export async function ${fn}\\(([^)]*)\\)`));
    assert.ok(m, `${fn} not found`);
    assert.ok(/childId: string/.test(m[1]), `${fn} takes childId selector`);
    assert.ok(!/userId|uid/i.test(m[1]),
      `${fn} must not take any user-ID parameter`);
  }
});

test('null session aborts before any RPC call (fail-closed)', () => {
  // Every action guards on sessionUserId() before touching the database.
  const guards = src.match(/if \(!uid\) return \{ ok: false, error: "not_signed_in" \};/g) || [];
  // requestAccountDeletion, cancelAccountDeletion, requestChildDeletion,
  // cancelChildDeletion = 4 guarded actions (getAccountDeletionStatus
  // returns null instead, also fail-closed).
  assert.ok(guards.length >= 4,
    `expected ≥4 fail-closed session guards, found ${guards.length}`);
});

test('grace constants are 30 days (founder-confirmed)', () => {
  assert.equal(ACCOUNT_DELETION_GRACE_DAYS, 30);
  assert.equal(CHILD_DELETION_GRACE_DAYS, 30);
  assert.equal(ACCOUNT_DELETE_CONFIRM_PHRASE, 'DELETE');
});

test('deletion error messages are plain English', () => {
  assert.equal(deletionErrorMessage('not_signed_in'),
    "You're not signed in anymore. Please sign in again.");
  assert.equal(deletionErrorMessage('no_deletion_pending'),
    "There's no deletion scheduled — nothing to cancel.");
  assert.equal(deletionErrorMessage('not_child_owner'),
    "We couldn't find that child on your account.");
  // Unknown codes fall back to a generic message, never a raw code.
  assert.equal(deletionErrorMessage('some_raw_db_error'),
    'Something went wrong. Please try again.');
});
