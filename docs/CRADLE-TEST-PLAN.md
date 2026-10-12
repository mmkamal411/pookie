# Squad Cradle — Eli Chowdhury End-to-End Test Plan

**Test child:** Eli Chowdhury, DOB 08/01/2014 (age 12, under-13)
**Child login:** elichowdhury1@gmail.com
**Parent:** Rolan Chowdhury (iamrolan@gmail.com) — consenting parent authority
**Uncle:** Mehedi Kamal (mehedikamal@gmail.com) — Village mentor test
**School creds:** eli.chowdhury@students.cobbk12.org (StudentVue/CTLS Learn/Outlook)

**What Squad Cradle built (code, committed):**
- Migration `076_parental_consent_under13_login.sql` — `parental_consents` table,
  `grant_parental_consent()` / `revoke_parental_consent()` RPCs, `consume_invite()`
  amended to allow under-13 ONLY with valid parental consent. Default stays closed.
- `src/server/services/parental-consent.ts` — grant/revoke/read wrappers.
- `POST/DELETE/GET /api/v1/children/[childId]/consent` — consent API (parent-only writes).
- `src/components/village/parental-consent-panel.tsx` — consent UI on the Sharing
  screen for under-13 children (parent role only).
- tsc clean. Build verified.

## Phase 1 — Database (Supabase dashboard SQL editor)

**Requires:** Mehedi's Supabase dashboard access (Pookie project `fspvcuaupkdsekpwmnep`).

**UPDATE 2026-10-12:** Squad Harbor applied `076_parental_consent_under13_login.sql`
live via the management API (fixed 2 syntax bugs: END→END IF, LOOP;→END LOOP;).
`070_child_mentors_village.sql` is also live (verified: `child_mentors` returns
200). `069_shared_shopping_lists.sql` still pending.

Remaining:
1. Check what's applied:
   ```sql
   SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
   ```
2. Apply `069_shared_shopping_lists.sql` if not listed.
3. Verify:
   ```sql
   SELECT * FROM public.child_mentors LIMIT 0;      -- ok, no error
   SELECT * FROM public.parental_consents LIMIT 0;   -- ok, no error
   SELECT public.has_valid_parental_consent('00000000-0000-0000-0000-000000000000'); -- false
   ```

## Phase 2 — Accounts (browser)

1. **Rolan** signs up at https://pookie-staging.pages.dev with iamrolan@gmail.com
   (Google or OTP). Completes onboarding ("just me" → skip).
2. **Mehedi** signs in with mehedikamal@gmail.com (already has account).
3. **Rolan** → Add Child → Eli Chowdhury, DOB 2014-08-01, attests guardianship.
   - Verify: child appears, age shows "parent-managed, no login" (under-13).
4. **Rolan** → child's Sharing screen → Login Consent panel → "Give Login Consent"
   → confirms. Verify: "Consent active" shows.
5. **Rolan** → Settings → Family → Invite child → elichowdhury1@gmail.com.
   - Copy the verify URL (out-of-band; no email provider yet).
6. **Eli** signs up with elichowdhury1@gmail.com, opens the verify URL.
   - Verify: invite consumes (consent gate passes), Eli gets child_access row,
     lands on their dashboard.
   - **Negative test:** revoke consent first, try consume → must fail
     `under_13_no_login`. Re-grant, consume → succeeds.

## Phase 3 — Uncle grant (browser, Rolan + Mehedi)

1. **Rolan** → Eli's Sharing screen → The Crew → Add: mehedikamal@gmail.com,
   relationship "Uncle", all classes.
   - Verify: status shows "active" immediately (under-13 → no cooling-off).
2. **Mehedi** → /village → sees "Eli Chowdhury" as Uncle → opens
   /village/[childId].
   - Verify: classes, grades, due dates visible. **Verify ABSENT:** no health
     data, no teacher messaging, no grade editing, no check-in data.
3. **Mehedi** sends kudos → **Rolan/Eli** see it on the Sharing screen.
4. **Rolan** → The Crew → Remove Mehedi → confirm.
   - Verify: Mehedi's /village no longer lists Eli; /village/[childId]
     returns access error. Instant, no questions.
5. Check `mentor_access_log` has Mehedi's overview views (audit trail).

## Phase 4 — School sync (WIN laptop / worker)

**Requires:** WIN laptop (windows-laptop) — Cobb Conditional Access blocks
sandbox logins (53003). Do NOT attempt portal login from the VM.

1. **Rolan** → Eli's Portals settings → add StudentVue:
   username `eli.chowdhury@students.cobbk12.org`, password (in-memory only).
   - Verify: row appears as `unverified` → test-connection → `vault_material`
     ok (proves Vault round-trip, NOT portal login).
2. On WIN: run the student sync worker for Eli's credentials
   (same path as dawson-windows-sync.py).
   - Verify: grades/classes/assignments land in `classes`, `grades`,
     `assignments` for Eli's child_id.
   - Verify: Sync Command Center shows the run in the log.
3. **Mehedi** (re-granted as uncle) → /village/[eli] → sees Eli's real classes.
4. Add CTLS Learn + O365 (Outlook) credentials the same way.
   - O365 calendar ingest: worker pulls Outlook calendar → student calendar UI.
     (Ingest service: verify `school-calendar.ts` picks up the events.)

## Phase 5 — Cleanup

- Remove Eli's test data from staging (children row cascades: child_access,
  child_mentors, parental_consents, child_portals + Vault secrets).
- Revoke the O365/StudentVue credentials (removePortal).
- Eli's password: never written to disk; in-memory only, discarded after test.

## Known gaps (Squad Cradle findings)

1. **Migration 069 (shared shopping) not applied live** — 070 (village) and 076
   (parental consent) are live as of 2026-10-12. 069 still needs the dashboard.
2. **No transactional email** — invite links are out-of-band (verifyUrl).
   `sendChildInvite` has a TODO for Resend.
3. **verify-credential Edge Function is a stub** — "test connection" proves
   Vault integrity, not portal login. Live portal verification is future work.
4. **No Outlook calendar ingest service** — O365 credential storage exists
   (`o365` portal key), but no worker pulls the calendar yet. Flagged for the
   sync team.
5. **Production under-13 consent** needs the real verification method
   (signed form / ID check). The test uses `in_app_parent_attestation` —
   do NOT ship this method name to production without the compliance review.
