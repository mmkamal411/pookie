# Frontend Auth Audit — Migration 001 (tenancy core)

**Reviewer:** Senior Frontend Developer, Pookie engineering pod (Frontend component patterns)
**Date:** 2026-10-11
**Scope:** read-only review of `supabase/migrations/001_tenancy_core.sql`, focused on
frontend-facing auth implications. References PLAN.md §4.1 (Identity → tenant
resolution). Nothing in the migration was edited.

**Headline verdict:** the DB-side tenancy model is sound (`child_access` as single
source of truth, RLS keyed on `current_child_ids()`, atomic invite consumption).
The findings below are all at the seams where the frontend meets the model —
write-policy over-permission, the pending-invite dead-end, and the places where
the frontend must not trust client state. None require reworking the model;
two (F1, F2) need a Director decision before the invite UI is built.

---

## CRITICAL

### F1. `invites_parent_write` is not parent-gated — child-role users can issue invites
- **Location:** `001_tenancy_core.sql` → `CREATE POLICY invites_parent_write` (`FOR ALL USING (child_id IS NULL OR child_id = ANY (public.current_child_ids()))`).
- **Finding:** The USING clause checks *membership*, not *role*. Any tenant member —
  including a `role='child'` user, who per the model holds exactly one row — can
  INSERT, UPDATE, and DELETE invite rows for their own tenant. Concretely, a child
  can mint an invite addressed to any email for their own `child_id`; when that
  email's owner completes OTP login, `consume_invite` (SECURITY DEFINER) will
  happily insert `child_access` for them. That is a child-initiated data-sharing
  path to third parties over a minor's education records, and it bypasses every
  "parent controls all disclosure" assumption in PLAN §4.2.
- **Also:** the same policy lets a child revoke or alter pending invites
  (`status` flips), which can break the parent's onboarding flows in confusing ways.
- **Recommendation:**
  1. Tighten the policy: add `AND EXISTS (SELECT 1 FROM public.child_access ca
     WHERE ca.user_id = auth.uid() AND ca.child_id = invites.child_id AND ca.role = 'parent')`
     to both USING and WITH CHECK.
  2. Frontend (defense in depth, regardless of the fix): never render invite
     issuance, revocation, or the Family → Invites UI unless the resolved access
     rows contain at least one `role='parent'` row. Child-role sessions must not
     even see the affordance.

### F2. `child_id IS NULL` invite creation = de facto open signup
- **Location:** same policy (the `child_id IS NULL` OR-branch) + `consume_invite`
  child-shell branch (`INSERT INTO public.children ... VALUES (auth.uid(), 'New', 'Child', ...)`).
- **Finding:** ANY authenticated user — including one with zero `child_access` rows
  — satisfies `child_id IS NULL` and can therefore INSERT an invite addressed to
  their own email, then call `consume_invite` to auto-create a child shell with
  themselves as parent. Read policy (`invites_parent_read`) already lets a 0-row
  user read their own-email invites, so the whole loop is client-executable. This
  is a public self-provisioning path, whether or not the product intends one.
- **Recommendation:** Director decision needed before the pending-invite UI is built:
  - If Pookie is **closed/invite-only**: gate `child_id IS NULL` invite creation to
    service role / an admin RPC, and the pending-invite screen offers only
    "request access" (see F3).
  - If **open signup** is intended: keep it, but the frontend must then own the
    new-family onboarding wizard (profile completion for the 'New'/'Child'
    placeholder row, slug assignment) — and the placeholder naming (`first_name='New'`,
    `last_name='Child'`) must never be shown raw to users.

---

## HIGH

### F3. Pending-invite state has no backend for "request access notifies the parent"
- **Location:** PLAN §4.1 login flow ("none → pending-invite state … 'request access'
  notifies the parent") vs 001 (no `access_requests` table, no notification path).
- **Finding:** A user with 0 `child_access` rows and no invite lands in the
  pending-invite state, but the migration provides no write target for the request.
  If the frontend ships a "Request access" button with nothing behind it, it is a
  UX dead-end that *looks* functional — worse than a screen that admits it can't help.
- **Recommendation:**
  1. Backend: add an `access_requests` table (requester email, target child/parent,
     status, timestamps, RLS: requester inserts own; target parents read) before
     the button is wired; or define the email-to-parent notification path explicitly.
  2. Frontend until then: the pending-invite screen must be informational-only —
     signed-in identity, "no family workspace found", and a human contact path
     ("ask your parent to send an invite to this exact email"), with copy that
     names the signed-in email so case/alias mismatches are diagnosable (see F6).

### F4. Shared-device session leakage via `active_child_id` in localStorage
- **Location:** PLAN §4.1 ("`active_child_id`, app state + per-user localStorage").
- **Finding:** RLS protects server reads, but it does not protect the *client*: a
  family tablet where parent signs out and child signs in will hand the new session
  a stale `active_child_id` and warm caches (React Query, in-memory stores, service
  worker) from the previous tenant. Optimistic rendering can flash the wrong
  child's data or, more subtly, show the wrong child's name/photo in the shell
  while queries re-resolve.
- **Recommendation:**
  1. Namespace the key per auth user: `pookie:active_child:<auth.users.id>`,
     never a global key.
  2. On sign-out: clear all `pookie:*` localStorage keys AND reset in-memory
     query caches. On sign-in: treat any stored `active_child_id` as a *hint*;
     re-fetch the access set from the server first, intersect, and only then render.
  3. Sign-in with a different email than the previous session = full client state
     reset, not a soft swap.

### F5. Never gate role UI on `users.role` — it lies between signup and invite consumption
- **Location:** `handle_new_auth_user()` defaults `users.role = 'parent'`;
  `consume_invite` corrects to `'child'` only when the invite says so.
- **Finding:** For the entire window between OTP signup and invite consumption, a
  child invitee's `users.role` reads `'parent'`. Any frontend branch on
  `users.role` (dashboard variant, switcher visibility, Family menu) will
  misclassify the user during exactly the onboarding moment when correctness
  matters most.
- **Recommendation:** Frontend derives role **exclusively** from the
  `child_access` rows fetched post-login (`SELECT child_id, role ... WHERE user_id = auth.uid()`).
  Treat `users.role` as display metadata only. Same rule applies to `children.parent_user_id`
  — it is a billing anchor, never an access signal.

### F6. Invite email matching is case-sensitive — dead-end on mixed-case invites
- **Location:** `consume_invite`: `IF v_invite.email <> (SELECT email FROM public.users WHERE id = auth.uid())`.
- **Finding:** If the inviting parent typed `Dawson@Gmail.com` and Auth stored
  `dawson@gmail.com`, consumption raises `invite_email_mismatch` with no recovery
  path — the user did everything right and is stuck. Auth email normalization is
  outside the frontend's control.
- **Recommendation:**
  1. Backend: compare `LOWER()` on both sides (one-line fix in the RPC).
  2. Frontend: lowercase + trim the email in the invite-issuance form before
     INSERT; the pending-invite screen shows the signed-in email verbatim so the
     user can spot alias/case mismatches themselves.

---

## MEDIUM

### F7. `consume_invite` error codes are an oracle — do not echo them
- **Location:** `consume_invite` raises `invite_not_found_or_expired` vs
  `invite_email_mismatch`.
- **Finding:** A token holder can distinguish "bad/expired token" from "valid
  token, wrong email". Tokens are 192-bit (`gen_random_bytes(24)` hex) so brute
  force is infeasible — this is hygiene, not an emergency. But raw codes in UI
  copy would also confuse users.
- **Recommendation:** Frontend maps every consume failure to one generic message
  ("This invite link didn't work — it may have expired or been sent to a different
  email."). Log the raw code to console/telemetry only, never render it.

### F8. Concurrent double-consume is safe but needs graceful UX
- **Location:** `consume_invite` (`SELECT ... FOR UPDATE`, `ON CONFLICT DO NOTHING`).
- **Finding:** The transaction is atomic — two devices racing on one invite cannot
  double-provision. The loser gets `invite_not_found_or_expired`, which is also the
  code for "your co-parent already accepted this for you". Showing a failure screen
  here is wrong: the user may legitimately have access already.
- **Recommendation:** On ANY consume failure, re-run tenant resolution
  (`child_access` fetch). If rows exist → route to the normal flow; only if still
  0 rows → show the F7 generic message.

### F9. Revoked-mid-session access: client must handle RLS-denied gracefully
- **Location:** RLS evaluates per query (server enforcement is continuous); the SPA
  holds `active_child_id` + cached rows.
- **Finding:** If a parent revokes access while the user is logged in, subsequent
  queries return empty sets — the app must not render a broken dashboard or, worse,
  keep showing cached rows as if live. This is the one place "server re-validates"
  needs a client-side reaction.
- **Recommendation:** Global data-layer handler: on empty-tenant-set responses
  (or 0-row re-resolution), drop to switcher if other rows exist, else to the
  pending-invite state, and purge the dead tenant's cache. Re-resolve the access
  set on window focus (cheap query, high value on shared devices).

### F10. Child-role users must be bounced from the switcher route itself
- **Location:** PLAN §4.1 ("No switcher ever rendered for child-role users").
- **Finding:** "Never render" is a render-time statement; users can still *navigate*
  to `/switcher` via bookmark, history, or a stale link. The partial unique index
  guarantees a child user holds exactly one row, so a switcher for them is always
  meaningless — but without a route guard it will render an empty/broken screen.
- **Recommendation:** Route guard on `/switcher` (and on `/family/**` management
  routes): if every access row is `role='child'`, redirect to that child's
  dashboard. Hide Family/Children management nav for child-role sessions entirely.

### F11. New-family placeholder child leaks into UI if the wizard is skipped
- **Location:** `consume_invite` child-shell branch: `first_name='New'`,
  `last_name='Child'`, `slug='child-<md5>'`.
- **Recommendation:** The onboarding wizard is mandatory, not optional, on the
  first login after shell creation (gated on `first_name='New'` or a profile
  completion flag — prefer an explicit flag over name-sniffing when the profile
  table lands). Until completed, dashboard shell must show neutral copy, never
  "New Child's Dashboard". Validate slug uniqueness server-side; client-side
  pre-check is a nicety only.

---

## LOW

### F12. OTP callback handling on Cloudflare Pages
- **Location:** login flow (PLAN §4.1), Supabase Auth on `*.pages.dev`.
- **Finding:** Nothing in 001, but the frontend owns it: email-link OTP arrives as
  `?token_hash=...&type=...` (PKCE) and must be exchanged on a dedicated
  `/auth/callback` route via `exchangeCodeForSession`, then **removed from the URL**
  with `router.replace` — a lingering token in the address bar is shareable and
  re-clickable. Rate-limit resend client-side; render the CAPTCHA container if the
  new project's Auth settings enable it.
- **Recommendation:** One callback route, code exchange, immediate URL strip,
  error copy that routes to "request a new link" (never exposes token state).

### F13. Invitee self-read of `invites` is required — keep it, don't widen it
- **Location:** `invites_parent_read` (`... OR email = (SELECT email FROM public.users WHERE id = auth.uid())`).
- **Finding:** Correct as-is: a 0-row user must be able to read their own pending
  invite to accept it. Frontend should fetch by own email only, and must never
  list raw `token` values in any UI (the accept flow consumes the token from the
  link or from the single fetched row, then discards it from state).

---

## Explicitly verified as sound (no finding)
- `consume_invite` is atomic (`FOR UPDATE` + single transaction); no TOCTOU on
  double-accept. The only race is UX-level (F8).
- Child single-tenancy is enforced at the DB level (partial unique index), so the
  "never render switcher for child-role" contract has a hard backstop.
- `current_child_ids()` is STABLE + SECURITY DEFINER with fixed `search_path` —
  safe for RLS use.
- `children.parent_user_id` is correctly *not* used in any access policy.
- `users_self_read` correctly restricts co-member reads to parent-role holders;
  child-role users see only their own row.

---

## Decisions needed from the Director (blocking invite UI)
1. **F2:** Closed/invite-only vs open self-provisioning for new families.
2. **F3:** Where "request access" goes — new `access_requests` table vs email notification vs deferred.
3. **F1:** Confirm RLS tightening on `invites_parent_write` (recommend: yes, parent-role only).
