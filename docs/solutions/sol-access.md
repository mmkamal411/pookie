# Pookie Access-Control & Identity — Buildable Solutions

**Designer:** access-control & identity solution designer (subagent) · 2026-10-12
**Inputs:** panel checklist `ACCESS-MODEL-REVIEW-CHECKLIST.md` (2026-10-12), locked spec `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12), migrations 015/016 in tree.
**Scope:** access logic, data model, enforcement. Screen copy/layout owned by UX designer; trusted-adult/crisis owned by safety designer.
**Rule applied throughout:** 🛑 = redesign, not workaround — panel fixes matched exactly. Design only: no code, no deploys.

**Migration map (continues the planned sequence):**

| Migration | Contents |
|---|---|
| 017 | `profiles` (planned) — **amended**: add `dob`, `dob_verified`, `legal_status` (§10) |
| 018 | `child_access.granted_by` + `status` (planned) — **amended**: add cooling-off/safe-exit/trusted-adult columns per panel §1.4.1 redesign (§1) |
| 019 | `link_codes` (planned) — base table |
| 020 | `access_requests` (planned) — **amended**: co-approval + lockout columns (§7) |
| 021 | `access_events` append-only audit (panel-required) (§3) |
| 022 | `access_scopes` — per-person × per-scope visibility (§2) |
| 023 | Data provenance tagging + safety channel (§4) |
| 024 | Claim dedupe + manual-review queue (§6) |
| 025 | Block list + households (§8) |
| 026 | Court orders (§9) |
| 027 | Link-code hardening: attempts, lockout, anti-coercion (§5) |
| 028 | Travel purchasing authority (§12) |

**Global conventions used below:** all mutations go through `SECURITY DEFINER` RPCs; `authenticated` role gets **no** INSERT/UPDATE/DELETE on access-control tables (RLS enabled, SELECT-only policies where needed); every RPC revokes PUBLIC execute and grants to `authenticated`/`service_role` explicitly (per 015 convention); every mutation RPC calls `log_access_event(...)` before returning.

**Assumed identity link (contract for other designers):** `children.user_id` = the teen's `auth.users.id` once linked (NULL while parent-managed). `children.birthdate` is the DOB source for age-tier computation. Age-tier function `effective_age_tier(child_id)` returns `'under13' | 't13_15' | 't16_17' | 'adult'`, consulting `children.legal_status` first (§10).

---

## 1. `granted_by` enforcement architecture (spec §3 + migration 018)

### 1.1 Schema — amendments to planned 018

```sql
-- child_access additions (018_access_authority.sql, amended)
ALTER TABLE child_access ADD COLUMN granted_by text NOT NULL DEFAULT 'system'
  CHECK (granted_by IN ('child','parent','system'));
ALTER TABLE child_access ADD COLUMN granted_by_user_id uuid;      -- WHO granted (NULL only when 'system')
ALTER TABLE child_access ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active','pending_cooling','revoked','suspended_court'));
ALTER TABLE child_access ADD COLUMN granted_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE child_access ADD COLUMN revoked_at timestamptz;
ALTER TABLE child_access ADD COLUMN revoked_by uuid;              -- actor who revoked
ALTER TABLE child_access ADD COLUMN revoke_reason_code text;      -- enum §3.4
-- Cooling-off / safe-exit (panel §1.4.1 redesign — see §1.4)
ALTER TABLE child_access ADD COLUMN cooling_off_until timestamptz;
ALTER TABLE child_access ADD COLUMN cooling_off_started_at timestamptz;
ALTER TABLE child_access ADD COLUMN frozen_view_at timestamptz;   -- parent sees data ≤ this ts during pending
ALTER TABLE child_access ADD COLUMN notify_mode text NOT NULL DEFAULT 'at_effect'
  CHECK (notify_mode IN ('at_effect','immediate','suppressed'));
ALTER TABLE child_access ADD COLUMN safe_exit bool NOT NULL DEFAULT false;
ALTER TABLE child_access ADD COLUMN trusted_adult_user_id uuid;   -- required before revoke executes (G1)
ALTER TABLE child_access ADD COLUMN trusted_adult_declined bool NOT NULL DEFAULT false;
-- Re-request lockout (§7)
ALTER TABLE child_access ADD COLUMN re_request_locked_until timestamptz;
```

**Backfill rule (existing rows):** rows created by the 015 `graduate_child_access` flow or the creating parent → `granted_by='parent'`, `granted_by_user_id` = the creating parent's user id (from `children.created_by` / invites.invited_by_user_id). Rows created by seed/migration scripts → `granted_by='system'`, `granted_by_user_id=NULL`. No row may remain with `granted_by='system'` if a human actor is identifiable — the backfill script must resolve via `invites` before defaulting.

### 1.2 RLS policy sketches — `child_access`

```sql
-- Reads: the grantee sees own row; the teen sees all rows on own record;
-- an adult with active access sees the roster (needed for Sharing screen).
CREATE POLICY ca_select ON child_access FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM children c WHERE c.id = child_access.child_id AND c.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM child_access mine
             WHERE mine.child_id = child_access.child_id
               AND mine.user_id = auth.uid() AND mine.status = 'active')
);
-- Writes: NONE for authenticated. All mutations via RPCs.
-- (No INSERT/UPDATE/DELETE policies → default-deny.)
```

### 1.3 `grant_access(p_child_id, p_adult_user_id, p_role DEFAULT 'parent')` — logic sketch

```
1. caller = auth.uid(); child = get_child(p_child_id)
2. REQUIRE caller is the teen (child.user_id = caller AND tier != under13)
        OR caller has active 'parent' access on child        -- spec §3 matrix
   ELSE raise 'not_authorized'
3. REQUIRE p_adult_user_id != caller AND != child.user_id    -- cannot_invite_self
4. REQUIRE no active access row already for (child, adult)   -- duplicate guard
5. REQUIRE adult not in blocked_adults for child             -- §8
6. REQUIRE re_request_locked_until IS NULL or past           -- §7, 30-day lockout
7. court = get_court_restrictions(child): if court.no_contact CONTAINS adult
        → raise 'court_order_denied' (teen told plainly why — §9)
8. IF tier in (t13_15) AND p_role != 'parent' AND granter is parent
        → create access_requests row (pending, needs teen approval) instead; RETURN 'pending_request'
   IF tier = t13_15 AND requester is non-parent adult (via requestAccess path — §7)
        → teen approval + parent co-approval gate (§7)
9. INSERT child_access(user_id=adult, child_id, role, granted_by =
        'child' if caller is teen else 'parent',
        granted_by_user_id = caller, status='active')
10. Apply default scopes (§2.4) — coerced-link variant if link flagged (§5)
11. log_access_event('grant', ...) ; RETURN access_id
```

Note: a **parent** granting another adult creates `granted_by='parent'` — revocable later only by that granting parent or the teen (§1.5). A **teen** granting creates `granted_by='child'` — parent-untouchable.

### 1.4 `revoke_access(p_child_id, p_adult_user_id, p_mode DEFAULT 'standard', p_reason_code)` — full matrix

**Authority check (server-side, in order):**

```
caller = auth.uid(); row = active child_access(child, adult)
A. caller == row.user_id                                   → ALLOW (self-revoke; leaving is not a veto)
B. caller == child.user_id (teen 13+)                      → ALLOW on ANY row  -- fixes grandparent deadlock
C. row.granted_by='parent' AND row.granted_by_user_id = caller
                                                           → ALLOW (parents revoke only own grants)
D. row.granted_by='child' AND caller is a parent           → DENY 'child_grant_untouchable'
E. row.granted_by='parent' AND row.granted_by_user_id != caller
                                                           → DENY 'not_your_grant'
F. row.status='suspended_court'                            → DENY 'court_order_locked' (human review only — §9)
G. caller is non-grantee, non-teen, non-granter            → DENY 'not_authorized'
```

**Preconditions (G1/G15 — trusted adult):** before any teen-initiated revoke of a parent executes, REQUIRE `trusted_adult_user_id IS NOT NULL OR trusted_adult_declined` on the row (or child-level `children.trusted_adult_user_id`). Else raise `trusted_adult_required` → client routes to the designation step (safety designer owns the screen). The teen's explicit "I understand no adult will be alerted" decline is recorded (`trusted_adult_declined=true`, event logged).

**Cooling-off state machine (13–15 revoking a parent) — panel §1.4.1 redesign:**

```
States: active ──revoke(13–15, parent)──▶ pending_cooling ──cron at effect──▶ revoked
              │                              │  ▲
              │                              │  │ teen cancels anytime
              │                              ▼  │
              │                           active (cancelled)
              └──revoke(16+)──▶ revoked (instant)
              └──revoke(safe_exit)──▶ revoked (instant, notification suppressed)

On entering pending_cooling:
  - cooling_off_started_at = now(); cooling_off_until = now() + 7 days
  - frozen_view_at = now()          -- parent's view frozen; NO new parent-visible syncs
  - notify_mode ∈ {at_effect (default), immediate} chosen by teen; safe_exit → 'suppressed'
  - During pending: resolve_visible_scopes() returns parent's scopes (UI shows access UNCHANGED —
    no "revoking in 6 days" banner), but every read applies created_at <= frozen_view_at.
  - log_access_event('cooling_off_started', notify_mode, safe_exit)

Cron `apply_cooling_off_revocations()` (daily, service_role):
  FOR row IN pending_cooling WHERE cooling_off_until <= now():
    status='revoked'; revoked_at=now()
    IF notify_mode='at_effect' → notify ONLY the revoked parent (never both), neutral copy
    IF notify_mode='immediate' → (already notified at initiation)
    Pause revoked parent's connected school credentials (§1.6)
    log_access_event('revoke_effective', ...)

Teen cancels: revoke_cancel(child, adult) → status='active', clear cooling fields,
  log_access_event('revoke_cancelled'). If notify_mode was 'immediate', cancellation
  does NOT un-notify — the confirm screen states this plainly.
```

**Safe-exit path:** teen selects "telling my parents could put me at risk" → `p_mode='safe_exit'` → immediate revoke, `notify_mode='suppressed'`, `safe_exit=true`, crisis resources surfaced (safety designer), trusted-adult notified if designated. Safe-exit UI is visually boring by design (no celebration). Logged as `safe_exit` event with `ip_hash`/`device_hash`.

**Post-revoke effects (all paths):**
- `revoke_access` NEVER touches the `safety_comms` scope or `safety_notices` delivery (§4) — non-toggleable, survives revoke AND block.
- Revoked parent's school credentials: `UPDATE sync_credentials SET paused_by_revoke=true, paused_at=now() WHERE connected_by_user_id=adult AND child_id=child` — revoked parent's creds must never keep syncing the teen's data (panel §1.5.2). Data-source handoff prompt queued for the teen.
- API tokens: grantee's per-child scoped tokens for this child are revoked/re-scoped (§11, I2).
- `re_request_locked_until = now() + 30 days` on the row (§7).

**Re-grant:** teen one-tap re-grant → new row `granted_by='child'`, reason `regrant`, event logged. No guilt screens.

### 1.5 ⚠️ CONFLICT C1 — cooling-off notification (spec vs panel)

The locked spec §4/§6 requires "both parents notified immediately" on 13–15 cooling-off. The panel marks this 🛑 — "the single most dangerous element in the spec" — and requires: teen chooses notify-now vs notify-at-effect (default at effect, **only the revoked parent, never both**), safe-exit path, frozen view during pending. **This design implements the panel fix.** The locked spec §4 and §6 cooling-off paragraphs need a Mehedi-approved amendment before build; do not build the spec's dual-immediate-notification version.

---

## 2. Visibility scopes §1.3.3 (migration 022)

### 2.1 Scope enum

`performance | communications | reflection | wellness | location | itinerary | safety_comms`

- `safety_comms` is special: never toggleable, never revoked, not stored per-person (see §2.5).
- Health sub-tiers H0–H3 (taxonomy owned by the health designer) integrate at the **data-row** level, not the grant level: every wellness row carries `health_tier ∈ {H0,H1,H2,H3}`. Contract: H0 = prohibited <18 (never leaves the teen's own session, no grantee, no aggregate); H1 = shareable wellness (flows when `wellness` scope allowed); H2 = teen-private (never grantee-visible, including aggregates); H3 = legally sensitive (teen-private + explicit per-record consent for any use). The access layer enforces these tags; the health designer defines what lands in each tier. **W2/W8/W23 must not hold real teen data until the taxonomy exists** (panel R9 gate).

### 2.2 Schema

```sql
-- 022_access_scopes.sql
CREATE TABLE access_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_id uuid NOT NULL REFERENCES child_access(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN
    ('performance','communications','reflection','wellness','location','itinerary')),
  allowed bool NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,                       -- the teen's user id (only teen or system writes)
  UNIQUE (access_id, scope)
);
-- safety_comms intentionally absent: it is not a per-person toggle.
```

`safety_comms` delivery is driven by `safety_notices` + recipient resolution (§4), not by `access_scopes`.

### 2.3 Data → scope mapping (13 school sources + health + location + social)

| Scope | Data included | Provenance |
|---|---|---|
| **performance** | Grades, GPA, per-class scores, assignments (due/submitted/graded), attendance, class schedule, transcripts, graduation-audit inputs, Path-to-90 forecast outputs, uploaded class materials/handouts, AI practice-quiz results, SAT prep progress, teacher gradebook comments | school_of_record (grades/attendance) + app_generated (quizzes, materials) |
| **communications** | Teacher email threads, school announcements, CTLS messages, permission-slip *content* (also mirrored to safety_comms), conference scheduling | school_of_record / safety_critical |
| **reflection** | Daily check-in text, reflections/journal, AI chat transcripts (Pookie/Muse), mood-adjacent free text, Path-to-90 checkbox states, check-in cross-check calibration output (teen-facing ONLY — panel Category 3 🛑: never parent-visible) | app_generated |
| **wellness** | Vitals, trends, sleep, activity, nutrition logs, mood pulse, Body & development, health-connection data; each row tagged H0–H3 | app_generated; H-tier governed |
| **location** | Coarse location (default), outing plans ("share my plan"), W25/W26/W29 location use; **no retained history <18** — rows carry `retained_until`, purged by cron (G14) | app_generated |
| **itinerary** | W30 flight itineraries, W31 rental-car reservations (adult view) | app_generated |
| **safety_comms** | Permission slips, field-trip/lab notices, incident reports, emergency notifications, break-glass medical info | safety_critical — always delivered |

Explicit exclusions: counselor mail is **segregated** (ASCA B.2) — never merged into the parent-visible communications feed; teen-only. Check-in cross-check output is `reflection`, teen-private default. Peer/Study-Spark content is curriculum-only, never cross-family identifiable (panel Category 5 🛑). Proactive nudges to parents are **never** derived from reflection/wellness rows (panel Category 2).

### 2.4 Defaults at link

On every new `child_access` row (grant, invite accept, link-code redeem), `grant_access` inserts scope rows:

```
performance=true, communications=true,
reflection=false, wellness=false, location=false, itinerary=false
```

- **Coerced-link variant** (§5): if the anti-coercion prompt returns "I was told to", all scopes default **false** (safety_comms still flows); the teen re-enables privately later.
- **18+ transition:** on `graduateAt18`, set `wellness=false, location=false, itinerary=false` pending affirmative re-consent (panel §1.6.2 🛑); `performance`/`communications` continue by default; `reflection` continues (child-authority toggle, teen can change anytime). ⚠️ See CONFLICT C2.
- Only the teen (or `system` on the above lifecycle events) may change `access_scopes.allowed`. Parents cannot toggle their own scopes up.

### 2.5 Scope-resolution — the single choke point

```sql
-- 022: used by EVERY read path. Returns scopes visible to viewer on child.
CREATE OR REPLACE FUNCTION resolve_visible_scopes(p_viewer uuid, p_child_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE teen uuid; acc child_access%ROWTYPE; out text[] := '{}';
BEGIN
  SELECT user_id INTO teen FROM children WHERE id = p_child_id;
  IF p_viewer = teen THEN
    RETURN ARRAY['performance','communications','reflection','wellness',
                 'location','itinerary','safety_comms'];   -- teen sees everything incl. H2/H3
  END IF;
  SELECT * INTO acc FROM child_access
   WHERE child_id=p_child_id AND user_id=p_viewer
     AND status IN ('active','pending_cooling') LIMIT 1;
  IF NOT FOUND THEN
    RETURN ARRAY['safety_comms'];  -- revoked/blocked/never-linked: safety channel ONLY (§1.2b.3, §1.3.5)
  END IF;
  SELECT array_agg(scope) INTO out FROM access_scopes
   WHERE access_id=acc.id AND allowed=true;
  RETURN out || 'safety_comms';
END $$;

CREATE OR REPLACE FUNCTION has_scope(p_viewer uuid, p_child_id uuid, p_scope text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS
$$ SELECT $3 = ANY (resolve_visible_scopes($1,$2)) $$;
```

**Wellness H-tier filter** (applied inside wellness read RPCs, after `has_scope(..., 'wellness')`):

```
rows where health_tier='H1' → visible
rows where health_tier IN ('H2','H3') → excluded for grantees (teen only)
rows where health_tier='H0' → excluded for everyone except teen; never aggregated
```

**pending_cooling frozen view:** read RPCs join the grantee's `child_access` row; if `status='pending_cooling'`, append `AND data.created_at <= acc.frozen_view_at`.

### 2.6 Mandatory server-side filtering rule

> **No briefing, digest, nudge, search result, teacher-draft, notification, or API response may include a child data row unless `has_scope(viewer, child_id, row.scope)` is true at query time.** Generation RPCs (`build_briefing`, `build_digest`, `draft_teacher_note`, nudge fan-out, `/api/v1/*`) call `resolve_visible_scopes()` once per (viewer, child) and filter in SQL, not in the client. The client may hide/show for UX; it never gates. Per-grantee API tokens carry the resolved scope set at issuance and are re-resolved on use (tokens invalidated on revoke/scope change — §11 I2).

Consent-screen data contract (for the UX designer, §1.2.1): the consent screen renders exactly the scope list with per-scope plain-language examples drawn from §2.3, health subcategories enumerated (never one "health" checkbox), check-in text + mood named explicitly, plus the school-transparency line: *"Pookie-only: your school still shares grades and official notices with your parents directly."*

### 2.7 ⚠️ CONFLICT C2 — 18+ continuity default vs health opt-in

Locked spec §4: "Parents who had access keep access by default." Panel §1.6.2 🛑: health needs **affirmative opt-in re-consent, skip = private**; Body & development requires fresh explicit grant. **Resolution adopted:** split continuity — `performance` + `communications` continue by default (FERPA-aligned, school-of-record); `wellness`, `location`, `itinerary` reset to private at 18 pending opt-in; `reflection` continues (child-authority). The 18th-birthday prompt must present health re-consent as an unavoidable keep/review decision (panel §1.6.1), with a 30-day grace then auto-restrict for health (panel §1.6.3). Spec §4 needs a Mehedi-approved amendment on this point.

---

## 3. `access_events` audit trail §1.3.6 (migration 021)

### 3.1 Schema — append-only

```sql
-- 021_access_events.sql
CREATE TABLE access_reason_codes ( code text PRIMARY KEY, description text NOT NULL );
INSERT INTO access_reason_codes VALUES
  ('teen_choice','Teen''s own sharing choice'),
  ('regrant','Teen re-granted after revoke'),
  ('safety_concern','Safety-driven change'),
  ('safe_exit_risk','Teen indicated telling parents could put them at risk'),
  ('household_change','Blended-family / household change'),
  ('cooling_off_expired','7-day cooling-off reached effect'),
  ('cooling_off_cancelled','Teen cancelled pending revoke'),
  ('court_order','Court-ordered change'),
  ('duplicate_cleanup','Claim-dedupe merge'),
  ('system_migration','Backfill / migration'),
  ('trusted_adult_request','Trusted adult involved'),
  ('coerced_link','Link completed under possible coercion flag'),
  ('credentials_paused','Revoked parent''s sync credentials paused');

CREATE TABLE access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  child_id uuid NOT NULL REFERENCES children(id),
  actor_user_id uuid,                       -- who acted; NULL = system/cron
  subject_user_id uuid,                      -- whose access changed
  event_type text NOT NULL CHECK (event_type IN (
    'grant','revoke_initiated','revoke_effective','revoke_cancelled',
    'cooling_off_started','safe_exit','request_created','request_approved',
    'request_denied','block_added','block_removed','link_code_redeemed',
    'invite_sent','invite_accepted','scope_changed','court_order_applied',
    'court_order_cleared','go_independent','regrant','credentials_paused')),
  granted_by text CHECK (granted_by IN ('child','parent','system')),
  reason_code text REFERENCES access_reason_codes(code),
  notify_mode text,                          -- at_effect | immediate | suppressed
  safe_exit bool NOT NULL DEFAULT false,
  device_hash text NOT NULL,                 -- sha256(salt || user_agent || ip)
  ip_hash text NOT NULL,                     -- sha256(salt || ip); never raw IP
  same_device bool,                          -- link-code redemption only
  coerced_flag bool NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',      -- e.g. {old_scopes,new_scopes}
  -- immutability: no UPDATE/DELETE policies; REVOKE ALL from authenticated except INSERT via RPC
);
CREATE INDEX access_events_child_time ON access_events(child_id, created_at DESC);
```

Salts for hashes live in the Secure Vault / server env, rotated annually; hashes are **not** reversible to IP.

### 3.2 Append points — every mutation writes an event

| Mutation RPC | Event(s) written |
|---|---|
| `grant_access` | `grant` (with `granted_by`, reason `teen_choice`) |
| `revoke_access` (13–15 parent) | `cooling_off_started` then cron writes `revoke_effective` (reason `cooling_off_expired`) |
| `revoke_access` (instant) | `revoke_initiated` + `revoke_effective` in one txn |
| `revoke_access` (safe_exit) | `safe_exit` (reason `safe_exit_risk`, notify suppressed) |
| `revoke_cancel` | `revoke_cancelled` (reason `cooling_off_cancelled`) |
| `requestAccess` / teen decision | `request_created` / `request_approved` / `request_denied` |
| `block_adult` / `unblock_adult` | `block_added` / `block_removed` |
| `redeem_link_code` | `link_code_redeemed` (+ `same_device`, `coerced_flag`) |
| `send_invite` / invite accept | `invite_sent` / `invite_accepted` |
| `set_scope` (teen toggles) | `scope_changed` (metadata: old/new) |
| `apply_court_order` / clear | `court_order_applied` / `court_order_cleared` |
| `go_independent` / `graduateAt18` | `go_independent` / `grant`+`scope_changed` as applicable |
| credential pause on revoke | `credentials_paused` |

**Defense-in-depth trigger:** a `AFTER INSERT OR UPDATE ON child_access` trigger calls `log_access_event()` for any row change not already logged in the current transaction (guarded by a tx-local flag set by the RPCs). This captures `service_role` writes and migrations.

`log_access_event(...)` is `SECURITY DEFINER`, computes `device_hash`/`ip_hash` from the request context passed by the RPC (RPCs receive them from the API layer; never trust client-supplied values — the API layer derives them from the TCP/TLS connection).

### 3.3 Teen-visible audit view

RPC `teen_access_timeline(p_child_id)` — callable only by the teen (`children.user_id = auth.uid()`). Returns chronological events:

```
{ at, event_key, who_name, what_happened_key, scopes_affected[], reason_key }
```

Keys (not sentences) — the UX designer owns the rendering; the contract guarantees stable keys and never leaks: raw IPs, device fingerprints, the other parent's contact details, or court-order document contents. Coerced-link flags and safe-exit events are visible **only** to the teen.

### 3.4 The revoked-parent rule

```sql
CREATE POLICY ae_select ON access_events FOR SELECT TO authenticated USING (
  -- teen sees all events on own record
  EXISTS (SELECT 1 FROM children c WHERE c.id = access_events.child_id AND c.user_id = auth.uid())
  OR
  -- a viewer with ACTIVE access sees events where they are the subject (their own grant/revoke)
  (subject_user_id = auth.uid() AND EXISTS (
     SELECT 1 FROM child_access ca WHERE ca.child_id = access_events.child_id
       AND ca.user_id = auth.uid() AND ca.status = 'active'))
);
-- No policy arm covers status='revoked' or blocked viewers: a revoked parent sees ZERO rows.
-- There is deliberately no "parent views child's full timeline" arm.
```

**Never shown to a revoked parent** is enforced by the absence of any policy path, not by application code. Audit reads for ops/support require `service_role` + a logged support ticket (support reads write their own `access_events` row with `actor_user_id` = support agent, reason `safety_concern` — the teen can see that support looked).

---

## 4. Data-provenance rule §1.2b (migration 023)

### 4.1 Provenance tagging

```sql
-- 023_data_provenance.sql
CREATE TYPE provenance AS ENUM ('school_of_record','app_generated','safety_critical');
-- Added to: grades, assignments, attendance_rows, gradebook_snapshots,
--           teacher_emails (official school comms), school_announcements,
--           check_ins, reflections, mood_entries, ai_chats, practice_quizzes,
--           uploaded_materials, health_rows (all W2/W8/W22/W23), location_rows
ALTER TABLE <each> ADD COLUMN provenance provenance NOT NULL DEFAULT 'app_generated';
-- Backfill: grades/attendance/teacher_emails/school announcements → 'school_of_record'
-- permission_slips, field_trip_notices, incident_reports, emergency_notifications,
-- break_glass_medical → 'safety_critical' (lives in safety_notices, see §4.3)
```

Tagging happens **at ingest**: sync workers set `provenance` when writing (StudentVUE/ParentVUE/CTLS parsers → `school_of_record`); app writes default `app_generated`; the safety classifier (keyword + sender allowlist: school office, nurse, principal) may promote a school email to `safety_critical` — promotion is append-only (never demote automatically; demotion requires human review).

### 4.2 Enforcement points

1. **Read path:** `provenance` selects the governance regime —
   - `school_of_record` → visibility scopes apply in-app (`performance`/`communications`), **plus** the school-transparency disclosure: Pookie never promises a custodial parent can't obtain these from the school (FERPA). The consent screen and Sharing screen carry the one-line disclosure (copy: UX designer).
   - `app_generated` → child-authority; scopes govern.
   - `safety_critical` → safety channel; scopes do not govern.
2. **AI/training boundary:** `school_of_record` rows are never used as AI training examples without explicit consent; vendor terms must carry no-training-on-inputs (panel Category 2).
3. **Retention:** provenance selects the retention schedule (school-year+1 for school emails; teen-deletable + rolling purge for check-ins — panel Category 7 🛑; raw financial images ≤30 days). The retention designer owns the schedule; provenance is the routing key.
4. **School-issued account firewall (G28):** rows ingested from school-monitored accounts (Cobb Office 365) carry `source_account_type='school_issued'`; the Sharing screen discloses "your school can monitor this account — Pookie can't promise privacy the school doesn't grant."

### 4.3 Separate safety channel — API shape

```sql
CREATE TABLE safety_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  notice_type text NOT NULL CHECK (notice_type IN
    ('permission_slip','field_trip','lab_notice','incident_report','emergency','break_glass_medical')),
  title text NOT NULL, body text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
  provenance provenance NOT NULL DEFAULT 'safety_critical',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,  -- staff/system
  acknowledged_by jsonb NOT NULL DEFAULT '[]'  -- [{user_id, at}]
);
```

- `send_safety_notice(p_child_id, p_type, p_title, p_body, p_payload)` — `SECURITY DEFINER`. **Bypasses `access_scopes` entirely.** Recipients = `safety_recipients(p_child_id)`: all adults with any historical link (active, revoked, blocked — block ≠ revoke of safety comms) **minus** court-order `no_contact` subjects (§9). Delivery: push notification + in-app Safety inbox + (for `emergency`) SMS if the adult opted into emergency SMS.
- Sharing screen: `safety_comms` renders as a **non-toggleable row** — "Safety notices (permission slips, emergencies) — always on, can't be turned off." `revoke_access` and `block_adult` never touch this table or its recipient function.
- RLS: `safety_notices` SELECT allowed to teen + anyone in `safety_recipients(child_id)`; INSERT only via RPC.

---

## 5. Link codes §1.2.2, hardened (019 base + 027 hardening)

### 5.1 Generation & storage

```sql
-- 019_link_codes.sql
CREATE TABLE link_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  code_hash text NOT NULL,                    -- bcrypt(crypt, gen_salt('bf',10)); NEVER plaintext
  created_by uuid NOT NULL,                   -- the generating parent
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  used_at timestamptz,
  used_by uuid,
  generator_device_hash text NOT NULL,
  invalidated bool NOT NULL DEFAULT false,    -- brute-force kill
  UNIQUE (child_id, code_hash)
);
-- 027_link_code_hardening.sql
CREATE TABLE link_code_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid REFERENCES link_codes(id),
  child_id uuid NOT NULL,
  ip_hash text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  success bool NOT NULL DEFAULT false
);
CREATE INDEX lca_ip_time ON link_code_attempts(ip_hash, attempted_at DESC);
```

Generation (in `generate_link_code` RPC, `SECURITY DEFINER`): `code = lpad((get_byte(gen_random_bytes(4)) % 900000 + 100000)::text, 6, '0')` — 6 digits from `pgcrypto` CSPRNG, uniform over 100000–999999. Hash with `crypt(code, gen_salt('bf', 10))`. The plaintext is returned **once** to the generating parent's session and never stored or logged.

### 5.2 Brute-force lockout

Enforced in `redeem_link_code(p_code)`:

```
1. candidate codes = unexpired, unused, not invalidated, for children the caller could plausibly claim
   -- compare via crypt(p_code, code_hash) = code_hash (constant-time in pgcrypto)
2. count failed attempts for this code in last 15 min → ≥5  → invalidated=true, event logged, raise 'code_locked'
3. count failed attempts from ip_hash in last hour     → ≥10 → raise 'ip_cooldown' (retry-after 1h)
4. count codes generated by created_by for child with no redemption in last 24h → ≥3
   → generation cooldown 30 min on generate_link_code
5. on success: used_at=now(), used_by=caller; same_device = (redeemer_device_hash = generator_device_hash)
```

Lockout events are written to `access_events` (`link_code_redeemed`, success=false in metadata).

### 5.3 Anti-coercion private confirmation

`redeem_link_code` is a **two-phase** flow:

- **Phase 1** (`redeem_link_code`): verifies the code, marks it used, creates the `child_access` row with **all scopes default-false** (tentative), returns `{ next: 'anti_coercion_prompt', linking_parent_name }`. The parent's UI shows "waiting for teen to confirm" — no access yet.
- **Phase 2** (`confirm_link_choice(p_link_id, p_choice)`), in the teen's private session:
  - `"i_chose_this"` → scopes set to standard defaults (§2.4), status active, event `link_code_redeemed`.
  - `"i_was_told_to"` → the link **still completes** (never tip off a coercer in the room), BUT: `coerced_flag=true` on the event; scopes stay **all-off** (teen re-enables privately in Sharing); a private 24h follow-up nudge is scheduled to the teen ("Still okay? You can change sharing anytime"); trusted-adult prompt is queued. **The parent is never notified of the flag** — their UI shows a normal active link.

The prompt appears **only** on the teen's own device/session, after code verification, before any data flows. Copy owned by UX designer; the contract: two explicit options, no default, ≤8th-grade reading level, private (no parent-visible state change between phases).

### 5.4 Age gate (COPPA technical guarantee)

`redeem_link_code` requires the caller's `profiles.dob_verified = true` and `effective_age_tier != 'under13'` — under-13s cannot redeem, cannot hold sessions, cannot be issued link codes (server-side ban, not policy — panel §1.1.4).

---

## 6. Claim dedupe §1.2.3 (migration 024)

### 6.1 Trigger discipline (enumeration defense)

`check_claim_candidates()` fires **only** inside the post-email-verification session (the teen proved control of the email), is rate-limited (3 calls/day per user), and **never** exists as a standalone lookup — there is no endpoint that takes a name/DOB and returns matches. This is the enumeration-risk fix the panel requires.

### 6.2 Matching algorithm

Candidate pool: parent-managed `children` rows with `user_id IS NULL` (unclaimed) created in the last 5 years.

```
normalize(name): lowercase, strip punctuation/extra spaces, nickname-map
  (e.g. Dawson→dawson; map table nicknames: will/bill, etc. — conservative list)
score = 0.6 * trigram_similarity(normalize(input_name), normalize(candidate_name))
      + 0.4 * (input_birthdate = candidate_birthdate ? 1 : 0)
  -- pg_trgm similarity; birthdate is exact-match only (no fuzzy DOB — typos go to manual review)

score ≥ 0.85  → strong candidate → "Is this you?" card
0.60–0.85     → near-miss → manual-review queue (teen sees: "We're double-checking — back within 48 hours")
< 0.60        → no candidate → create fresh child profile
```

### 6.3 "Is this you?" data contract

The API returns **minimal PI only**:

```
{ candidate_id, first_name, last_initial, birth_month_year,  -- "March 2011", never full DOB
  created_by_relationship,   -- "added by a parent" (never the parent's name/email)
  has_school_data: bool }    -- existence only, no grades
```

Teen confirms → `confirm_claim(candidate_id)` links `children.user_id = caller`, merges per §6.5, logs `duplicate_cleanup`. Teen declines → profile stays parent-managed; no further prompts for 90 days (panel §1.2.1).

### 6.4 Manual-review queue

```sql
-- 024_claim_dedupe.sql
CREATE TABLE claim_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claimant_user_id uuid NOT NULL, candidate_child_id uuid NOT NULL,
  score numeric NOT NULL, input_name_hash text NOT NULL,  -- hashed; reviewers see candidate side only
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewer uuid, reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
-- SLA: 48h. Reviewer: Mehedi/admin (ops). Reviewer sees candidate profile + score components,
-- never the claimant's raw input beyond the hash-matched fields needed to decide.
```

### 6.5 Merge rules per data class

| Data class | On teen confirm |
|---|---|
| School-of-record (grades, attendance, assignments) | Auto-merge into the linked profile |
| App-generated non-health (check-ins, materials, practice) | Auto-merge; teen can delete any of it after |
| **Health rows (any tier)** | **NEVER auto-merge** (panel §1.2.3). Rows stay attached to the old profile stub, flagged `needs_teen_review`; the teen approves per-record or discards. H2/H3 rows require explicit per-record consent even to view in the merged timeline. |
| Access grants on the old stub | Re-pointed to the merged child with `granted_by` preserved; event `duplicate_cleanup` |

---

## 7. Access requests §1.3.4 (020 amended)

### 7.1 Schema

```sql
-- 020_access_requests.sql (amended)
CREATE TABLE access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  requester_id uuid NOT NULL,
  relationship_claim text, message text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','awaiting_parent_coapproval','approved','denied','blocked','expired')),
  co_approver_id uuid,                        -- parent who co-approved (under-16 non-parent grants)
  reviewed_by text CHECK (reviewed_by IN ('child','parent')),
  reviewed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  UNIQUE (child_id, requester_id) WHERE status IN ('pending','awaiting_parent_coapproval')
);
```

### 7.2 Flow

```
requestAccess(child_id, relationship_claim, message):
  1. checks: not self, not already active/blocked, re-request lockout (§7.4), household block (§8)
  2. INSERT pending; notify teen (teen's channel only)
  3. Fact-only notification to the OTHER parent(s) — exact content contract (§7.3)
  4. log_access_event('request_created')

Teen decision (teen_decide_request(request_id, decision)):
  - 'deny'   → status='denied', event; requester notified (neutral)
  - 'block'  → status='blocked' + block_adult() (§8)
  - 'approve':
      IF teen tier = t13_15 AND requester is non-parent adult
        → status='awaiting_parent_coapproval'; task routed to a parent with active access
        → parent_coapprove(request_id, approve bool):
            approve → create child_access(granted_by='child', co_approver_id=parent)
                      -- ⚠️ the grant is CHILD-authority; the parent cannot later revoke it (§1.5 rule D)
            deny    → status='denied' (parent co-denial is a gate, logged; teen may re-raise at 16)
      ELSE → create grant immediately
```

### 7.3 Fact-only notification to the other parent — exact content contract

The notification is system-generated, immutable template, no free text from the requester or teen:

> **Sharing update — {child_first_name}**
> {requester_first_name} {requester_last_initial}. requested access to {child_first_name}'s Pookie records ({date}).
> {teen_first_name} is reviewing the request. No action is needed from you.
> You can't approve or undo {teen_first_name}'s decision.

Delivered to every adult with active access on the child **except** the requester. Never includes the requester's message, relationship claim details, or framing. Logged in `access_events` metadata (template version).

### 7.4 30-day re-request lockout — enforcement

- `revoke_access` sets `child_access.re_request_locked_until = now() + 30d` (row retained in `revoked` status as the lock record).
- `requestAccess` / `send_invite` / `generate_link_code` all check: any `revoked` row for (child, adult) with `re_request_locked_until > now()` → raise `re_request_locked` with the unlock date. The teen can waive the lock early from the Sharing screen (teen-only `waive_re_request_lock()` — the lock protects the teen, so only the teen lifts it).
- After a `denied` request: the same 30-day clock applies from `reviewed_at`.

### 7.5 ⚠️ CONFLICT C3 — co-approval vs "no parent veto"

Panel §1.3.4 requires under-16 non-parent grants to need parent co-approval; the locked model says no parent can veto/revoke a child-made grant. **Resolution:** co-approval gates *creation* only (a safety check for young teens, per the psychologist). Once created, the row is `granted_by='child'` — child-authority, parent-untouchable for its lifetime (a parent can't revoke it later, §1.5 rule D). A parent's co-denial is logged and the teen may re-raise the request at 16. This keeps the teen as the durable authority while honoring the panel's young-teen safeguard.

---

## 8. Block list §1.3.5 (migration 025)

### 8.1 Schema

```sql
-- 025_block_list.sql
CREATE TABLE blocked_adults (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  blocked_user_id uuid NOT NULL,
  blocked_at timestamptz NOT NULL DEFAULT now(),
  reason_code text REFERENCES access_reason_codes(code),
  expires_at timestamptz,                     -- NULL = indefinite (default)
  UNIQUE (child_id, blocked_user_id) WHERE expires_at IS NULL OR expires_at > now()
);
CREATE TABLE household_members (
  household_id uuid NOT NULL,
  user_id uuid NOT NULL,
  verified_at timestamptz, verified_how text,  -- 'self_declared' | 'shared_child' | 'address_match'
  PRIMARY KEY (household_id, user_id)
);
CREATE TABLE household_invite_freeze (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  household_id uuid NOT NULL,
  frozen_until timestamptz NOT NULL,
  UNIQUE (child_id, household_id)
);
```

### 8.2 How "household" is determined

Precedence order (first hit wins):

1. **Explicit** `household_members` rows: adults sharing a verified address (address verification flow, owned by onboarding designer) or who both confirmed "same household" in Family settings.
2. **Inferred:** adults who both hold/have-held `child_access` on the **same child** with `role='parent'` (co-parents) are treated as one household for the freeze, unless either has marked "separate households" in settings (parallel-parenting mode, panel W14).
3. A blocked adult with no household links → household of one.

### 8.3 Enforcement

`block_adult(p_child_id, p_adult)` (teen-only RPC):
```
1. INSERT blocked_adults (indefinite); revoke any active child_access row (reason 'teen_choice')
2. INSERT household_invite_freeze(child, household_of(adult), now()+30d)
3. Safety channel UNTOUCHED — block ≠ revoke of safety comms (§4.3). The Sharing-screen
   confirm states this plainly (disclosure copy: UX designer): "Safety notices (permission
   slips, emergencies) will still reach them."
4. log_access_event('block_added')
```

`generate_link_code`, `send_invite`, `requestAccess` each check `household_invite_freeze`: if the actor's household is frozen for this child → raise `household_frozen` with the unfreeze date. The teen lifts it early via `unblock_adult()` (clears both the block and the freeze; logged).

**Court-order override path:** a blocked adult may upload a court order → `court_order_reviews` queue (§9). A *verified* order with access terms supersedes the block: `apply_court_order` clears/overrides the block per the order's terms (logged, teen told plainly why — §9.4). Unverified uploads change nothing.

### 8.4 ⚠️ CONFLICT C4 — teen expectation vs safety carve-out

A teen who blocks an adult will expect "gone." The panel requires safety comms to survive block and revoke. **Resolution:** the block-confirm screen must disclose the carve-out *before* confirm (one line, UX copy), and the teen's audit timeline (§3.3) shows a standing "Safety notices still reach {name} — required by law" entry while the block is active. Never silently deliver.

---

## 9. G9 — Custody / court orders (migration 026)

### 9.1 Schema

```sql
-- 026_court_orders.sql
ALTER TABLE children ADD COLUMN court_order_restriction bool NOT NULL DEFAULT false;
CREATE TABLE court_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES children(id),
  uploaded_by uuid NOT NULL,
  document_path text NOT NULL,                 -- private storage bucket; never a public URL
  order_type text NOT NULL CHECK (order_type IN
    ('custody_access','no_contact','supervised_only','travel_restriction')),
  summary_text text,                           -- staff-written plain-language summary
  restrictions jsonb NOT NULL DEFAULT '{}',    -- {deny_user_ids:[], allow_scopes:[], supervision_required:bool,
                                               --  travel_requires_both_parents:bool, notes:''}
  status text NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review','verified','rejected','expired')),
  verified_by uuid, verified_at timestamptz,
  effective_from date, effective_until date,
  auto_enforce bool NOT NULL DEFAULT false,    -- ⚠️ R4: stays false until counsel sign-off
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### 9.2 Upload / review flow

```
Sharing → "Legal documents" → upload (adult or teen) → status 'pending_review'
  → reviewer: Mehedi/admin (ops role) — SLA 5 business days, teen sees "under review"
  → verification = document authenticity + attorney consult (panel §5 sign-off #8 gate)
  → verified: children.court_order_restriction=true; restrictions jsonb active;
              log_access_event('court_order_applied')
  → rejected: teen/adult notified with reason; document retained per litigation-hold policy
```

Who reviews: Mehedi (admin) as the human reviewer; legal verification routed to counsel before `auto_enforce` flips. Until counsel signs off (R4), verified orders are **ingested and flagged** but enforcement stays manual (admin applies/removes access per the order, each action logged).

### 9.3 Matrix consultation

`get_court_restrictions(p_child_id)` is called **first** inside `grant_access` and `revoke_access`, before the §1.4 authority matrix:

```
restrictions = get_court_restrictions(child)   -- only verified & effective & auto_enforce rows
IF restrictions.deny_user_ids CONTAINS p_adult_user_id:
    IF caller is teen AND order_type='no_contact' AND teen was the protected party... 
        → still DENY (court order supersedes; teen told plainly why — §9.4)
    -- the teen cannot grant to a no-contact adult, even though "child is authority":
    -- courts can order access (panel R4); facilitating violation creates liability.
IF order_type='supervised_only': grant allowed but scopes intersected with restrictions.allow_scopes
IF order_type='travel_restriction': bookings consult restrictions (see §12.5)
```

Revocation under a court order: `suspended_court` status rows can only be restored via `apply_court_order`/admin — `revoke_access` rule F denies self-serve changes.

### 9.4 Teen-facing explanation — copy contract

When a court order denies/allows an action, the API returns a structured denial (never a silent failure, never the document):

```
{ allowed:false, reason_code:'court_order',
  teen_explanation_key:'court_order_limits_sharing',
  detail:'A court order on file limits sharing for your record. This isn't your choice or ours — the order decides. Ask {trusted_adult_or_support} if you want to understand it.' }
```

Contract: the teen is always told **plainly why** (an order exists, what it limits, that it's not the teen's fault, who to ask). No order text, no docket numbers, no other party's filings are exposed to the teen. Copy: UX designer; keys stable.

---

## 10. G11/G12 — Emancipated minors + DOB gate (017 amended)

### 10.1 `legal_status` enum

```sql
-- folded into 017_profiles.sql (amended) + children table
CREATE TYPE legal_status AS ENUM ('minor','emancipated','adult');
ALTER TABLE profiles ADD COLUMN legal_status legal_status NOT NULL DEFAULT 'adult';
ALTER TABLE profiles ADD COLUMN dob date;
ALTER TABLE profiles ADD COLUMN dob_verified bool NOT NULL DEFAULT false;
ALTER TABLE children ADD COLUMN legal_status legal_status NOT NULL DEFAULT 'minor';
ALTER TABLE children ADD COLUMN legal_status_verified bool NOT NULL DEFAULT false;
ALTER TABLE children ADD COLUMN legal_status_doc_path text;  -- emancipation decree, private bucket
```

- `emancipated` requires document upload + admin verification (`legal_status_verified=true`); self-claim is insufficient (GA O.C.G.A. §§ 15-11-720–727 — panel §5 legal-review item).
- `profiles.legal_status='adult'` for ordinary adult users; the teen's own profile row gets `'minor'` until 18.

### 10.2 Which checks consult it

`effective_age_tier(p_child_id)`:

```
IF children.legal_status='emancipated' AND legal_status_verified → RETURN 'adult'
ELSIF age(birthdate) < 13 → 'under13'
ELSIF < 16 → 't13_15'  ... etc.
```

Consulted by: `revoke_access` (cooling-off vs instant), `grant_access` (co-approval gate), `go_independent`, `redeem_link_code` (under-13 ban), travel RPCs (§12), W31 gating. Emancipated → adult track at any age: instant revoke, no co-approval, no cooling-off, full transactional authority where otherwise age-gated — **except** the under-13 technical ban still applies if birthdate < 13 (COPPA is federal and status-agnostic; an "emancipated" under-13 is a legal impossibility the system rejects at upload review).

### 10.3 DOB gate for direct teen self-signup

Flow position: **step 0 of teen linking** — before code entry, before invite accept:

```
Teen self-signup → "How old are you?" (DOB picker; ≤8th-grade copy)
  → birthdate < 13 : hard stop. "Pookie accounts start at 13. A parent can make a
                     parent-managed profile for you." No account created, no session, no
                     link-code issued (technical COPPA guarantee — panel §1.1.4).
  → 13–17          : teen account created with teen guardrails; profiles.dob_verified=true
                     (verified again at link-code redeem / email verify — the two must match)
  → no DOB given   : account may exist as 'just me' adult-mode, but child-linking RPCs
                     refuse until DOB is provided and verified (profiles.dob_verified).
```

Enforcement: `redeem_link_code`, `confirm_claim`, and invite-accept all `REQUIRE profiles.dob_verified`. Mismatch between signup DOB and verification-time DOB → lock to manual review (identity-fraud signal), logged.

---

## 11. G26 — Sibling / household leakage

### 11.1 Invariant list (build these into RLS + RPCs, then test)

- **I1 — child_id scoping:** every child-data read includes `child_id = :authorized_child`. No query, view, or RPC returns rows for a child the viewer lacks `active`/`pending_cooling` access to.
- **I2 — revoke completeness:** revoking Parent A on child 1 removes child 1 from A's digests, briefings, search, household views, notifications, and API tokens. A's per-child token for child 1 is revoked at `revoke_effective`; tokens are child-scoped at issuance (`api_tokens.child_id`, `api_tokens.scopes_snapshot`).
- **I3 — safety-only cross-boundary flow:** the ONLY data that crosses a revoke/block boundary is `safety_critical` via `send_safety_notice`. No aggregates, no "your other child" hints.
- **I4 — no mixed-child payloads:** server never returns two children's rows in one response unless the viewer has access to both; the client purges on child-switch (spec'd).
- **I5 — filter-before-aggregate:** household digests compute per-child, filter by `resolve_visible_scopes()`, then aggregate. Never aggregate-then-filter (leaks via totals/deltas).

### 11.2 Query patterns that must always include child_id scoping

```sql
-- Canonical read pattern (all child-data RPCs):
... WHERE d.child_id = p_child_id
      AND p_scope = ANY (resolve_visible_scopes(p_viewer, p_child_id))
      AND (acc.status != 'pending_cooling' OR d.created_at <= acc.frozen_view_at)
-- Search: child_id is a REQUIRED parameter; no global search endpoint exists.
-- Digests:   FOR EACH child IN accessible_children(viewer): build separately, then concatenate.
-- API:       route path carries :childId; middleware resolves scopes BEFORE any join.
```

`accessible_children(p_viewer)` = children where viewer is the teen OR has active/pending_cooling access. Used by nav, digests, and the child switcher.

### 11.3 QA test-plan outline

1. **Matrix test:** 2 children × 2 parents (A has child 1 only, B has both). Revoke A's child-1 access mid-test. Assert: A's digest/briefing/search/API contain zero child-1 rows; B unaffected; teen's view unchanged.
2. **Digest audit:** after revoke, diff A's digest payload before/after — must be byte-absent of child-1 identifiers (names, IDs, assignment titles), not merely hidden client-side.
3. **Token test:** A's child-1 API token returns 403 post-revoke; child-2 token (if any) unaffected.
4. **Sibling non-enumeration:** parent with access to child 1 only calls child switcher/list — child 2's name/ID/photo must not appear (not even as "another child").
5. **Cooling-off frozen view:** during `pending_cooling`, new grades sync but A's view shows only rows ≤ `frozen_view_at`; at effect, zero rows.
6. **Safety-only:** after block, the ONLY child-1 payload A can receive is via `safety_notices`.
7. **Search isolation:** search "geometry" as A returns child-1 results before revoke, none after; never child-2-without-access results.
8. **Co-parent inference:** block adult X; assert X's co-parent Y (same child) is invite-frozen for 30 days; unrelated adult Z is not.

---

## 12. Travel purchasing invariants — W30/W31, G13 (migration 028)

### 12.1 Principle: visibility ≠ transactional authority (new §3.5 carve-out)

> **Seeing an itinerary (visibility, via scopes) never confers the ability to book, modify, or cancel it (transactional authority).** Transactional authority requires ALL of: (a) purchaser age 18+ (verified DOB), (b) explicit authority — the purchaser holds active access on the child OR the teen's explicit per-trip approval, (c) step-up auth on the booking action (fresh re-authentication), (d) no conflicting `travel_restriction` court order (§9/§12.5).

### 12.2 Purchaser-of-record 18+ — server-side invariant

```sql
-- 028_travel_authority.sql
CREATE OR REPLACE FUNCTION create_booking(p_payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE purchaser uuid := auth.uid(); tier text;
BEGIN
  -- Invariant: purchaser must be 18+. Checked HERE, not in the client.
  IF NOT (SELECT dob_verified FROM profiles WHERE user_id=purchaser)
     OR (SELECT effective_age_tier_for_user(purchaser)) != 'adult' THEN
    PERFORM log_access_event(... 'booking_denied_minor_purchaser' ...);
    RAISE EXCEPTION 'purchaser_must_be_18' USING ERRCODE='P0001';
  END IF;
  PERFORM validate_minor_traveler(p_payload);          -- §12.3
  PERFORM check_travel_court_order(p_payload);         -- §12.5
  PERFORM require_step_up_auth(purchaser, 'travel_booking');  -- fresh re-auth token
  ... insert booking (status 'pending_payment' until payment clears) ...
END $$;
```

The same check lives in the API route middleware (`/api/v1/travel/book`) — defense in depth, but the RPC is the authority. Every denial is logged (audit + parent alert per §12.4).

### 12.3 Minor-traveler rules engine

```sql
CREATE TABLE travel_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type text NOT NULL CHECK (rule_type IN ('um_band','um_fee','passport','tsa','airline_policy','age_gate')),
  carrier text,                       -- NULL = applies to all carriers
  min_age int, max_age int,
  fee_cents int,
  requirement text NOT NULL,          -- machine-readable: 'phone_booking_only' | 'unaccompanied_minor_service' | 'passport_required' ...
  notes text, source_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Seed: per-airline UM bands (e.g. 5–14 mandatory UM service + fee; 15–17 optional),
-- phone-booking routing for UM, passport/TSA checks for international.
```

`validate_minor_traveler(p_payload)` runs at booking time: looks up the traveler's age tier, joins `travel_rules`, and either (a) passes, (b) attaches requirements (UM fee added to ranked total, phone-booking routing surfaced — never auto-booked around), or (c) blocks with a reason code. Rules table is versioned (`updated_at`, `source_url`) — the travel agent's seed data, reviewed quarterly.

### 12.4 Itinerary sharing + teen travel-purchase alerts

- `itinerary` is a dedicated scope in `access_scopes` (default **false** at link; teen opts in per trip or per person). Booking confirmations write itinerary rows tagged to the child.
- **Teen travel-purchase alerts:** any booking naming a minor traveler notifies all adults with active access (fact-only, DOT-documented risk): "A flight was booked for {child_first_name} on {date} ({origin} → {destination}). Booked by {purchaser_first_name}." Logged. This fires regardless of the `itinerary` scope (it's a purchase alert, not itinerary sharing).

### 12.5 W31 hidden from teen accounts — menu/API gating

- **Menu gating is server-driven:** `GET /api/v1/nav` returns `visible_modules[]` computed from `effective_age_tier` (+ `legal_status`). `rental_cars` is excluded for tiers `under13/t13_15/t16_17`; for 18–20 it appears in **planning mode only** (quotes with under-25 surcharges in ranked totals, no booking CTA).
- **API gating:** `rental_car_quote()` / `rental_car_book()` RPCs check tier first: teen tiers → raise `not_available_for_teens` (no footnote, no disabled button that explains too much — the module simply isn't in their nav). Hard-gate encodes company-minimum-age × state × full-license: `rental_car_book` additionally requires `profiles.drivers_license_verified` and `license_class` compatible with the state.
- Under-21 surcharges are part of the ranked-total computation, not a footnote.

### 12.6 Custody travel-restriction profile

Ties to G9: `court_orders` with `order_type='travel_restriction'` carry `restrictions.travel_requires_both_parents` / `deny_user_ids` / `allowed_destination_scope`. `check_travel_court_order()` runs inside `create_booking` before payment: violation → block with `reason_code='court_order'` + teen/admin explanation per §9.4. The W14 co-parenting module surfaces the restriction profile (read-only) to both parents.

---

## Appendix A — Cross-domain conflicts & resolutions

| # | Conflict | Resolution adopted | Needs |
|---|---|---|---|
| C1 | Locked spec §4/§6: 13–15 cooling-off notifies **both** parents immediately vs panel §1.4.1 🛑 (endangers abuse-exit) | Panel fix: notify-now vs notify-at-effect (default at effect, only revoked parent), safe-exit path, frozen view | Mehedi amendment to locked spec §4/§6 |
| C2 | Locked spec §4: 18+ continuity-by-default vs panel §1.6.2 🛑 (health needs affirmative opt-in) | Split: performance/communications continue; wellness/location/itinerary reset to private pending opt-in | Mehedi amendment to locked spec §4 |
| C3 | Panel §1.3.4: under-16 non-parent grants need parent co-approval vs "no parent veto of child grant" | Co-approval gates creation only; resulting row is `granted_by='child'`, parent-untouchable thereafter | Spec §3 matrix footnote |
| C4 | Teen expects block = "gone" vs panel: block ≠ revoke of safety comms | Pre-confirm disclosure + standing audit-timeline entry | UX copy (one line) |
| C5 | Panel R4: build court-order ingestion now, don't auto-enforce until counsel signs off | `auto_enforce=false` default; manual admin application until sign-off | Attorney sign-off (panel §5 #8) |
| C6 | "Muse direct/unfiltered" branding vs scope-filtered nudges | Nudge/briefing filtering follows scopes regardless of AI mode; unfiltered branding stays 18+-gated per panel | — |
| C7 | Health tiers H0–H3 referenced but undefined (G3) | Access layer defines the enforcement contract (§2.1); taxonomy owned by health designer; W2/W8/W23 gated on it | Health designer: H0–H3 taxonomy |
| C8 | Consent screen must unbundle per-domain + enumerate health subcategories (§1.2.1) | Scope model (§2) is the data contract the consent screen renders; school-transparency line included | UX designer: screen copy |

## Appendix B — State machines (summary)

```
child_access.status:  active ⇄ pending_cooling → revoked → (re-grant creates new active row)
                      active → revoked (instant, 16+/adult/safe-exit/self-revoke)
                      * → suspended_court (admin/court-order only; self-serve cannot enter or leave)

access_requests.status: pending → awaiting_parent_coapproval → approved
                        pending → denied | blocked | expired

link_codes: active → used | expired | invalidated(brute-force)

court_orders.status: pending_review → verified | rejected ; verified → expired
```

## Appendix C — RPC inventory (new/changed)

`grant_access · revoke_access · revoke_cancel · apply_cooling_off_revocations(cron) · resolve_visible_scopes · has_scope · accessible_children · set_scope(teen) · log_access_event · teen_access_timeline · generate_link_code · redeem_link_code · confirm_link_choice · check_claim_candidates · confirm_claim · requestAccess · teen_decide_request · parent_coapprove · waive_re_request_lock · block_adult · unblock_adult · send_safety_notice · safety_recipients · apply_court_order · effective_age_tier · go_independent · graduateAt18 · create_booking · validate_minor_traveler · rental_car_quote · rental_car_book · get_nav (server-driven modules)`
