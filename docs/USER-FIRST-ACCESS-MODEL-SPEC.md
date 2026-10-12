# Pookie User-First Access Model — Build Spec

**Locked by Mehedi 2026-10-12.** Pookie is the *user's* personal assistant. Parent/child oversight is an optional feature, not the product identity.

---

## 1. Product principles

1. Any adult can sign up and get a working Pookie with zero friction. No invite gate on the user's own account.
2. The **child is the access authority** over their own records. A grant made by the child cannot be vetoed or revoked by any parent.
3. Age-appropriate agency: stewardship → shared agency → full ownership.
4. Independence is framed as graduation, never punishment.
5. All access decisions are enforced server-side. The client never derives roles.

---

## 2. Signup & onboarding flow

```
Sign in (Google OAuth / email magic link)
  → Supabase auth user created
  → profiles row created (onboarding_completed = false)
  → /onboarding
      Step 1: "Welcome — what should I call you?" (display_name)
      Step 2: "Do you want to track children in Pookie?" [Yes / Skip for now]
        → Yes: Add child form (name, birthdate, optional email)
             → birthdate < 13y: parent-managed profile (no login)
             → birthdate ≥ 13y + email: send verification invite
             → birthdate ≥ 13y, no email: parent-managed, email addable later
        → Skip: straight to personal dashboard ("just me" mode)
      Step 3: Done → dashboard
```

- Onboarding is skippable at every step. A "Skip for now" user can add children later from Settings → Family.
- `profiles.onboarding_completed` gates the redirect: first login → `/onboarding` until complete.

---

## 3. Child access authority matrix

Core rule: **only the granter or the child can revoke a grant.** Parent A can never revoke a grant made by the child to Parent B.

| Action | Child 13+ | Parent (creator) | Other parent/adult |
|---|---|---|---|
| Grant access to a new adult | ✅ | ✅ | ❌ (may request) |
| Revoke access the child granted | ✅ | ❌ | ❌ |
| Revoke access a parent granted | ✅ own grants only | ✅ own grants only | ❌ |
| Revoke the child's own access | — (impossible) | ❌ | ❌ |
| Request access (→ child approves) | — | — | ✅ |

### Enforcement
- `child_access.granted_by` ∈ `'child' | 'parent' | 'system'` on every row. Revoke RPCs check `granted_by` server-side.
- Roles are assigned by server functions only. `cannot_invite_self` guard. A user can never self-grant `parent` on a child.

---

## 4. Age tiers

### Under 13 — Stewardship (COPPA)
- Parent creates a parent-managed profile. No child login, no child-prompted data collection.
- Creating parent = steward: full control, may grant the other parent.
- Age gate at profile creation from `children.birthdate`.
- Privacy policy must reflect no direct data collection from under-13s.

### 13–15 — Shared agency (cooling-off)
- Teen gets the "Who can see my stuff?" Sharing screen.
- May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**: scheduled, cancellable anytime, both parents notified immediately (told, not asked).
- Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today."
- Informed consent on first link: explicit "I understand Mom/Dad can see [grades, check-ins, health]" checkbox in the teen's own session — not a passive click.

### 16–17 — Full agency
- Same as 13–15 but revocation is instant. Always reversible by the teen (one-tap re-grant, no guilt screens).

### 18+ — Ownership with continuity (locked 2026-10-12)
- **Parents who had access keep access by default.** No birthday disruption.
- First login after 18th birthday shows one prompt: "You're an adult now — your Pookie is fully yours. [Mom ✓] [Dad ✓] can see your info. Keep as is, or change it anytime." [Keep as is] / [Review sharing].
- Skipping = continuity. A quiet line persists in Settings → Sharing: "You're 18+ — you're in control here."
- The adult child may remove/add either or both parents at any time, instantly reversible.
- Historical data: parent keeps what they already saw; loses all future access from the revoke point.
- Data-source handoff: if the revoked parent connected school credentials, guide the young adult to connect their own rather than going dark.
- FERPA: rights transfer to the student at 18; student-in-control model is compliant.

---

## 5. Child linking methods

### Email invite (existing, hardened)
- Parent enters child's email → 7-day expiring token → child clicks → **must sign in with the matching email** → consent screen → linked.
- Anti-abuse: rate limits, `cannot_invite_self`, `duplicate_pending_invite` guard, inviter named in the email, teen can permanently block an adult from requesting.

### Link code (new)
- Parent generates a 6-digit code in-app → 15-minute expiry, single use → teen enters it on their device during signup → verified + linked.
- For same-room families. Faster than email, no inbox round-trip.

### Claim dedupe
- When a verifying email matches a parent-managed profile (fuzzy name + birthdate), offer "Is this you? Link your login to your existing profile" instead of creating a duplicate.

---

## 6. "Go independent" (13–17)

- Positioned as graduation: confetti, "your own Pookie" — the teen gains a full personal assistant, not just loses oversight.
- 13–15: 7-day cooling-off, cancellable, parents notified.
- 16–17: instant, reversible.
- Marketing rule: **"Pookie grows with your child — from you managing everything, to shared oversight, to their own independent assistant."** Never "your teen can cut you off."

---

## 7. "Just me" mode

- Users with no children get a personal life dashboard (their mail, tasks, health, shopping — the non-child modules).
- Never show empty-state parenting upsells. Adding children later is available in Settings → Family, not pushed.

---

## 8. Database migrations

| Migration | Contents |
|---|---|
| `017_profiles.sql` | `profiles` (user_id PK → auth.users, display_name, onboarding_completed bool, created_at). RLS: user reads/writes own row. |
| `018_access_authority.sql` | `child_access.granted_by` text NOT NULL DEFAULT 'system'; `child_access.status` ('active','revoked'); backfill existing rows as `granted_by='parent'`. Revoke RPCs enforce the matrix §3. |
| `019_link_codes.sql` | `link_codes` (code_hash, child_id, created_by, expires_at, used_at, used_by). 6-digit, 15-min TTL, single use. |
| `020_access_requests.sql` | `access_requests` (child_id, requester_id, status 'pending'/'approved'/'denied'/'blocked', reviewed_at). "Request access" flow for non-parent adults. |

Migrations 015/016 (child invites) already in tree, unapplied — 017–020 build on them.

---

## 9. API surface (server actions / RPCs)

- `completeOnboarding(displayName)` → sets `profiles.onboarding_completed`
- `createChildProfile({ name, birthdate, email? })` → age-gated; under-13 or no-email = parent-managed
- `generateLinkCode(childId)` → 6-digit, 15-min
- `redeemLinkCode(code)` → verifies + links ( teen session )
- `grantAccess(childId, adultUserId)` → child or parent; sets `granted_by`
- `revokeAccess(childId, adultUserId)` → enforces matrix; 13–15 parent-revoke schedules cooling-off
- `requestAccess(childId)` → creates pending request; child approves/denies/blocks
- `goIndependent(childId)` → teen flow §6
- `graduateAt18(childId)` → fires on 18th birthday login; prompt, not suspension

---

## 10. UI screens

1. `/onboarding` — 3-step flow §2 (Nebula theme, skippable)
2. Settings → Family (v2) — add child, generate link code, send email invite, pending invites
3. Child Sharing screen — "Who can see my stuff?", per-person toggles, what's-visible list, approve/deny access requests, block adult
4. "Go independent" flow — graduation screens §6
5. 18th-birthday prompt — one-time §4
6. Personal dashboard ("just me" mode) — no-child home

---

## 11. Risks & mitigations (from 2026-10-12 review)

| # | Risk | Mitigation |
|---|---|---|
| 1 | Email verification ≠ real consent | Explicit "I understand" consent screen listing visible data, in teen's own session |
| 2 | Under-13 data (COPPA) | Parent-managed only; no child login; no child-prompted collection; policy updated |
| 3 | Blended-family gatekeeping | Child-grant model + request-access flow; notifying non-veto |
| 4 | Invite harassment | Rate limits, block list, inviter identity in email |
| 5 | Ghost duplicate profiles | Claim dedupe via fuzzy match on verify |
| 6 | Role escalation | Server-side assignment only; `granted_by` enforcement |
| 7 | 18 transition disputes | Continuity default; child-controlled; parent notified not consulted |
| 8 | Non-parent UX | Genuine "just me" dashboard; no upsell harassment |

---

*Spec locked 2026-10-12 by Mehedi. Build order: migrations 017–020 → onboarding → linking → sharing screens → independence flows.*
