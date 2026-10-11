# Audit Findings — UI Full-Stack Review of Migration 001 (tenancy_core)

**Auditor:** UI Full-Stack (Next.js 16 / React 19 / Tailwind) — Engineering Pod
**Date:** 2026-10-11
**Scope:** `supabase/migrations/001_tenancy_core.sql` reviewed from the App Router perspective
(tenant slug resolution, auth-window rendering, per-request RLS re-validation).
Related migrations 002–005 consulted where they touch the frontend data layer.
**Status:** Findings only. No migration files were edited.

Severity scale: **CRITICAL** (blocks tenant isolation), **HIGH** (isolation or integrity risk),
**MEDIUM** (wrong-shell / wrong-data risk the frontend must compensate for), **LOW** (edge case),
**INFO** (confirmed sufficient — standard can rely on it).

---

## HIGH-1 — `child_portals_public` view bypasses tenant scoping (definer-rights view)

**Location:** `003_credential_vault.sql` — `CREATE OR REPLACE VIEW public.child_portals_public AS ...`
with `GRANT SELECT ... TO authenticated` after `REVOKE ALL ON child_portals FROM anon, authenticated`.

**Finding:** The view is created without `security_invoker = true`. Under default Postgres view
semantics it executes with the *view owner's* rights (the migration runs as the `postgres`
superuser), so the RLS policies on the underlying `child_portals` table are bypassed for queries
through the view — superusers bypass RLS, and the permission check uses the owner, not the caller.
The view has **no tenant filter** in its definition. Net effect: **any authenticated user can
SELECT portal metadata (username, label, status, last_verified_at) for every tenant's portals.**

**Frontend consequence:** The Portals UI (parent-facing) must not treat this view as tenant-scoped.
Until fixed, every portals query from the app must go through a Server Component / Server Action
helper that re-filters by `child_id ∈ caller's child_access` — or better, query the base table via
service_role-free RLS path after the DB fix lands.

**Recommendation (DB pod):** recreate the view `WITH (security_invoker = true)`, or replace it
with a tenant-filtered definer function. This is the single highest-priority cross-pod fix in this
audit.

---

## HIGH-2 — `invites_parent_write` allows allowlist inserts with zero membership

**Location:** `001` — `CREATE POLICY invites_parent_write ... FOR ALL USING (child_id IS NULL OR child_id = ANY (current_child_ids()))`.

**Finding:** For a row with `child_id IS NULL` the USING clause passes with an **empty**
`current_child_ids()` set — i.e. a brand-new authenticated user who is still in the
role-default window (see MEDIUM-1), with zero `child_access` rows, can INSERT invite rows
(child_id NULL). Those rows are then consumable by any email the attacker controls via
`consume_invite`, which creates child shells and `child_access` membership for attacker emails.
The invite allowlist is therefore self-service, not parent-curated, at the policy layer.

**Frontend consequence:** The app's "Invite family member" UI must be parent-gated in the layout
(require a parent-role `child_access` row), but UI gating is not enforcement — this needs a policy
fix.

**Recommendation (DB pod):** require parent membership for INSERT/UPDATE/DELETE on `invites`
(e.g. route creation through a `SECURITY DEFINER` function that asserts a parent-role row, the same
pattern already used for `consents_parent_insert`), or tighten the policy to
`EXISTS (parent child_access row for the inviter)` with no NULL-child_id carve-out for
non-members.

---

## MEDIUM-1 — `users.role` defaults to `'parent'`; invite consumption corrects it later

**Location:** `001` — `handle_new_auth_user()` inserts `role='parent'`; `consume_invite()` only
downgrades to `'child'` when the invite says so.

**Finding:** There is a window (and, for invites never consumed via the child path, a permanent
state) where `users.role` does not reflect the user's true role. The trigger comment itself says
"default; corrected by invite consumption or admin."

**Frontend consequence — hard rule:** **`users.role` must never be used to decide which shell to
render.** All shell branching (parent dashboard vs child dashboard vs switcher vs pending-invite)
must derive exclusively from `child_access` rows for `auth.uid()`:

| child_access rows | Render |
|---|---|
| 0 | Pending-invite / onboarding state. **Render no tenant data, no tenant shell.** Offer "check invites" (consume) and "request access". |
| 1, role='child' | Straight into that child's routes. No switcher, ever. |
| 1, role='parent' | Straight into that child's parent view. |
| N, role='parent' | Child-switcher cards, then per-child dashboard. |

RLS fails closed during this window (`current_child_ids()` is empty ⇒ no tenant rows readable),
so no data leaks — but the layout must still handle the 0-row case explicitly or the user sees an
empty/broken shell.

---

## MEDIUM-2 — `children.slug`: globally unique but unconstrained in format and case

**Location:** `001` — `slug text UNIQUE NOT NULL`.

**Findings:**
1. **INFO — uniqueness is sufficient** for `/c/[childSlug]` resolution: one slug ⇒ at most one
   row, and the lookup `SELECT id FROM children WHERE slug = $1` issued through the request's
   RLS-enforcing client returns zero rows for spoofed/foreign slugs (the `children_tenant_read`
   policy does the per-request re-validation). This is the correct resolution pattern — see
   handbook §8.4.
2. **No format constraint.** Nothing stops a slug like `../../x`, `a b`, or `Dawson-Kamal` at the
   DB layer. A slug with path-unsafe characters breaks route matching in confusing ways.
3. **UNIQUE is case-sensitive.** `Dawson-Kamal` and `dawson-kamal` can coexist as different tenants
   while looking identical to a human — a spoofing/phishing vector at the tenant layer.

**Frontend consequence:** All slug writes (child creation, slug rename, invite-consumed shell
rename) must go through a Server Action that enforces `^[a-z0-9-]{3,64}$` and lowercases before
insert, presenting a friendly error on unique-violation. Route resolution should lowercase the URL
segment before lookup (or 404 consistently).

**Recommendation (DB pod):** add `CHECK (slug ~ '^[a-z0-9-]{3,64}$')` — belt and suspenders.

---

## MEDIUM-3 — Archived children remain RLS-readable

**Location:** `001` — `status ... DEFAULT 'active' CHECK (status IN ('active','archived'))`;
`children_tenant_read` does not filter on `status`.

**Finding:** A slug belonging to an archived child still resolves through RLS to a valid row.
The `/c/[slug]` layout would then render a tenant shell for a dead tenant (grades, sync buttons,
etc.) with no data-owner intent behind it.

**Frontend consequence:** The slug-resolution query in the `[childSlug]` layout MUST include
`status = 'active'`. Archived slugs → `notFound()` (or a parent-only "archived" view). Child
deletion UI should prefer `status='archived'` over DELETE — note `children_parent_write` is
`FOR ALL`, so parents can hard-delete children rows today; the frontend must not offer hard
delete without an explicit destructive-confirm + audit event.

---

## MEDIUM-4 — `current_child_ids()` is STABLE/DEFINER: correct per-request, dangerous to cache

**Location:** `001` — `current_child_ids()` marked `STABLE, SECURITY DEFINER`.

**Finding:** The helper is safe for the App Router's per-request Server Component model (evaluated
per query with the request's `auth.uid()`). It is **not** safe to lift into a cached function that
loses request context. With `cacheComponents: true` in `next.config.ts`, a `'use cache'` function
may not call `cookies()`/read the session; tenant-membership results must never be cached in a way
that survives access revocation.

**Frontend consequence (standard):** resolve slug→`child_id` on **every request** in the
`[childSlug]` layout with the request-scoped client; never persist `child_id`→membership in a
server cache, and treat any browser-cached tenant context as a hint only (server re-validates).
`'use cache: private'` for session reads is acceptable only for non-authoritative UI hints.

---

## LOW-1 — `consume_invite` email comparison is case-sensitive

**Location:** `001` — `IF v_invite.email <> (SELECT email FROM public.users ...)`.

**Finding:** If the invite was created with `Parent@Example.com` and the auth email is stored
lowercase, consumption raises `invite_email_mismatch` for a legitimate user.

**Frontend consequence:** lowercase (and trim) the email before calling `consume_invite`, and show
the invite token UI with a clear "ask your parent to re-send" path on `invite_email_mismatch`.

---

## LOW-2 — Default-child index keys off `parent_user_id` (billing anchor, not access)

**Location:** `001` — `children_one_default_per_parent ON (parent_user_id) WHERE is_default`.

**Finding:** The plan (§4.2) is explicit that `parent_user_id` is never the access mechanism.
A frontend "jump to default child" that prefers `is_default` over `child_access` would contradict
the isolation model (e.g. a second parent in the tenant set has no `parent_user_id` anchor).

**Frontend consequence:** default-child resolution = if exactly one `child_access` row, use it;
else use an explicit per-user preference (localStorage/server setting), never `parent_user_id`.

---

## INFO — What the schema gets right (standards may rely on)

1. **Slug ⇒ row ⇒ child_id ⇒ RLS chain is complete.** `children.slug UNIQUE` + `child_access`
   as single source of truth + `current_child_ids()` gives the App Router everything needed for
   slug-routed context with per-request re-validation — no session-stored tenant authority.
2. **`child_access_one_child_per_child_user`** (partial unique index) enforces "child-role ⇒
   exactly one child globally" at the DB layer, so the "no switcher ever for child-role users"
   rule (PLAN §4.1) has a hard backstop.
3. **RLS fails closed for the 0-row window** — new users see nothing until invite consumption.
4. **`get_tenant_secret` / `set_tenant_secret`** assert membership server-side; the frontend must
   never call these with a client-supplied `child_id` without first resolving it from the route
   slug (handbook §8.6).

---

## Required frontend compensations (checklist for the build)

- [ ] `[childSlug]` layout resolves slug→child_id via RLS client **every request**, filters
      `status='active'`, lowercases slug, and 404s on zero rows (never redirects to a guessed child).
- [ ] Shell branching reads `child_access` only — never `users.role`.
- [ ] 0-row state renders pending-invite/onboarding with zero tenant chrome.
- [ ] Portals UI does not rely on `child_portals_public` scoping (until HIGH-1 fixed).
- [ ] Invite-creation UI requires a parent-role `child_access` row (until HIGH-2 fixed).
- [ ] Slug writes validated `^[a-z0-9-]{3,64}$`, lowercased, unique-violation handled.
- [ ] No server-cache of tenant membership across requests.
