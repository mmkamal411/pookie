# Health Track — RPC Inventory (implementation spec)

**Squad 2 — Health Track** | Implements sol-health.md Appendix B + §§2.7, 3, 5.3, 6.7, 8.4
Enforceable definitions live in the health migrations (022–028, pending MD renumbering);
this document is the complete interface contract for clients, reviewers, and tests.

Legal gate: counsel sign-off on H0–H3 required before production data flows (NFR-LEGAL);
schema itself is complete and tested.

Conventions: all RPCs are `SECURITY DEFINER`, `search_path=public` pinned,
`REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated` unless noted.
Raw Postgres exceptions are mapped to canonical API codes by
`mapDbError()` in `src/server/errors.ts` (never surfaced raw).

---

## 1. Re-consent (§2.7)

### `rpc_health_reconsent_submit(p_grants jsonb)` → jsonb
- **Input:** `[{"grantee_user_id": "<uuid>", "tier": "H1"|"H2"}]` — one object per
  per-tier toggle on the `/health/review-18` screen. `tier` ∈ {H1,H2} only;
  H3/H0 → `health_reconsent_tier_refused` (structural: no grant arm for H3).
- **Auth:** caller must be the adult subject (child-role on the child);
  `health_reconsent_status` ∈ {pending, skipped_private, complete}.
  Grantee must be a parent-role adult linked to the same child
  (parallel-parenting safe; `health_reconsent_grantee_not_linked` otherwise).
- **Effect:** inserts one `health_consent_grants` row per toggle
  (`granted_at ≥ 18th birthday`, `expires_at = NULL`, revocable anytime);
  sets `health_reconsent_status='complete'`; writes `access_events`
  (`health_reconsent_complete`).
- **Returns:** `{"status":"complete","grants_written":n}`.

### `rpc_health_reconsent_skip()` → jsonb
- **Auth:** same subject-only check; status must be `pending`.
- **Effect:** sets `health_reconsent_status='skipped_private'` — recorded as an
  affirmative choice so the prompt stops appearing. No grants written.
  Skip = private (identical privacy outcome to submitting zero toggles).
- **Returns:** `{"status":"skipped_private"}`.

### `rpc_health_review_queue()` → jsonb
- **Auth:** subject only (child-role).
- **Effect (read-only):** returns parent-entered rows awaiting
  review–correct–seal: `{metrics: [...], food_logs: [...]}` where
  `entered_by ≠ auth.uid()`, `sealed_at IS NULL`, `deleted_at IS NULL`,
  grouped for the §2.4 UI (Vitals, Weight, Medications, Notes…).
- **Returns:** `{"metrics":[...],"food_logs":[...]}`.

### `rpc_health_record_correct(p_table text, p_record_id uuid, p_patch jsonb)` → jsonb
- **Auth:** subject only. Tables whitelisted:
  `health_metrics, food_logs, allergy_list, health_medications`.
  Patch keys whitelisted:
  `value_numeric, value_text, note, description, allergen, severity, provider,
  dose_number, administered_at, lot_number, name, dose, schedule, started_at`
  (no tier/permission columns are patchable — `health_correct_field_refused`).
- **Effect:** for each key, appends a `health_corrections` row
  (child, table, record, field, old, new, corrected_by, at), then UPDATEs the
  row and seals it (`sealed_at=now(), sealed_by=caller`).
- **Returns:** `{"corrected":true,"record_id":"<uuid>"}`.

### `rpc_health_record_delete(p_table text, p_record_id uuid)` → jsonb
- **Auth:** subject only. Tables whitelisted:
  `health_metrics, food_logs, allergy_list, health_medications, wellbeing_entries`.
- **Effect:** tombstones now (`deleted_at=now()`); reads exclude it instantly.
  Hard delete follows via `purge_tombstoned_health()` (≤30d; H3 next run).
  Audit: anonymized `access_events` stub (`health_deletion_requested` + table
  only — no record IDs that resolve to content).
- **Returns:** `{"tombstoned":true}`.

### `rpc_export_transition_summary(p_format text, p_include_h3_record_ids uuid[])` → jsonb
- **Input:** `p_format` ∈ {json, pdf}; `p_include_h3_record_ids` default `{}`.
- **Auth:** subject only (`health_export_subject_only`).
- **Effect:** assembles from real tables — medications (name/dose/schedule),
  allergies, immunizations (incl. 3231), vitals trends (trailing 12 months,
  min/max/avg/n per metric with provenance labels + "not a medical device"
  disclaimer), emergency contacts (when W19's table exists; decoupled from
  grants), insurance card (masked per W7). H3 excluded by default; only the
  explicitly opted record IDs are included (each verified teen-owned H3).
  SUD records are never includable — separate disclosure instrument (028).
  The PDF/document is streamed and never persisted. Every export is
  audit-logged (`transition_summary_export` + format + h3 count).
- **Returns:** the summary JSON (the `pdf` format is rendered to the
  print-ready clinical summary by the API route from this same payload).

---

## 2. Grace / hide-past / deletion (§3)

### `rpc_hide_past_health()` → jsonb
- **Auth:** subject, 13+ (child-role; `hide_past_subject_only`).
- **Effect:** immediately deletes ALL `health_grace` rows for the subject's
  child (all viewers, all tiers). The predicate arm closes on next read —
  instant. Logged as `hide_past_health`. The revoked viewer sees the neutral
  "Health sharing ended" — never a per-record tombstone.
- **Returns:** `{"hidden":true,"grace_rows_removed":n}`.

### `rpc_request_health_deletion(p_scope jsonb)` → jsonb
- **Input:** `{"scope": "tier:H1"|"tier:H2"|"tier:H3"|"category:wellbeing"|"record:<table>:<id>"|"all_health"}`.
- **Auth:** subject only.
- **Effect:** immediate tombstone (`deleted_at=now()`; H3 content nulled at
  tombstone). Hard DELETE ≤30 days by `purge_tombstoned_health()`; storage
  objects (nutrition photos, 3231 PDFs) deleted in the same run; backups
  purged ≤30 days after source deletion (G6 runbook). Audit: anonymized stub
  (`health_deletion` + scope — no content, no resolving IDs).
- **Returns:** `{"tombstoned":true,"scope":"<scope>"}`.

### `nightly_health_birthday_cutover()` → jsonb (service_role, pg_cron `0 0 * * *`)
- Finds children whose 18th birthday was today (or newly emancipated),
  then per child: expire all non-subject grants; create `health_grace` rows
  (H1/H2 only — H3 never graced); write `access_events`
  (`health_cutover_18`, no health content); suspend parent-connected device
  tokens (`suspended_pending_reauth` — never resume); set
  `health_reconsent_status='pending'`. Runs at midnight whether or not the
  user logs in — privacy cannot wait for a login.
- **Returns:** `{"cutover_count":n,"ran_at":"<ts>"}`.

### `sweep_health_grace()` → jsonb (service_role, pg_cron `15 0 * * *`)
- Hygiene only: deletes expired grace rows and audits per-child expiry
  (`health_grace_expired`, teen-visible, never shown to the revoked viewer).
  The predicate enforces expiry — a missed run fails closed.

### `purge_tombstoned_health()` → jsonb (service_role, pg_cron `30 1 * * *`)
- Hard-deletes tombstoned rows ≤30 days; H3 fast path (next nightly run);
  deletes orphaned storage objects from `nutrition-photos`/`health-documents`.
- **Returns:** `{"purged":{...counts},"ran_at":"<ts>"}`.

### `purge_expired_health()` → jsonb (service_role, pg_cron `45 1 * * *`)
- Rolling retention per tier defaults + per-child overrides in
  `health_retention_policies` (H1 24mo, H2 24mo teen-configurable, H3 12mo).
  Tombstones expired rows; nulls H3 content at tombstone. No indefinite
  retention anywhere (G6).

---

## 3. Wellbeing events (§5.3)

### `emit_wellbeing_event(p_child_id uuid, p_event_type text, p_severity text)` → uuid
- **The single emission point.** Validates type ∈
  {mood_critical, pattern_flag, self_harm_disclosure, ed_signal,
  health_anomaly_flag} and severity ∈ {low, medium, high}.
- **Effect:** inserts into `wellbeing_events` (metadata only) and
  `pg_notify('wellbeing_event', …)` to the safety pipeline with
  event_id + child_id + type + severity + timestamp — never content, scores,
  journal text, or metric values. Safety events never widen data access (C4).
- **Grants:** authenticated + service_role.

### `detect_wellbeing_pattern(p_child_id uuid)` → jsonb (service_role)
- Server-side pattern detection returning the FLAG only: 3+ consecutive
  lowest-band days, or 7-day deteriorating trend (first-3-day vs last-3-day
  avg drop ≥ 2). Emits `pattern_flag` (medium) via `emit_wellbeing_event`.
  **Returns:** `{"pattern_flag": bool, "checked_at": "<ts>"}` — no scores.

### `detect_nutrition_ed_signals()` → jsonb (service_role, pg_cron `45 2 * * *`)
- ≥3 skipped meals in 7 days with low-energy notes (keyword assist on
  `energy_note`) → `ed_signal` (medium) per child. Metadata only; never a
  parent notification, never a diagnostic claim.

### `purge_expired_wellbeing()` → jsonb (service_role, pg_cron `0 2 * * *`)
- `journal_text`: 12-month rolling default (per-entry `auto_purge_after_days`
  30/90/365 wins when set); mood scores/tags: 24 months, then tombstone.

---

## 4. Nutrition (§6.7)

### `nutrition_weekly_patterns(p_subject_id uuid)` → jsonb
- **Auth:** parent-role or child-role on the subject's child.
- **Minor subjects:** engagement ONLY —
  `{week_start, days_logged, entries, meals_by_type,
  avg_calories_low: null, avg_calories_high: null, avg_protein_g: null,
  avg_carbs_g: null, avg_fat_g: null, detail: "engagement_only_minor"}`.
  Calorie/macro/weight aggregates are refused server-side (sol-health C3 —
  the 011 `nutrition_weekly_patterns()` calorie-average handoff is amended).
- **18+ subjects:** full output from the diary (re-consent enforced on read).
- **Grants:** authenticated + service_role.

---

## 5. Immunizations (§9)

### `check_immunization_reminders()` → jsonb (service_role, pg_cron `0 7 * * *`)
- For each on-file Form 3231 expiring within 90/30/7 days (deduped per window
  in `immunization_reminder_log`): `pg_notify('health_reminder', …)` to the
  parent (<18) or the adult (18+). Copy is logistics-only, never medical advice.
- **Returns:** `{"reminders_queued":n,"ran_at":"<ts>"}`.

### `check_hpv_catchup_reminders()` → jsonb (service_role, pg_cron `0 8 * * 1`)
- Subjects 11–17 with incomplete HPV series (CVX 62/118/165, <2 doses), not
  reminded this calendar year (`hpv_reminder_log`): one annual,
  clinician-deferring reminder. Never a recommendation, never nagging.
- **Returns:** `{"hpv_reminders_queued":n,"ran_at":"<ts>"}`.

---

## 6. SUD disclosures (§8.4)

### `rpc_sud_disclosure_consent(p_record_ids uuid[], p_recipient text, p_purpose text, p_expires_at timestamptz, p_consent_ciphertext text)` → jsonb
- **Auth:** teen only; every named record must belong to the caller's child
  (`sud_consent_subject_only`). A general health grant, Wellness grant, 18+
  re-consent toggle, or transition-summary export NEVER covers `sud_records`.
- **Effect:** writes a `sud_disclosure_consents` row naming what records, to
  whom, for what purpose, expiring when (future expiry required; consent
  instrument required). Audit-logged.
- **Returns:** `{"consent_id":"<uuid>","expires_at":"<ts>"}`.

### `rpc_sud_disclosure_revoke(p_consent_id uuid)` → jsonb
- **Auth:** teen only. **Effect:** instant revocation (`revoked_at=now()`),
  audit-logged. **Returns:** `{"revoked":true}`.

---

## 7. Amended RPCs (011/012, in place)

- `health_metric_visible()` → deprecated thin alias over `health_tier_visible()`;
  drop after all callers migrate (RC-022-2).
- `health_subject_age_band()` → returns `under13 | teen_13_15 | teen_16_17 |
  adult | unknown`; `unknown` fails closed into the 13–15 arm.
- `nutrition_weekly_patterns()` → §4 above (engagement-only for minors).
- `nutrition_targets` gate: `enforce_nutrition_target_gate()` trigger;
  `enforce_no_calories_minor()` trigger on `food_logs`.

---

## 8. Restaurant tie-in (W28, §10)

- `rpc_restaurant_recommendations` (W28 squad owns): amended to take the
  diner's subject_id, load their `allergy_list` (RLS: the diner's own list —
  a parent planning for a teen uses the teen's list only if the teen's H2
  grant covers it), and hard-block dishes/restaurants on allergen matches
  (exclude, not downrank; `allergen_block` reason code). "Allergen info
  unavailable" labels; never "allergy-safe" claims. For <18 diners: `low-cal`,
  `diet`, `skinny`, `guilt-free`, `light` filter tags suppressed server-side.

---

## Review checkpoints

- RC-RPC-1 (Team 1): every RPC's auth check traced; no RPC exposes H3 to a
  non-teen caller; no RPC accepts a caller who is not the subject for
  subject-only RPCs.
- RC-RPC-2 (Team 2): SECURITY DEFINER functions pin `search_path`; REVOKE ALL
  FROM PUBLIC confirmed; no `agent_reader` execute grants.
- RC-RPC-3 (Team 1): audit coverage — every mutation RPC writes
  `access_events` with no health content in the log payload.

| Checkpoint | Reviewer | Date | Result |
| RC-RPC-1   | (Fractional Team 1) | | |
| RC-RPC-2   | (Team 2 RLS audit) | | |
| RC-RPC-3   | (Fractional Team 1) | | |
