# Pookie Threat Model — Phase 0

**Date:** 2026-10-12 · **Author:** Security Engineer, Platform Team 2 (Shared Services & API)
**Scope:** Phase 0 attack surface — auth sessions, child_access grants, visibility-scope filtering,
support tickets/agent tooling, credential vault, link codes, sync queue.
**Status:** Living doc; re-run at every access-model migration.

## 1. Assets (what we're protecting)

| # | Asset | Why it matters |
|---|---|---|
| A1 | Auth sessions (Supabase JWTs, active-child cookie) | Session theft = full account impersonation |
| A2 | `child_access` grants (+ `granted_by` authority, revoke matrix) | Child-as-access-authority is the product's core promise; a bypassed revoke endangers teens |
| A3 | Visibility scopes (Performance / Communications / Reflection / Wellness, H0–H3 health tiers) | Teen-private data (check-in text, mood, H2/H3 metrics, reflections, AI chats) reaching a parent is the highest-harm disclosure |
| A4 | Health data (W22 metrics, W23 nutrition logs) | COPPA/GIPA/42 CFR Part 2 exposure; FDA wellness boundary |
| A5 | Credential vault (school portal usernames/passwords) | GIPA "personal information"; breach = O.C.G.A. § 10-1-912 event |
| A6 | Support tickets + `teen_privacy` flag + agent reads | Support agents are insiders; unaudited reads of teen health/grades = trust failure |
| A7 | Link codes + invite tokens | Bearer capabilities; enumeration = account-linking oracle |
| A8 | Agent scoped JWTs (`agent_reader` role, `agent_tenant_scope`) | Privilege-escalation path if scope can be widened |

## 2. Trust boundaries

```
[Browser] --HTTPS--> [Next.js route handlers (/api/v1/*)] --user JWT--> [Supabase PostgREST (RLS)]
        |                         |--service_role RPCs--> [Vault / SECURITY DEFINER functions]
        |                         |--child_id + messages--> [pookie-tutor worker (external, unaudited)]
        |--> [Supabase Auth (sessions, magic link, OAuth)]
[Support agent tooling] --scoped agent JWT--> [PostgREST]  (never Vault, never auth.users)
[Sync workers] --service_role--> [sync queue, credential vault]
```

Key assumptions: (a) RLS is the real perimeter — the client bundle and any direct
PostgREST caller are untrusted; "no UI path" is not a control. (b) `child_id` from
a URL/body is a *selection*, never authorization. (c) `next/headers` cookie writes
never propagate to constructed `NextResponse` on Workers (NFR-RELIABILITY-001) —
session-loss bugs push teams toward insecure fallbacks, so the rule is itself a
security control.

## 3. Top 5 threats

**T1 — Teen-private data disclosed to parents via permissive RLS.** *FOUND LIVE:*
`006_w1_school_core.sql:307-309` (`checkins_tenant_read`) lets any tenant member —
including parents — `SELECT` raw check-in rows (`mood, energy, stress, text`) directly
via PostgREST; the "enforced in the route" claim (006:138-140) is false because no
route guards direct PostgREST access. Same migration's `checkins_member_update`
(006:316-319) lets a parent *overwrite* a teen's check-in text. This violates
FR-SCHOOL-003 and FR-ACCESS-006. *Mitigation:* per-scope RLS (parents get a
SECURITY DEFINER aggregate view — counts/averages, never text), teen-only
UPDATE/DELETE on own rows, `resolve_visible_scopes()` enforced on every `/api/v1`
route (Backend pending).

**T2 — Invite/link-code enumeration oracles.** *FOUND LIVE:*
`src/server/errors.ts:71-72` maps `consume_invite()` failures to two distinct
envelopes (`INVITE_NOT_FOUND` vs `INVITE_EMAIL_MISMATCH` with different human
messages), so probing `/api/v1/invites/consume` confirms a valid token exists —
an oracle on bearer capabilities, violating NFR-PRIVACY-005 / FR-AUTH-009.
*Mitigation:* collapse both to one code/message ("invalid or expired"); rate-limit
consume; lockout at N attempts (link codes already specify 5 in pending 019).

**T3 — Scope confusion: role/tenant checks treated as scope authorization.**
`assertTenant()` returns `role: 'parent'|'child'` but scope (Performance vs
Reflection/Wellness, H-tiers) is not yet resolved anywhere — no
`resolve_visible_scopes()` exists in the tree (Backend pending). Every new route is
one forgotten check away from serving teen-private scopes to a parent, and the
external tutor worker (`src/app/api/v1/tutor/chat/route.ts`) passes `child_id`
with no evidence of scope filtering on the worker path. *Mitigation:* single
scope-resolution middleware in the `handleRoute` chain; deny-by-default scope
matrix; worker scope attestation + server-side response filtering (FR-AI-003).

**T4 — Support-agent overreach (S3 backend pending).** Two human agents get
ticket content + user contact; the spec (FR-SUPPORT-004/005) requires the agent
role to be unable to reach health/grades without in-thread teen consent, the
`teen_privacy` flag enforced at the API layer, and every agent read audit-logged
and teen-visible. None of this exists yet (S1/S2/S3 are menu seedlings only,
`src/lib/modules.ts:116-122`). *Mitigation:* dedicated agent role with zero grants
on health/school tables; consent-gated break-glass (24h TTL); append-only
`ticket_events`; teen-visible access log (Settings → Privacy).

**T5 — Session loss from Workers cookie mishandling drives insecure fallbacks.**
The 2026-10-12 post-login 404 showed a dropped `Set-Cookie` on a constructed
redirect. When sessions silently die, teams reach for long-lived tokens in
localStorage or query params. *Mitigation:* NFR-RELIABILITY-001 pattern
(reference: `src/app/auth/callback/route.ts`, commit 538f288); sweep found zero
violations in current route handlers; add a CI grep gate.

## 4. Standing invariants (fail-closed defaults)

1. Under-13: server-side ban on login/session/link-code/invite/persistent identifiers (FR-AGE-001).
2. Visibility scopes: deny-by-default; Reflection/Wellness/H2/H3 never parent-visible without the teen's grant; safety-comms scope never revocable (FR-SAFETY-003).
3. `granted_by='child'` rows are untouchable by any parent, server-side (FR-ACCESS-004).
4. Vault secrets: never in logs, never to clients, rotation + cryptographic erasure (NFR-SEC-006).
5. MD decisions honored: D2 AI "NEVER train" (no absolute promise until DPA verified); D7 location coarse-only (city/ZIP max, never precise GPS); D3 Washington MHMDA compliance; D5 second-parent invite-only v1.

## 5. Open / pending re-audit

- `resolve_visible_scopes()` + scope middleware (Backend) — not landed.
- `access_events` table, `granted_by` enforcement, link codes, access requests
  (migrations 018–020 untracked on disk, not committed) — pending.
- Support RBAC + `teen_privacy` API enforcement + agent-read audit (no tables/routes yet) — pending.
- Health-tier migration chain 022–024 (untracked) and W25 wellbeing — pending.
- Counsel-gated items (NFR-LEGAL-001..010) are legal gates, not technical findings; tracked separately.
