# "Window, Not Vault" — Privacy Re-Architecture Plan

**Status:** MD-approved direction (2026-10-12)
**Principle:** Pookie displays your life back to you. It does not keep a copy of it.
**Scope:** Health modules (W2, W8, W23) + Money modules (W11, W7, W24)

---

## 1. The Decision

Third-party sensitive data — health data from devices, banking data from financial
institutions — is **displayed through Pookie but never persisted by Pookie**.

Two concrete architectures:

| Data source | Where it lives | Pookie's role |
|---|---|---|
| Apple HealthKit (steps, sleep, HR, etc.) | On the user's iPhone only | Native app reads + displays locally. Zero bytes transmitted to our servers. |
| Bank accounts via Plaid | At the bank / Plaid | App fetches fresh per view via encrypted access_token. Displayed, then discarded. |

**What this is NOT:** a promise or a policy. It is an architectural constraint.
There is no API endpoint that accepts device health data. There is no table that
stores bank transactions. The code paths to violate this do not exist.

---

## 2. Health Modules Re-Architecture (W2, W8, W23)

### 2.1 Current state (to be changed)

- Server-side tables hold health records synced from devices/integrations.
- API routes accept and persist device health data.
- AI features process health data server-side.

### 2.2 Target state

**Device health data (HealthKit):**
- Native iOS app ONLY. Web browsers cannot access HealthKit — there is no web API.
- The app requests HealthKit authorization directly from the user (Apple's native
  permission sheet, per data type).
- Reads happen on-device. Display happens on-device. Nothing is transmitted.
- No `POST /api/v1/health/*` endpoint accepts device-sourced health data.
  (Enforced by simply not building those endpoints.)

**Manually-entered health data:**
- If the user types "took my meds at 8am" or logs a meal, that IS user-provided
  data sent to our servers — with explicit consent, clearly labeled in the UI as
  "you entered this."
- Server tables keep ONLY manually-entered rows. Schema gets a `source` column:
  `'manual'` (only allowed value for new writes; device sources rejected).
- The UI must visually distinguish "from your phone" (local only, lock icon,
  "never leaves this device") from "you logged this" (synced, editable).

**AI on health data:**
- Server-side AI cannot analyze what it cannot see. Two paths:
  1. **On-device summaries:** the app computes trends locally (e.g., "7-day sleep
     average") and displays them. No AI needed.
  2. **Explicit per-question sharing:** user asks Pookie AI "how's my sleep trend?" —
     the app sends ONLY the relevant snapshot with that request, transiently, never
     stored. The UI shows exactly what was shared, per question.

### 2.3 Schema changes

- `health_records` (and equivalents in W8/W23): add `source` TEXT NOT NULL DEFAULT
  `'manual'` with CHECK constraint `source = 'manual'`. Any write path attempting
  a device source fails at the database level.
- Drop (or stop writing to) device-sync columns/tables. Existing device-sourced
  rows, if any in staging: purge.
- No new tables for device data. Ever. (This is the constraint, not a suggestion.)

### 2.4 What requires building

1. **Native iOS app** (or React Native/Expo with HealthKit bindings). This is the
   hard dependency — the web app cannot deliver on-device health. Timeline impact:
   health dashboards are app-only until the native app ships.
2. **HealthKit integration layer** in the app: authorization flow, per-type reads,
   local trend computation.
3. **"Local only" UI kit:** lock-icon treatment, "never leaves this device" labels,
   per-question sharing sheet for AI queries.
4. **Server-side:** strip device-ingestion endpoints, add `source` constraints,
   update W2/W8/W23 UIs to show the two data classes distinctly.

### 2.5 What we lose

- Cross-device health sync (iPhone has it, laptop doesn't).
- Server-side health analytics and proactive insights.
- Parent visibility into teen device health data (correct teen-privacy posture, but
  needs careful messaging — see §5).

---

## 3. Money Modules Re-Architecture (W11, W24)

### 3.1 Current state (to be changed)

- Squad 4 built a `transactions` table with Plaid sync-and-store.
- `spending_summary()` RPC queries stored transactions.
- Standard fintech pattern — but not what we're doing.

### 3.2 Target state

**Plaid connection:**
- Plaid Link (client-side) → `public_token` → server exchanges for `access_token`.
- Bank username/password never touch our servers (Plaid guarantees this).
- We store ONLY the `access_token`, encrypted with AES-256 and a dedicated
  encryption key (`PLAID_TOKEN_ENCRYPTION_KEY`). It is an opaque string — not an
  account number, not a balance, not a transaction.

**Transaction/balance display:**
- Fetch-on-view. Every time the user opens Spending, the server decrypts the token
  in memory, calls Plaid (`/transactions/sync`, `/accounts/balance/get`), returns
  the data in the response, and discards it. Nothing is written to any table.
- In-session caching only (in-memory, per-request). Never persisted.
- `spending_summary()` becomes a live Plaid call, not a database query.

**User's own inputs (stored — this is their data):**
- Manual categorizations, notes on transactions, budgets they set: stored normally.
  Linked to Plaid's `transaction_id` (an opaque reference, not financial data).
- CSV imports and manual entries: user-provided, stored with consent.

**Disconnect = cryptographic erasure:**
- Deleting the encrypted `access_token` makes the connection unrecoverable.
- No orphaned transactions, no residual balances, no financial profile.

### 3.3 Schema changes

- **Remove** the `transactions` table's Plaid-synced rows. Options: drop the table
  entirely and keep a `transaction_notes` table (user annotations keyed by Plaid
  `transaction_id`), or keep the table but only for manual/CSV entries with a
  `source` constraint like health (§2.3).
- **Keep** the encrypted token store (minimal table: `user_id`, `encrypted_token`,
  `institution_name`, `connected_at`). This is the ONLY banking-related persisted
  data.
- Teen privacy simplification: with no stored transactions, the RLS complexity
  around `transactions` becomes unnecessary. A teen's spending is private by
  architecture — there is no table for a parent to query.

### 3.4 What we lose

- **Speed.** Every view is a live Plaid API call. Noticeable on slow connections.
- **Plaid API costs** scale with views, not just syncs. Session-level in-memory
  caching mitigates this; aggressive prefetching does not (it would defeat the
  purpose).
- **Offline access.** No connection = no data. Clean "connect to refresh" state.
- **Proactive money alerts.** "You spent $200 on restaurants this week" as a push
  notification requires watching spending, which requires stored data. We lose
  server-side financial insights unless the user opens the app.

### 3.5 W7 Vault and W24 Credit — no change needed

- **W7 Vault** is user-uploaded documents (insurance cards, IDs). The user
  deliberately stores these with us — that IS the product. Encrypted at rest
  (AES-256), as built. The "window, not vault" principle applies to *third-party*
  data, not to things the user explicitly entrusts to us.
- **W24 Credit** is freeze management (checking/toggling freezes via bureaus).
  No banking transaction data involved. No change.

---

## 4. What Stays Server-Side (explicit user-provided data)

The principle is precise: **third-party data is displayed, not stored. User-provided
data is stored with consent.** These stay on our servers as built:

- Manual health logs, meal entries, manual transactions, CSV imports
- Vault documents (user-uploaded)
- Transaction categorizations and notes (user's annotations)
- Support tickets, messages, account data
- School data (user-connected, with consent — separate decision, not in scope here)

The UI must make the boundary legible: "from your device/bank" (never stored)
vs. "you gave us this" (stored, deletable).

---

## 5. Legal Impact

This re-architecture directly addresses the 3-attorney gate clearance findings:

| Gate / finding | Impact |
|---|---|
| **FTC Health Breach Rule (applies)** | The determination rested on Pookie *holding* health data. Device health data we never hold cannot be breached. Manual entries remain in scope but are a far smaller surface. |
| **MHMDA (WA)** | No server-side health/banking data to mishandle = dramatically reduced exposure for device/bank data. |
| **42 CFR Part 2** | SUD-adjacent device data never touches the platform. No Part 2 exposure for device data. |
| **D2 (AI training "NEVER")** | Moot for device/bank data — there is nothing to train on. |
| **COPPA (under-13)** | Device health data for under-13s never leaves the phone. Simpler compliance story. |
| **Teen privacy** | Private by architecture for device health and bank data, not just by RLS policy. |

**Does NOT eliminate:** manual-entry health data still needs HBR/MHMDA handling.
Support tickets about health, AI chat about health — still in scope. This shrinks
the problem; it doesn't delete it. The attorneys should re-evaluate Gates 7 and 10
against this architecture.

---

## 6. Implementation Phases

### Phase A — Server-side stripping (web app, no native app required)
1. Health: add `source` CHECK constraints, remove device-ingestion endpoints,
   purge device-sourced staging rows, update UI copy.
2. Money: replace transactions sync-and-store with fetch-on-view, migrate to
   `transaction_notes` for user annotations, keep encrypted token store.
3. Add "local only" vs "you gave us this" UI treatments across W2/W8/W23/W11.
4. Attorney re-evaluation of Gates 7 + 10 against the new architecture.

### Phase B — Native iOS app with HealthKit
1. App shell with HealthKit authorization flow.
2. On-device health dashboard (reads + local trends, zero transmission).
3. Per-question AI sharing sheet (explicit, transient, visible).
4. "Local only" lock-icon UI kit.

### Phase C — Polish
1. Session-level in-memory caching for Plaid views (cost control).
2. "Connect to refresh" offline states.
3. Parent-facing messaging for teen device-data privacy.

---

## 7. Open Questions for Mehedi

1. **Native app timeline:** HealthKit requires it. Does this accelerate the iOS app
   on the roadmap, or do health dashboards wait?
2. **Plaid cost tolerance:** Fetch-on-view increases API calls vs. nightly sync.
   Acceptable, or do we need usage guardrails?
3. **Manual-entry health scope:** With device data local-only, how much manual
   health logging do we still want server-side? (Every manual row is HBR surface.)
4. **Attorney re-evaluation:** Authorize the 3-attorney team (or licensed counsel)
   to re-score Gates 7 + 10 against this architecture?

---

## 8. Marketing Line

*"Your health data never leaves your phone. Your bank data never lands on our
servers. Pookie is a window, not a vault — it shows your life back to you without
keeping a copy."*

Nobody in the family-app space can say this truthfully. We can, because the
architecture makes it true — not the privacy policy.
