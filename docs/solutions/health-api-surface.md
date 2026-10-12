# Health Track — API Surface (implementation)

**Squad 2 — Health Track** | Implements sol-health.md §§2.5, 4.1, 5, 6.2, 9
Legal gate: counsel sign-off on H0–H3 required before production data flows (NFR-LEGAL).

All routes live under `/api/v1/health/*` and go through `handleRoute`
(`src/server/rest.ts`): requestId correlation, authenticated session required
(403 otherwise — never confirm/deny), Zod → 400, `ApiError` → canonical
envelope `{ok:false, error:{code,message,requestId}}`.

**Cookie rule (commit 538f288):** no route touches cookies directly.
Session auth and cookie handling are delegated to `handleRoute` →
`createClient()` (`src/lib/supabase/server`), which captures `Set-Cookie`
and attaches it to the response explicitly. Verified pattern; not
re-implemented per route.

**Error codes** (new in `src/server/errors.ts`, mapped from DB exceptions by
`mapDbError()` — raw Postgres detail never reaches clients):
`HEALTH_H0_REFUSED` (403) · `HEALTH_MINOR_CALORIE_REFUSED` (403) ·
`HEALTH_MINOR_SYNC_REFUSED` (403) · `HEALTH_TEEN_ONLY` (403) ·
`HEALTH_GATE_REQUIRED` (403).

**Layers:** Server Components use the server-actions layer
(`src/lib/health/actions.ts` — prior Squad 2 work: health context, grants,
re-consent, review queue, export, etc.). The HTTP routes below serve external
clients (iOS/Android companion apps, edge functions) and are the enforcement
point for device ingestion rules. Both layers call the same RPCs; the DB
predicate + triggers are the backstops either way.

---

## POST /api/v1/health/ingest

Device ingestion pipeline (sol-health §4.1). Discriminated union on `op`:

### `register_token`
```json
{ "op": "register_token", "subject_id": "<uuid>", "provider": "apple_healthkit|google_health_connect",
  "vault_token_ref": "<vault pointer>", "device_name": "iPhone 15" }
```
- <13 → `HEALTH_MINOR_SYNC_REFUSED` (COPPA, §4.4). At 13–17 the caller must be
  the teen (`isSelf`) — a parent cannot enable sync on the teen's device.
- Token VALUES go to the credential vault; `health_device_tokens` stores
  lifecycle state only. → `{token_id, status}`.

### `revoke_token`
```json
{ "op": "revoke_token", "token_id": "<uuid>" }
```
→ `{revoked: true}`.

### `ingest`
```json
{ "op": "ingest", "subject_id": "<uuid>", "token_id": "<uuid>",
  "device_name": "…", "app_version": "…",
  "readings": [{ "metric_key": "steps_daily", "value_numeric": 8421,
                  "recorded_at": "2026-10-12T07:30:00Z" }] }
```
Enforcement (route layer; DB is the backstop):
1. <13 → `HEALTH_MINOR_SYNC_REFUSED`.
2. Token must be `active` and belong to the subject. A token suspended at the
   18+ cutover (`suspended_pending_reauth`) never resumes — the adult
   re-authorizes a new one (§2.1).
3. `metric_key` allowlist (the app cannot receive what it cannot store);
   H0-class keys refused <18 with an audit-logged `HEALTH_H0_REFUSED`;
   calorie-burn keys dropped at ingest for minor subjects (§7.1).
4. Sanity ranges per metric; `recorded_at` = device timestamp (not ingest
   time; not >24h future); dedupe pre-check on
   (subject, metric, recorded_at, provenance) — the 022 unique index is the
   backstop.
5. Tier stamped from `metric_defs.health_tier` at write.
6. Anomaly screen (§4.3): counsel-reviewed thresholds only (unreviewed rows
   are inert); weight swing >10% WoW. On trip: `anomaly_flag` set,
   metadata-only `health_anomaly_flag` event emitted, teen-facing resources
   message returned. **Never auto-alerts parents; the flag is never
   parent-visible.**
7. Every reading carries provenance (`apple_healthkit`/`google_health_connect`/
   `manual`), device name, and app version — provenance is UI-visible
   everywhere (§4.1).

→ `{inserted, dropped[], anomalies, teen_message, disclaimer}` where
`disclaimer` = "Pookie shows what your devices recorded. Not a medical device."

---

## /api/v1/health/wellbeing

W8 wellbeing entries (sol-health §5). Teen-only (child-role asserted at the
route; RLS is the backstop).

- **GET** `?child_id=&limit=&before=` → `{entries: [...]}` (no parent arm).
- **POST** `{op:"entry", child_id, mood_score 1–5, mood_label, journal_text,
  tags[], care_category: none|mental_health_care|self_harm|disordered_eating,
  auto_purge_after_days: 30|90|365}` → `{entry, events_emitted[]}`.
  Care categories tier H3 server-side (DB trigger; teen cannot downgrade).
  `mood_score=1` → `mood_critical` (high); `self_harm` → `self_harm_disclosure`
  (high); `disordered_eating` → `ed_signal` (medium). Events carry metadata
  only — never content. Pattern detection also runs on write (flag only).
- **POST** `{op:"help_now", child_id}` → `{emitted:"mood_critical",
  resources: {call_988, crisis_text_line, ga_crisis_line}}`.
- **POST** `{op:"delete", child_id, entry_id}` → tombstone now (H3 hard-deletes
  on the next nightly run).

Crisis *response* (988 surfacing, trusted-adult routing) belongs to the safety
pipeline consuming `wellbeing_events`; this route emits events only.

---

## /api/v1/health/meal-checkins

W23 descriptive meal check-ins (sol-health §6.2).

- **GET** `?subject_id=&limit=&before=` → `{checkins: [...]}` (tier-filtered
  by RLS).
- **POST** `{subject_id, meal: breakfast|lunch|dinner|snack,
  food_groups[], hunger_before 1–5, fullness_after 1–5, energy_note}` →
  `{checkin}`.
- There are no calorie/macro/weight fields on this route — the schema has no
  such columns; a minor cannot log what the schema cannot hold. Parents of
  <18 see engagement only via `nutrition_weekly_patterns()`, not these rows,
  unless the teen's H2 grant covers them.

---

## /api/v1/health/immunizations

G22 immunization management (sol-health §9).

- **GET** `?subject_id=` → `{immunizations: [...]}` (H1 while <18; RLS
  tier-filtered).
- **POST** `{subject_id, vaccine_code (CVX), dose_number, administered_at,
  provider, lot_number, source, doc_path, form_3231_on_file,
  form_3231_expires}` → `{immunization}`. CVX validated against an allowlist
  (HPV 62/118/165, Tdap 115, MCV4 114, MenB 108, HepA 83, HepB variants,
  IPV 10, MMR variants, Varicella 21, COVID 196/197/198, Influenza 88) —
  unknown codes refused rather than free-texted, so dose histories stay
  machine-readable for school/college form exports.
- **PATCH** `/[id]` — update dose fields; a moved 3231 expiry re-arms the
  reminder ledger for the new date.
- **DELETE** `/[id]` — tombstone; the §3.3 purge hard-deletes ≤30 days and
  removes the 3231 PDF from the `health-documents` bucket.

Reminders (90/30/7-day 3231 expiry; annual HPV catch-up) run as pg_cron jobs
(`check_immunization_reminders`, `check_hpv_catchup_reminders`) notifying the
parent (<18) or the adult (18+) — logistics copy only, never medical advice.

---

## GET /api/v1/health/transition-summary

"Take to your new doctor" (sol-health §2.5). Subject-only (child-role asserted;
the RPC enforces).

- `?child_id=&format=json|pdf&include_h3=<comma-separated ids>`
- Calls `rpc_export_transition_summary()` server-side: medications
  (descriptive — never dosing advice), allergies, immunizations incl. 3231,
  vitals trends (trailing 12 months, min/max/avg/n per metric, provenance
  labels, "not a medical device" disclaimer), emergency contacts (decoupled
  from grants; included only when W19's table exists), insurance card (masked
  per W7).
- H3 excluded by default; only explicitly opted record IDs are included
  (each verified teen-owned H3). SUD records are never includable — separate
  disclosure instrument (028).
- `format=json` → machine-readable JSON download.
  `format=pdf` → the same payload rendered to a complete print-ready clinical
  summary document (single-page summary + appendices A/B) inside the
  canonical envelope (`{document_html, filename, content_type}`); the client
  saves/prints it. The document is streamed and never persisted.
- Every export is audit-logged by the RPC (`transition_summary_export`).

---

## Review checkpoints

- RC-API-1 (Team 1): route-layer refusals (H0, <13 sync, <18 calories) match
  the DB triggers; the route is the first layer, never the only layer.
- RC-API-2 (Team 2): no route widens RLS; `assertHealthSubject`/`assertTenant`
  on every route; subject-only routes assert child-role.
- RC-API-3 (Team 1): no banned words (diagnose/disorder/condition/abnormal/
  risk) in W2 responses — `assertNoBannedWords` on the anomaly message path.

| Checkpoint | Reviewer | Date | Result |
| RC-API-1   | (Fractional Team 1) | | |
| RC-API-2   | (Team 2 RLS audit) | | |
| RC-API-3   | (Fractional Team 1) | | |
