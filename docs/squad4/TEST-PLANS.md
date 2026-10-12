# Squad 4 — Home & Money Track 🏡 — Test Plans

**Version:** 1.0 — 2026-10-12 (QA Engineer)
**Repo:** `~/workspace/pookie-app`, branch `staging-build`
**Authority:** Mehedi's standing test protocol (AGENTS.md) · `docs/BUILD-SPECIFICATION.md` (FR-MOD-W21/W20/W11/W7/W24/W14/W12, NFR-SEC, NFR-PRIVACY) · `docs/EXPERT-SOLUTIONS.md` · `docs/pm/QUALITY-PLAN.md` · MD decisions D5/D6 (`docs/MD-DECISIONS.md`)
**Managing Director directive (2026-10-12): NO PLACEHOLDERS.** Every test asserts real end-to-end functionality against real data. "Stub contract tests" are replaced by (a) full local-flow E2E tests (manual entry → categorization → RLS → UI) and (b) integration-point contract tests that verify the seam against the spec'd interface. **No test may pass against mock data and be marked complete.** W24/W14 tests are framed as "verifies pending-review state renders and underlying data model functions" — the legal gate blocks user launch, not testability.

---

## 0. Global conventions (apply to all 7 modules)

### 0.1 No-mock rule (binding)
- A test is only marked PASS when it ran against **real infrastructure**: the real schema (applied migrations), real RLS policies, real route handlers, and real data rows.
- **Unit tests** of pure logic (e.g., `normalizeName`, grant-cap counting functions) may use synthetic fixture rows, but they are supporting evidence only — they do not substitute for the E2E/RLS assertions, and a feature is never marked complete on unit tests alone.
- **Integration-point contract tests** (Plaid, OCR vendors) run against the *spec'd interface*: the adapter under test must implement the required interface shape and behave per contract; where a vendor sandbox exists (e.g., Plaid sandbox), the test calls the **real sandbox API** — never a locally fabricated stub returning canned data. If the vendor sandbox is unavailable, the contract test is BLOCKED (named dependency), not passed.
- Tests that cannot reach real data/infra are recorded as **BLOCKED** with the blocking dependency — never as PASS.

### 0.2 Test data hygiene
- All data-driven tests use **synthetic households** (e.g., `qa-hh-a`, `qa-hh-b`) created through the real signup/onboarding flow on the staging/dev Supabase project — never real family data, never production.
- Each test plan's teardown returns the synthetic households to a clean state (or deletes them via the real delete paths, exercising those paths too).
- Tests are idempotent: re-runnable without manual reset.

### 0.3 Execution tools
- **PostgREST direct:** `curl` (curl-style User-Agent per AGENTS.md lesson) against `https://<project>.supabase.co/rest/v1/<table>` with the **anon key** (never service_role) + user JWTs for the two test households. Proves RLS as the client actually experiences it.
- **Route tests:** real `next start` (staging build) or dev server; route handlers run through the real SSR Supabase client (singleton per NFR-RELIABILITY-003).
- **UI tests:** rendered pages on the real staging URL, checked personally per the trust rule; Mehedi's design gate applies to anything user-facing.
- **Type safety:** `npx tsc --noEmit` clean before any E2E run.
- **Secret scan:** `grep -rEn "sk_|AKIA|AIza|ghp_|xoxb-|BEGIN .*PRIVATE KEY|supabase.*service_role" <build output>` — zero hits required (see §9).

### 0.4 Test IDs
Every test has an ID: `S4-<module>-NNN` (e.g., `S4-W21-001`). Defects get `S4-BUG-NNN`. Blocked tests get `S4-BLK-NNN` with the dependency named.

### 0.5 Pass/fail language discipline (trust rule)
- "Implemented" ≠ "tested" ≠ "deployed" ≠ "live". A PASS verdict requires observed evidence (query result, HTTP response, screenshot) recorded with the test run.
- QA-significant findings are filed as defects in the phase they were found (QUALITY-PLAN §5).

---

## 1. W21 — Mail (photo intake) · FR-MOD-W21, NFR-PRIVACY-009, NFR-SEC-006
**Schema:** migration `008_w21_mail.sql` — `mail_items`, `mail_action_items`, `mail_dispute_drafts`, `mail_ocr_providers`; private `mail-photos` storage bucket; `is_household_parent()` Class-S gate; `account_last4` only; `data_class` taxonomy column.

### 1.1 OCR accuracy — real-flow E2E (replaces any stub OCR test)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W21-001 | OCR accuracy on a graded sample set | Upload 30 real-world sample mail images through the real intake route (printed envelopes, utility bills, bank statements, handwritten notes — synthetic/consented fixtures, not real families' mail). The active local provider (`workers-ai-vision` per `mail_ocr_providers` seed) performs OCR; compare extracted fields (sender, due date, amount, account last-4) against human-labeled ground truth in a CSV. | Field-level F1 ≥ 0.90 for typed documents; handwritten flagged "low-confidence" rather than silently wrong (per `handles_handwriting=false`); ≥90% of account numbers recovered as **last-4 only**. |
| S4-W21-002 | Provider-gate contract | Query `mail_ocr_providers` via anon GET; attempt intake through an `is_external=true, active=false` provider row (if any). | Registry readable; inactive/external providers refuse intake with an explicit error (not silent skip); `external_ocr_consent` gate blocks third-party OCR until consent row exists. |
| S4-W21-003 | OCR-text visibility contract | List route vs detail route responses compared field-by-field (real JWT). | `ocr_text`/`extracted_text` absent from every list payload; present only on the audited detail route; detail read writes an `auditEvent('mail_item.read')` row. |

### 1.2 GIPA masking — assert NO full PAN/SSN persists
| ID | Test | Method | Pass criteria |
|---|---|---|---|
| S4-W21-004 | extract-then-mask invariant (DB audit) | After S4-W21-001 runs: SQL via service_role (QA read-only audit): `SELECT extracted_text FROM mail_items WHERE extracted_text ~ '\d{13,19}' OR extracted_text ~ '\d{3}-\d{2}-\d{4}'`. Also scan `mail_action_items`, `mail_dispute_drafts`, and `photo_path` metadata. | **Zero rows** match full PAN (13–19 digits) or SSN patterns. Only last-4 fragments (`…1234`) appear, with no reconstructable full number (no second column/index holding the masked-out digits). |
| S4-W21-005 | Masking unit guard (supporting) | Feed known PAN strings through the masking function used by the intake pipeline. | 16-digit test PANs → last-4 only; Luhn-valid numbers from all major networks masked; function never returns >4 trailing digits. (Supporting evidence only — S4-W21-004 is the gate.) |
| S4-W21-006 | Masking under adversarial OCR | Sample images where the account number is split across lines, partially obscured, or embedded in a longer digit run (routing+account concatenated). | Masked region covers the full reconstructed number; no partial-number leakage into `extracted_text`. |

### 1.3 30-day auto-delete job
| ID | Test | Method | Pass criteria |
|---|---|---|---|
| S4-W21-007 | Raw-image purge at day 31 | Seed `mail_items` with `photo_path` rows at ages 29, 30, 31, 60 days (backdated via QA-controlled insert through the real route, then service_role age adjustment where the route forbids backdating — age setup only, deletion verified through the real path). Run the real purge job (cron/sweeper as implemented). | Day-31 and day-60 rows: `photo_path` NULLed **and** the object deleted from the `mail-photos` bucket (HEAD on the object → 404); day-29/30 rows untouched; `extracted_text` (masked) retained per policy — only the raw image dies. Job run logged (idempotent re-run deletes nothing further). |
| S4-W21-008 | Purge is irreversible + audited | After S4-W21-007, attempt recovery of the purged object via storage API and via DB. | Object unrecoverable; an audit row records the purge (item id, timestamp, job id). Backups: confirm the ≤30-day backup purge commitment (NFR-PRIVACY-002) is documented in the retention schedule — vendor-verified before "done". |
| S4-W21-009 | No client DELETE (ledger invariant) | Authenticated DELETE attempts against mail routes/APIs (real JWT). | All rejected (405/403); dismissal path is `status='dismissed'` via PATCH/POST only; dismissed rows remain queryable by the owner (no silent loss). |

### 1.4 RLS — household isolation + Class-S gate
| ID | Test | Method | Pass criteria |
|---|---|---|---|
| S4-W21-010 | Cross-household read isolation | Two synthetic households A (parent JWT) and B (parent JWT). Insert mail via A's route. Direct PostgREST GET on `mail_items`, `mail_action_items`, `mail_dispute_drafts` with B's JWT. | B gets **zero rows** from A's household on all three tables. (If a row leaks: P0 defect, line stops.) |
| S4-W21-011 | Child gets zero rows | Child-role JWT in household A queries all mail tables + attempts direct storage read of A's `mail-photos` object. | Zero rows; storage read denied. `is_household_parent()` is the enforced gate — verify by attempting the same with a parent JWT (succeeds). |
| S4-W21-012 | Anon / wrong-household JWT | Anon key (no JWT) GET on mail tables and bucket. | Zero rows; bucket list/GET denied. |
| S4-W21-013 | Storage bucket policy audit | Attempt: B-parent read of A's object; A-parent read of A's object; signed-URL expiry behavior. | Only the owning household's parents can read; signed URLs time-boxed. |

---

## 2. W20 — Shopping List · FR-MOD-W20 (live route `/household/shopping`)
**Schema:** migration `007_w20_shopping.sql` — `shopping_lists`, `shopping_items`, `shopping_price_reports`; service `src/server/services/shopping.ts`; routes under `src/app/api/v1/household/shopping/`; UI `src/app/household/shopping/page.tsx` + `src/components/shopping/shopping-board.tsx`.

### 2.1 CRUD E2E (real stack)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W20-001 | List lifecycle | Via real routes: create list → rename → set preferences → delete list (owner). | Each step returns 2xx with the expected shape; delete cascades items + price reports (verify via follow-up GET → 404/empty, and direct PostgREST check with owner JWT → zero rows). |
| S4-W20-002 | Item state machine (real transitions) | Drive every transition through the routes: needed→claimed→bought→removed; needed→removed; claimed→needed (unclaim); illegal jumps (needed→bought, bought→claimed, removed→anything). | Legal transitions succeed and persist; **all illegal transitions return 409** (CONFLICT) and leave the row unchanged — verified by re-reading the row after each attempt. Matches `ALLOWED_TRANSITIONS` in `shopping.ts`. |
| S4-W20-003 | Dedupe contract | Add "  MILK ", "milk", "Milk" via the real item route. | Single row after normalization (`normalizeName`); quantity merged or rejected per spec §2.2 — no silent duplicates. |
| S4-W20-004 | Batch add | POST batch with 20 items (mix of valid + 1 invalid). | Atomicity per spec: either all-or-nothing or documented partial-success contract — assert the actual contract holds and invalid item is identified by index. |
| S4-W20-005 | Price reports | Report price at store A and store B for the same item; re-report at store A. | Reports persist with reporter identity; latest-per-store resolution is deterministic and visible in UI. |
| S4-W20-006 | Audit trail | After S4-W20-001–005, inspect audit log for `shopping_list.viewed`, item mutations. | Every mutation has an actor, timestamp, household scope; `added_by`/`bought_by` names resolve (no raw UUIDs in UI). |

### 2.2 Household sharing — two users (real second user)
| ID | Test | Method | Pass criteria |
|---|---|---|---|
| S4-W20-007 | Shared list visibility | Parent P1 creates household list; second household member P2 (parent or teen per spec roles) loads `/household/shopping` and the list API. | P2 sees the list and items with correct `role`/`userId` fields; P2's claimed item shows "You" tag to P2 and P2's name to P1. |
| S4-W20-008 | Cross-user item actions | P2 claims P1's item; P1 attempts to remove P2's claimed item (role-gated per route comments). | Role rules enforced exactly as implemented (UI buttons disabled AND route rejects — never UI-only gating). |
| S4-W20-009 | Preferences isolation | P2 writes preferences; P1's preferences unchanged. | Preferences are per-user (or per-list with owner-only write — assert the actual implemented contract, then lock it in). |

### 2.3 Existing route regression
| ID | Test | Method | Pass criteria |
|---|---|---|---|
| S4-W20-010 | Route smoke (to be created — S4-BUG-003) | Extend `smoke-test-staging.py` (or a sibling) with authenticated checks for every shopping route: `list`, `items`, `items/[itemId]`, `items/[itemId]/remove`, `items/batch`, `preferences`, `prices` (expect 2xx with a real household JWT; 401 without). | 100% of shopping routes green once the script exists; no regressions. Until then, S4-W20-001–009 are the regression net. |
| S4-W20-011 | Page render | Load `/household/shopping` as P1 and P2 (real login). | Renders with data, no console errors, no 404s on assets; Nebula/canopy styling intact (design gate). |
| S4-W20-012 | Type + cleanliness | `npx tsc --noEmit` clean; grep shopping tree for `console.log`, dead exports. | Zero type errors; zero console.logs; no dead code (Mehedi's standing rule). |

## 3. W11 — Spending · FR-MOD-W11 (⚠️ — teen privacy is THE critical test)
**Spec:** Mask to last-4; FTC Disposal Rule on disposal; **teen's own purchase detail is teen-private.**
**Implementation (real, in-repo):** migration `035_w11_spending.sql` — tables `transactions` (`is_teen_private boolean NOT NULL DEFAULT false`, `purchased_by`, `category_override`, amount sign convention: >0 outflow / <0 inflow per Plaid; **no DELETE policy — ledger-like**), `spending_accounts`, `plaid_items` (owner-scoped; Plaid tokens are encrypted blobs, never plaintext). Teen privacy is enforced **in RLS, not the app**: `transactions_household_read` = household member AND (`NOT is_teen_private` OR `purchased_by = auth.uid()`); parents get aggregates via the `spending_summary()` SECURITY DEFINER RPC (parent-role checked inside).
**No-placeholder rule applied:** the Plaid seam is tested as (a) full local-flow E2E via the manual/CSV entry path (manual entry → categorization engine → RLS scoping → UI) against real data, and (b) an integration-point contract test against the Plaid **sandbox** API (real API, sandbox credentials) — never a canned-data stub.

### 3.1 Teen privacy — the critical test (BLOCKS the module if it fails)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W11-001 | Parent sees aggregates only | Synthetic household: parent P + teen T (13–17). Seed T's transactions via the real manual-entry/CSV path with `is_teen_private=true` (real categorization engine runs). As P (real JWT + real UI + direct PostgREST on `transactions`): open Spending; call `spending_summary()`. | P sees **category totals, monthly aggregates, trends** via `spending_summary()` — and **zero line-item rows** for T's purchases: direct PostgREST `SELECT` on `transactions` as P returns zero of T's private rows (the RLS policy `transactions_household_read` enforces it — prove at the API layer, not the UI). Any single merchant name, amount, or timestamp of T's leaking to P = **P0 defect, module blocked**. |
| S4-W11-002 | Teen sees own full detail | As T: same dataset (`purchased_by` = T). | T sees every own line item (merchant, amount, date, category) with nothing redacted — the `purchased_by = auth.uid()` arm of the policy. |
| S4-W11-003 | Parent's own detail intact | As P: P's own transactions. | P sees own full line-item detail (privacy boundary is per-person, not parent-blind). |
| S4-W11-004 | Sibling isolation | Two teens T1, T2 in one household. | T1 cannot see T2's line items (PostgREST + UI); aggregates shown to parents never expose per-teen drill-down (no "click total → see whose" path). |
| S4-W11-005 | Revocation propagation | T revokes P's aggregate scope (per age-tier rules) or turns 18 with continuity prompt. | Aggregates disappear for P immediately (no cached/stale aggregate served — verify with a fresh request, not a cached page); audit row records the scope change. |
| S4-W11-006 | Export/report leakage | As P: export CSV/PDF, weekly digest, "share" actions. | No export path contains T's line items; digests carry aggregates only. |
| S4-W11-007 | Search leakage | As P: search "Starbucks"/merchant names that exist only in T's data. | Zero results; no autocomplete suggestions leaking T's merchants. |

### 3.2 Full local-flow E2E — manual entry → categorization → RLS → UI
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W11-008 | Manual entry end-to-end | As T: manually enter 25 transactions (mixed merchants, amounts, dates incl. edge cases: refunds/negative amounts, split categories, future-dated). Real categorization engine assigns categories. Reload UI as T and as P; query PostgREST as both. | T: all 25 visible with correct categories; user overrides of category persist. P: aggregates update by the correct totals; still zero line items (ties back to S4-W11-001). Every amount is exact to the cent — no float drift in aggregates (sum(line items) == aggregate, verified in SQL). |
| S4-W11-009 | Categorization quality | The 25-transaction set includes ambiguous merchants; run the real categorizer. | ≥90% correct category on first pass; miscategorized items correctable by the user and the correction persists; correction never changes another user's data. |
| S4-W11-010 | Last-4 masking | Transactions carry `account_last4` only. DB audit via service_role (QA read-only): regex scan for `\d{13,19}` across `transactions`, `spending_accounts`, `plaid_items`. | Zero full PANs; UI shows `…1234` forms only. `plaid_items` access tokens are encrypted blobs — assert ciphertext, never plaintext (same method as S4-W7-004). |
| S4-W11-011 | FTC Disposal Rule | The schema has **no DELETE policy** on `transactions` (ledger-like, per migration comment). Exercise the implemented disposal path for statements; then attempt forensic read (PostgREST + storage). **Implementation checkpoint:** if no disposal path exists for statements, file as defect — the FTC Disposal Rule requires proper disposal of consumer-report-derived data; "no DELETE" cannot mean "keep forever" (NFR-PRIVACY-002 demands a written retention schedule). | Disposed records unrecoverable; disposal logged; retention schedule documents the disposal method (NFR-PRIVACY-002). |

### 3.3 Integration-point contract — Plaid seam (spec'd interface, real sandbox)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W11-012 | Plaid sandbox contract | With Plaid **sandbox** credentials (test institution): Link-token create → public-token exchange → accounts/transactions sync through the real adapter code. Assert the adapter consumes the real API shapes (accounts, transactions, `pending` flags, cursor pagination) and maps them into the app schema. | Adapter works against the real sandbox API with zero code-path differences from production (env-switched base URL/keys only); webhook payload shapes handled per Plaid docs; no production credentials in test config. **If sandbox is unreachable: S4-BLK — blocked, never passed.** |
| S4-W11-013 | Plaid data lands masked + teen-private | Transactions synced from sandbox flow through masking + teen-privacy RLS before any UI read (real JWTs, real queries). | Same guarantees as S4-W11-001/010 hold on Plaid-sourced rows: last-4 only, teen line items invisible to parent at the PostgREST layer. |
| S4-W11-014 | Plaid credential hygiene | Inspect adapter config + bundle. | No Plaid secret/client-id in client bundle or repo (grep-verified); tokens stored server-side only, rotatable; disconnect revokes at Plaid and deletes stored tokens (verify: post-disconnect sync attempt fails closed). |

---

## 4. W7 — Money & Documents (vault) · FR-MOD-W7, NFR-PRIVACY-009, NFR-SEC-006
**Spec:** Same masking as W21; **never persist full card numbers**; credentials-vault grade encryption (NFR-SEC-006: encrypt before any real credentials stored; never log plaintext; rotation + cryptographic erasure).
**Implementation (real, in-repo):** migration `036_w7_vault.sql` — table `vault_documents` (`owner_user_id` tenant key, `doc_type` CHECK across card/bank_account/tax/insurance/medical/legal/identity/loan/other, `doc_label` — "never a full number", **`encrypted_blob bytea` holding `pgp_sym_encrypt()` ciphertext**, `created_by`, `retention_until` computed by `vault_retention_until()`, `data_class`).

### 4.1 No-full-PAN persistence — DB audit (the gate)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W7-001 | Full-repo PAN audit | After exercising every vault write path (add card, add document, edit, import): service_role (QA read-only) regex scan `\d{13,19}` and `\d{3}-\d{2}-\d{4}` across **`vault_documents`** (all text columns incl. `doc_label`, `notes`-equivalents), its history/audit tables, and storage object metadata. | **Zero matches.** Any single full PAN = P0, module blocked. |
| S4-W7-002 | PAN never in logs | Trigger card add/edit with a synthetic test PAN; inspect server logs, error payloads, audit rows. | PAN appears nowhere — logs show masked form or token reference only. |
| S4-W7-003 | PAN never in transit dumps | Capture the actual request/response payloads of the vault write routes (test harness proxy). | No full PAN in any response body, including error responses and validation messages ("card number invalid" must not echo the number). |

### 4.2 Encryption at rest — verified, not asserted
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W7-004 | Ciphertext on disk | Write a vault secret through the real route; read the raw row via service_role. | `encrypted_blob` holds `pgp_sym_encrypt()` ciphertext — no plaintext substring of the input present in the column. |
| S4-W7-005 | Decrypt round-trip | Read the secret back through the real route as the owning parent. | Correct plaintext returned to the authorized user; wrong-household JWT gets zero rows (RLS) — not an error message containing ciphertext. |
| S4-W7-006 | Cryptographic erasure | Delete a vault item through the real route; attempt read via route, PostgREST, and raw row inspection. | Item unrecoverable via all paths; deletion audited. Assert the implemented erasure mechanism (key destruction vs row delete) and lock it in — "deleted" must mean forensically unrecoverable, not merely RLS-hidden. |
| S4-W7-007 | Rotation | Rotate the vault key per the implemented rotation procedure on a seeded dataset. | Old-key ciphertext re-wrapped; reads still succeed; old key retired and unusable (attempt decrypt with retired key → fails). |

### 4.3 Retention schedule enforcement
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W7-008 | Raw financial images ≤30 days | Same method as S4-W21-007 against the vault's document images. | Purge at day 31 verified at storage + DB; masked metadata retained. |
| S4-W7-009 | Retention schedule published | Inspect the user-facing retention schedule (per NFR-PRIVACY-002: written policy, no "indefinite"/"TBD"). | Every vault data class has a stated retention + disposal method; under-13 data has no indefinite retention (COPPA 312.10). |

### 4.4 RLS household isolation
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W7-010 | Cross-household vault isolation | Households A and B; A stores card + document. B-parent direct PostgREST on vault tables + storage reads. | Zero rows; zero object reads. |
| S4-W7-011 | Child exclusion | Child JWT in household A attempts vault reads. | Zero rows (vault is parent-scoped; assert the actual implemented role contract). |
| S4-W7-012 | Anon | Anon GET on vault tables/bucket. | Denied everywhere. |

## 5. W24 — Credit · FR-MOD-W24, NFR-COMPLIANCE-002 (🛑 re-scoped; counsel sign-off required)
**Spec:** 3-bureau monitoring is **blocked** (no FCRA permissible purpose; bureaus won't furnish). Re-scoped to **minor security-freeze management** under O.C.G.A. §§ 10-1-914/914.1 + credit-hygiene coaching via a licensed partner. FCRA counsel sign-off required before any user launch.
**No-placeholder framing:** the legal gate blocks *user launch*, not *testability*. Tests verify the pending-review state renders correctly AND the underlying data model functions against real data.

### 5.1 Pending-legal-review state (renders, real UI)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W24-001 | Module renders "pending legal review" | Load the Credit module route as a parent on staging (real login, real render). | A clear pending-review notice renders (plain language ≤8th-grade, citing FCRA + O.C.G.A. §§ 10-1-914/914.1); **no** 3-bureau monitoring UI, copy, CTA, or upsell is reachable from any path (menu, deep link, search). |
| S4-W24-002 | No monitoring functionality exposed | Crawl the module's routes/components; attempt direct URL access to any monitoring-shaped endpoints; grep client bundle for bureau API calls. | Zero monitoring functionality: no score pulls, no bureau API calls, no "enroll in monitoring" flow. Any remnant = P0 defect. |
| S4-W24-003 | Age-gating | Load as a <18 account (FR-MENU-004). | Credit module hidden from under-18 (menu + direct URL → age-gate, not the module). |

### 5.2 Freeze-status data model (functions, real DB)
**Implementation (real, in-repo):** migration `037_w24_credit.sql` — table `credit_freezes` (`child_id` tenant key, `bureau` CHECK ∈ {equifax, experian, transunion, innovis, chexsystems}, `freeze_status` CHECK ∈ {not_requested, requested, confirmed, temporarily_lifted, removed, error}, `requested_by/at`, `confirmed_at`, `confirmation_ref` (opaque bureau code), `lift_requested_at`, `lift_expires_at`, `notes`, `counsel_review_status` DEFAULT 'pending', `counsel_reviewed_by/at`, `data_class`).
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W24-004 | Freeze record CRUD | Via the real API/route layer with a parent JWT: create a freeze-status record per bureau for a synthetic minor profile; transition `not_requested` → `requested` → `confirmed`; read back; verify `requested_at` ≤ `confirmed_at`. | All five bureaus representable; status transitions follow the CHECK enum; timestamps coherent; records household-scoped. |
| S4-W24-005 | Freeze data model correctness | Direct PostgREST: attempt invalid `bureau` ('fakecreditbureau') and invalid `freeze_status` ('hacked'); attempt duplicate active rows per (child, bureau) if a uniqueness constraint exists. | Invalid values rejected at the DB layer (4xx); `confirmation_ref` is opaque (no PAN/SSN-shaped content — regex-audited); `counsel_review_status` starts `'pending'` and only counsel workflow moves it. |
| S4-W24-006 | Freeze RLS | Cross-household read attempts (B-parent on A's `credit_freezes` rows); child JWT read attempts. | Household parents only; zero rows for B and for children. |
| S4-W24-007 | Coaching-partner seam (integration-point contract) | If a licensed-partner coaching integration exists: contract test against the partner's **sandbox/staging** endpoint with synthetic data — verify content renders as coaching only (no score, no bureau data). If no partner is integrated yet: **S4-BLK-001** (blocked on licensed-partner integration), never passed. | Coaching content is educational only; no FCRA-regulated data flows. |
| S4-W24-008 | Launch gate | Attempt to enable any user-facing monitoring or to file a real freeze with a real bureau. | Impossible by design until counsel sign-off is recorded; sign-off artifact (counsel letter/memo) is the named unblock for S4-BLK-002. |

**Blocked register:** S4-BLK-002 — full user launch of W24 blocked on **FCRA counsel sign-off** (named dependency: licensed counsel review per NFR-COMPLIANCE-002). What IS testable now: S4-W24-001–007.

---

## 6. W14 — Co-parenting · FR-MOD-W14, R5 (🛑 family-law practitioner review required)
**Spec:** Blocked for high-conflict as designed. Required: **parallel-parenting mode** (separate surfaces, no shared messaging to screenshot); **immutable uneditable log**; no child-as-courier; custody-order awareness + travel-restriction profile (FR-SAFETY-012); neutral teen-facing coaching/pattern flags. Launch read-only/logistics-only; expand only after review.
**No-placeholder framing:** the legal gate blocks *user launch*, not *testability*. Tests verify the pending-review state renders AND the underlying data model functions against real data.

### 6.1 Pending-review state (renders, real UI)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W14-001 | Module renders review-gated state | Load the Co-parenting surface as Parent A on staging (real login). | Pending family-law-review notice renders (plain language); the surface offers **read-only/logistics-only** functions only — no open messaging composer, no editable shared notes. |
| S4-W14-002 | Custody-order field presence | Inspect the logistics surface + schema: `court_order_restriction` / custody-order awareness fields exist and are visible where logistics decisions are made (pickup authorization, travel). | Field present, labeled in plain language; per D5, Pookie does not adjudicate — disputes route to human review (verify the routing exists, not a dead link). |
| S4-W14-003 | Travel-restriction profile | With a custody order restricting out-of-state travel, attempt to authorize travel crossing the restriction (real logistics flow). | Blocked with a plain-language explanation; block logged immutably; FR-SAFETY-012 honored. |

### 6.2 Immutability — real UPDATE/DELETE attempts (the gate)
**Implementation (real, in-repo):** migration `038_w14_coparenting.sql` — table `coparenting_log` (`child_id` tenant key). Verified in the migration source: **zero UPDATE/DELETE policies** (only `coparenting_log_parent_read` + `coparenting_log_parent_insert` exist) and the file's own comment states "no grants" for UPDATE/DELETE. Tests below prove it from the client side rather than trusting the comment.
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W14-004 | UPDATE on log entries must fail | Create log entries via the real write path as Parent A; then attempt `UPDATE` via PostgREST with A's own JWT (the *owner* trying to edit their own entry), with B's JWT, and via any API route. | **All UPDATE attempts fail** (no UPDATE policy + no UPDATE grant — verify both layers: query `information_schema`/policy catalog for the table AND observe the 4xx/empty behavior, mirroring the `004_compliance.sql` append-only pattern). |
| S4-W14-005 | DELETE on log entries must fail | Same matrix for DELETE. | **All DELETE attempts fail**; no soft-delete-via-UPDATE loophole (UPDATE is already impossible per S4-W14-004). |
| S4-W14-006 | Corrections are append-only | Attempt the legitimate "I made an error" flow. | Only path is a new superseding entry linked to the original (original preserved byte-for-byte); UI shows the correction chain, never a rewritten entry. |
| S4-W14-007 | Tamper evidence | service_role (QA read-only) inspection: log table has no UPDATE/DELETE grants to any client role; row hashes/sequence numbers (if implemented) verify. | Append-only proven at the grant layer, not just the policy layer. |

### 6.3 Parallel-surface isolation
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W14-008 | Parent A cannot see Parent B's surface | Two synthetic parents A and B linked to the same child (parallel-parenting setup). A creates log entries, views dashboard; B does the same. Direct PostgREST + UI as each. | A sees only A's surface; B sees only B's; **zero cross-visibility** of log entries, drafts, or notifications. |
| S4-W14-009 | No leakage via shared surfaces | Check digests, notifications, the child switcher, and any "family" rollups for cross-parent data. | No B-data in A's digests/notifications/switcher (mirrors FR-MOD-X01 sibling-leakage analysis). |
| S4-W14-010 | Child is never the courier | Inspect all flows where information passes between parents: assert no flow requires the teen to relay, confirm, or carry messages/data between parents. | Zero child-as-courier paths in UI and API; teen-facing coaching is neutral and never asks the teen to transmit parent content. |

### 6.4 No-messaging verification
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W14-011 | No message-thread UI exists | Crawl the co-parenting surface; grep the codebase for thread/conversation/message models scoped to co-parenting. | No thread UI, no thread API routes, no thread tables for parent↔parent messaging. (Logistics fields like pickup notes are structured fields, not freeform threads — assert the distinction holds.) |
| S4-W14-012 | No messaging API to abuse | Attempt POST to any plausible message endpoint under the co-parenting scope. | 404 (not 403) — the endpoint must not exist, not merely be forbidden. |

**Blocked register:** S4-BLK-003 — full launch (beyond read-only/logistics-only) blocked on **family-law practitioner review** (R5). What IS testable now: S4-W14-001–012.

---

## 7. W12 — Babysitters · FR-MOD-W12, FR-ACCESS-011, MD decision D6
**Spec:** Directory only, labeled **"parent-vetted, not background-checked by Pookie"** — or real checks (FCRA counsel first). Time-boxed sitter access rides on FR-ACCESS-011 temporary grants.
**D6 (supersedes the flat "2/30d" text at BUILD-SPECIFICATION.md:50 — QA finding S4-BUG-001: spec line must be updated):** tiered frequency caps — **8 grants/grantee/30d** for recurring/trusted grantees; **2/30d** for first-time grantees; installment detection active for both tiers; **teen co-approval (13–15) required for NEW grantees only** — renewals within cap do NOT re-prompt. Rationale: the cap is anti-harassment, not anti-convenience.
**Implementation (real, in-repo):** migration `029_w12_babysitters.sql` implements D6 end-to-end — tables `babysitters` (`trust_tier`, `block_on_record`) and `sitter_grants` (`starts_at`/`expires_at` NOT NULL, `grantee_tier`, `teen_coapproval_status` ∈ not_required/required/approved/installment_review, `status` ∈ pending_approval/active/expired/revoked/flagged, `revoked_by`); RPCs `sitter_grant_cap(tier)` (trusted→8, first_time→2), `request_sitter_grant(...)` (SECURITY DEFINER — the D6 enforcement point), `record_sitter_grant_outcome(...)` (clean completion → `trust_tier='trusted'`; block → `block_on_record=true`, tier reset to `first_time`). **Correction to the original brief:** the grant integration test is NOT blocked on a missing migration 023 — 029 adds the timeboxed columns to `child_access` idempotently itself. Precondition for §7.2–7.4: **migrations 018 + 029 applied on the test DB** (verify with a schema check; S4-BLK-004 reframed accordingly). Note the stale comment in `018_access_authority.sql:43-44` ("added by 023") — 023 is `023_health_reconsent.sql` and adds no such columns (S4-BUG-005; Platform Team 1 cleanup already requested in BUILD-LOG 2026-10-12 Squad 4 PM entry).

### 7.1 Disclaimer presence (real render)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W12-001 | Disclaimer renders prominently | Load the babysitter directory surface on staging (real login, real render). | The exact string **"parent-vetted, not background-checked"** (or the spec'd equivalent) is visible **without scrolling** on the directory surface and on every sitter profile/detail view; not buried in a tooltip, footer, or expandable. |
| S4-W12-002 | Disclaimer survives entry points | Reach sitter profiles via search, deep link, and any "suggested sitter" surface. | Disclaimer present on every entry path; no path renders a sitter card implying Pookie vetting. |
| S4-W12-003 | No background-check claims | Grep UI copy + bundle for "background check", "vetted by Pookie", "verified sitter" outside the disclaimed context. | Zero claims of Pookie-performed checks unless a real FCRA-cleared integration ships (counsel first). |

### 7.2 Tiered caps — D6 (against the real `request_sitter_grant` RPC; precondition: 029 applied)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W12-004 | Trusted-tier cap: 9th grant blocked | Synthetic household; sitter S with `trust_tier='trusted'` (promoted via `record_sitter_grant_outcome` after a clean grant). Call the real `request_sitter_grant` RPC 8× within a rolling 30d window; attempt the 9th. | 9th call raises **`grant_cap_exceeded`**; first 8 return grant rows. **Gap (S4-BUG-004):** FR-ACCESS-011 says over-cap "converts to indefinite-grant flow with teen approval" — the RPC hard-rejects instead. Flagged for MD/product: confirm hard-reject is the intended D6 behavior or implement the convert path. |
| S4-W12-005 | First-time tier cap: 3rd grant blocked | New sitter H (`trust_tier='first_time'`). Two real grants in 30d; attempt the 3rd. | 3rd raises `grant_cap_exceeded`. |
| S4-W12-006 | Rolling 30d window + counted statuses | Seed grants with `created_at` at −31d, −29d, −1d (QA-controlled insert through the real RPC where allowed; age setup only via service_role), plus one `status='flagged'` grant in-window. Call `request_sitter_grant`. | −31d grant aged out of the count; −29d/−1d counted; **`flagged` grants are NOT counted** (RPC counts only active/expired/pending_approval) — assert this exact behavior and lock it in. |
| S4-W12-007 | Trusted = previously approved, no blocks (D6) | (a) New sitter → `trust_tier='first_time'`. (b) `record_sitter_grant_outcome(grant, false)` after clean completion → tier becomes `trusted`. (c) `record_sitter_grant_outcome(grant, true)` → `block_on_record=true`, tier reset to `first_time`. (d) Attempt `request_sitter_grant` for the blocked sitter. | (b) and (c) transitions verified in the DB; (d) raises **`sitter_blocked`**. Self-declaration impossible: `trust_tier` is set only by the RPC, and the direct-UPDATE path requires owner (assert no client path promotes without a completed grant). **Open MD question (from Squad 4 PM log):** 018's `grant_access()` defines trusted as "any prior grant history" — confirm it must also check block history before W12/W-access tests execute. |
| S4-W12-008 | Installment detection — chain of 3 flagged | Same sitter × child: grant 1 (2h, e.g. 18:00–20:00), grant 2 starts within 7 days of grant 1's `expires_at`, grant 3 starts within 7 days of grant 2's `expires_at` — all inside 30d. | Grant 3 returns `status='flagged'`, `teen_coapproval_status='installment_review'` (chain rule: prior `expires_at` within 7d before new `starts_at`, recursive ≤12 links, 30d window; chain+1 ≥ 3). |
| S4-W12-009 | Two back-to-back ≠ flagged (both tiers) | Two 2-hour grants back-to-back (18:00–20:00, 20:00–22:00) for a trusted sitter AND for a first-time sitter. | Neither flagged (chain of 2 < 3) — but **each counts against the tier cap** (verified via `v_count_30d`). Detection is active for both tiers per D6. **Semantic note (S4-BUG-006):** the implementation never merges installments into "one occasion" — it flags at chain ≥ 3. The task brief allowed either semantic; MD/product to confirm the implemented flag-only semantic is acceptable. |
| S4-W12-010 | Installment detection not trivially evadable | Variants: 2h + 2h15m durations; 30-min gap between grants; 8-day gap (outside the 7d chain window). | Chaining triggers on temporal adjacency (≤7d) + same sitter × child, not exact-duration equality; the 8-day-gap grant starts a NEW chain (assert via `teen_coapproval_status`). Document observed thresholds. |

### 7.3 Smart co-approval — D6 (teen 13–15; real RPC behavior)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W12-011 | New grantee → teen co-approval required | Parent calls `request_sitter_grant` for a NEW sitter (`trust_tier='first_time'`) on a 13–15 teen's `child_id` (real `children.date_of_birth`). | Grant row returns `status='pending_approval'`, `teen_coapproval_status='required'` — NOT active. The grant confers zero access before approval (assert: no sitter-scoped capability is usable while pending). Repeat with teen `date_of_birth` NULL → also `required` (fail-closed, per RPC). Teen 16+ or under-13 → `not_required` (assert the age bands exactly). |
| S4-W12-012 | Renewal within cap → NO re-prompt | `request_sitter_grant` for a `trusted` sitter within the 8/30d cap on a 13–15 teen. Instrument: `teen_coapproval_status` on the returned row + notification outbox. | Row returns `teen_coapproval_status='not_required'`, `status='active'`; **zero teen prompts**; audit shows no phantom approval rows. |
| S4-W12-013 | Renewal above cap → hard reject (not convert) | 9th grant for the trusted sitter (S4-W12-004 setup). | Raises `grant_cap_exceeded` — same S4-BUG-004 gap: no convert-to-indefinite-with-teen-approval path exists. |
| S4-W12-014 | Teen revoke is instant | Teen one-tap revoke of an active grant (13+ per FR-ACCESS-011). Mechanism under test: `status`→`'revoked'`, `revoked_by='teen'`. **Implementation checkpoint:** `sitter_grants` RLS UPDATE policy requires parent role — the teen revoke MUST exist as a SECURITY DEFINER RPC or route; if it doesn't, file as defect (missing FR-ACCESS-011 "instant" revoke), not as blocked. | Revoke effective immediately (sitter-scoped access denied on the next check); parent notified; revocation audited with `revoked_by='teen'`. |

### 7.4 Grant lifecycle (real paths; precondition: 029 applied)
| ID | Test | Method (real data, real infra) | Pass criteria |
|---|---|---|---|
| S4-W12-015 | Occasion-based grant UX + scope allowlist | "Share for a bit" flow: who → scope picker ("Sitter basics" preset) → occasion preset with computed end time; call `request_sitter_grant` with default scope and with a forbidden scope (`["wellness"]`, `["reflection"]`). | Default scope `["schedule","pickup","emergency_medical"]` accepted; any scope outside the allowlist raises **`scope_not_allowed`** at the RPC layer. `starts_at`/`expires_at` NOT NULL enforced (`CHECK (expires_at > starts_at)`). |
| S4-W12-016 | Manual revoke path (parent) | Parent UPDATEs a grant row: `status='revoked'`, `revoked_by='parent'` (allowed by `sitter_grants_parent_update`); verify propagation. | Revoke succeeds via the real path; the revoked grant confers no access; **no DELETE grant exists on `sitter_grants`** — hard-delete attempts fail (revocation is a status, not a deletion). Blocks/revokes/safe-exit propagation to sitter grants re-verified here. |
| S4-W12-017 | Expiry sweeper | Grants past `expires_at`: run the idempotent 5-min sweeper (FR-ACCESS-011: `revoked_by='system'`, reason `expiry`). **Implementation checkpoint:** no sweeper function was found in 029 — verify it exists as a cron/Edge Function; if missing, file as defect (missing FR-ACCESS-011 component), not as blocked. | Expired grants revoked with `revoked_by='system'`; re-run is a no-op (idempotent); single-fire expiry notices. |
| S4-W12-018 | Expiry slope notifications | Grant expiring in 25h, 2h, 20m (seeded rows via the real RPC). | T-24h parent nudge, T-1h/T-15m sitter wrap-up, "All done" screen with [Request more time] + [Text parent]; notices carry zero attribution and no re-request CTA. (Route/cron concern — assert against the real notification outbox, not mocks.) |

**Blocked register:** S4-BLK-004 (reframed) — W12 grant tests (S4-W12-004–018) require **migrations 018 + 029 applied on the test DB** (schema precondition, verified by a pre-run schema check — not a missing-migration block). Runnable without the DB: S4-W12-001–003 (disclaimer render). S4-BUG-004/005/006 are spec/implementation questions for MD/product, not test blockers.

---

## 8. Cross-module security tests (all 7 modules)

### 8.1 RLS bypass attempts
| ID | Test | Pass criteria |
|---|---|---|
| S4-SEC-001 | Anon-key sweep: GET every Squad 4 table (`mail_items`, `mail_action_items`, `mail_dispute_drafts`, `shopping_lists`, `shopping_items`, `shopping_price_reports`, `vault_documents`, `transactions`, `spending_accounts`, `plaid_items`, `credit_freezes`, `coparenting_log`, `babysitters`, `sitter_grants`) with the anon key, no JWT. | Zero rows on all user-data tables (registry/config tables like `mail_ocr_providers` are intentionally public — assert each exception is deliberate and documented). |
| S4-SEC-002 | Wrong-household JWT sweep: B-parent JWT against A's rows on every table. | Zero rows everywhere; no error messages leaking row existence (no "row exists but forbidden" oracle — 0 rows, not 403-with-hint). |
| S4-SEC-003 | Role-confusion: child JWT on parent-scoped tables (mail, vault, freeze, spending aggregates of others); parent JWT on teen-private line items (S4-W11-001). | Zero rows in all cases. |
| S4-SEC-004 | Post-revocation access: revoke a grant / remove a household member; immediately replay their JWT against previously-visible rows. | Zero rows; no stale-cache serving (fresh PostgREST request, not a cached page). |
| S4-SEC-005 | IDOR: increment/swap UUIDs in route params (`/items/<other-household-item-id>`, `/mail_items/<id>`). | 404/zero rows — never another household's data. |
| S4-SEC-006 | Storage bypass: direct bucket object URLs for `mail-photos` and vault documents with B-parent and anon credentials. | Denied; no predictable public URLs. |

### 8.2 XSS — every user-input field, real render
Target fields: mail notes, sitter notes, log entries (W14), shopping item names/notes, vault document names/notes, spending manual-entry merchant/notes.
| ID | Test | Pass criteria |
|---|---|---|
| S4-SEC-007 | Stored XSS battery: submit `<script>alert(1)</script>`, `<img src=x onerror=...>`, `javascript:` URLs, SVG payloads, and Unicode-obfuscated variants through every write route; render the containing pages. | Payloads stored safely and rendered inert (escaped or sanitized) — **no script execution** in the real browser render; no `javascript:` navigation. |
| S4-SEC-008 | Reflected XSS: payload in query params / search boxes (spending search, sitter search). | Reflected output encoded; no execution. |
| S4-SEC-009 | Markdown/rich-text paths (if any): payload through any rich rendering. | Sanitized per an allowlist; `on*` handlers stripped. |

### 8.3 Secrets in bundle/repo
| ID | Test | Pass criteria |
|---|---|---|
| S4-SEC-010 | Bundle grep: after `next build`, grep `out/` for `sk-`, `AKIA`, `AIza`, `ghp_`, `xoxb-`, `BEGIN .*PRIVATE KEY`, `service_role`, Plaid secrets, Cloudflare tokens. | **Zero hits.** (NFR-SEC-002, CI-verified.) |
| S4-SEC-011 | Repo grep: same patterns across the repo (excluding `docs/` decision records that name secret *types*, and `.env.example` placeholders). | Zero real secrets; `.env*` files gitignored and absent from the tree. |
| S4-SEC-012 | Client-exposed env audit: list all `NEXT_PUBLIC_*` vars; justify each. | No `NEXT_PUBLIC_` var carries a secret or a privileged key (anon key is public by design — documented as such). |

### 8.4 Pen-test style (per standing directive, scoped to Squad 4)
| ID | Test | Pass criteria |
|---|---|---|
| S4-SEC-013 | Auth-bypass on tables AND storage (NFR-SEC-001): policy-off simulation review — read every Squad 4 policy definition; attempt the exact bypass each policy claims to prevent. | Each policy's threat is demonstrated blocked; findings filed as P0 defects. |
| S4-SEC-014 | Scope-leakage: teen-private and parent-scoped data probed via aggregates, search, exports, digests, notifications (ties to S4-W11-004/006/007, S4-W14-009). | No side-channel disclosure in any surface. |
| S4-SEC-015 | Fuzz: malformed payloads (negative quantities, 10MB notes, null bytes, type-confused JSON) against shopping/mail/vault/spending write routes. | 4xx with safe errors; no 500 leaking stack traces; no partial writes (atomicity holds). |

---

## 9. Non-functional tests (per Mehedi's protocol, Squad 4 scope)

| ID | Area | Test | Pass criteria |
|---|---|---|---|
| S4-NF-001 | Performance | List/detail page load for the heaviest module (mail with 200 items, spending with 1,000 transactions): measure TTFB + full render on staging. | p95 < 3s on broadband; fetch waterfall shows no N+1 (single list query + single detail query). |
| S4-NF-002 | Load | 50 concurrent household members hitting shopping list + mail list (synthetic users, staging). | No 5xx; p95 latency degrades <2×; RLS overhead measured and documented. |
| S4-NF-003 | Usability / data-shape robustness | Long item names (200 chars), long merchant names, missing optional fields, 0-item/empty states, RTL text in notes. | Layouts hold (no overflow/clipping); empty states render guidance, not blank screens. |
| S4-NF-004 | Cross-browser/device | iOS Safari + Chrome + desktop widths on shopping board, mail intake, spending charts. | No layout breakage; touch targets ≥44px; charts legible at 360px width. |
| S4-NF-005 | Accessibility | Keyboard-only run of each module's core flow; screen-reader labels on inputs; contrast check on neon-on-dark elements (design system); `prefers-reduced-motion` honored. | All flows completable by keyboard; contrast ≥4.5:1 for text; motion disabled under reduced-motion. |
| S4-NF-006 | Housekeeping | Per touched file: no dead code, no commented-out blocks, no unused imports, no `console.log`. | Clean per Mehedi's standing rule; verified in the PR that lands each module. |

---

## 10. Blocked-items register (living)

| ID | Blocked tests | Dependency | Owner to unblock | Testable now |
|---|---|---|---|---|
| S4-BLK-001 | S4-W24-007 (coaching partner) | Licensed credit-hygiene partner integration | Managing Director / counsel | S4-W24-001–006, 008 |
| S4-BLK-002 | W24 user launch | **FCRA counsel sign-off** (NFR-COMPLIANCE-002) | Licensed counsel | Pending-review state + freeze data model (S4-W24-001–007) |
| S4-BLK-003 | W14 full launch | **Family-law practitioner review** (R5) | Family-law practitioner | Pending-review state + immutable-log/parallel-surface/no-messaging tests (S4-W14-001–012) |
| S4-BLK-004 | S4-W12-004–018 | **Schema precondition:** migrations 018 + 029 applied on the test DB (verified by pre-run schema check). The timeboxed columns ship in 029 itself (idempotent `ADD COLUMN IF NOT EXISTS`), not in 023. | Squad 4 build / DevOps (apply migrations) | S4-W12-001–003 (disclaimer render, no DB grant logic needed) |
| S4-BLK-005 | S4-W11-012/013 (if sandbox unreachable) | Plaid sandbox availability | Plaid / platform | Full local-flow E2E (S4-W11-008–011) |

**Rule:** a blocked test is never marked PASS. When a dependency clears, the blocked tests run before the module is declared done.

---

## 11. Execution log (runnable now)

- [x] `npx tsc --noEmit` on `staging-build` — result recorded below (QA run 2026-10-12).
- [x] Existing shopping route smoke test — result recorded below.
- [ ] Full E2E runs against implementation — pending module delivery; plans above are written to execute as-is.

### QA run 2026-10-12 — typecheck
`npx tsc --noEmit` on `staging-build`: **CLEAN, exit 0** — zero type errors.

### QA run 2026-10-12 — existing smoke test
`python3 smoke-test-staging.py` (default base `https://pookie-staging.pages.dev`, read-only GETs, no deploy):
**PASSED — 5/5 checks green** (`/` → 307, `/login` → 200, `/auth/callback` → 307,
`/c/dawson` exists, `/select-child` exists).
**Gap filed as S4-BUG-003:** the script covers no shopping routes — S4-W20-010
specifies the shopping route smoke coverage to add.

### QA run 2026-10-12 — shopping service logic (real shipped code, tsx)
Scratch harness `/tmp/qa-shopping-logic.ts` (not committed) imported the real
`normalizeName` + `assertTransitionAllowed` from `src/server/services/shopping.ts`
and asserted all 16 state-machine pairs + dedupe normalization:
**19/19 PASS** — 6 legal transitions allowed, 10 illegal transitions throw,
dedupe normalization correct. Supporting evidence for S4-W20-002; the route-layer
E2E runs when the full E2E suite executes.

---

## 12. QA findings (spec/code drift caught while writing these plans)

| ID | Finding | Severity | Action |
|---|---|---|---|
| S4-BUG-001 | **Spec drift:** `docs/BUILD-SPECIFICATION.md:50` (FR-ACCESS-011) still states the flat "max 2 temporary grants per grantee per rolling 30 days". MD decision D6 (2026-10-12) supersedes it with tiered caps (8/30d trusted, 2/30d first-time, teen co-approval for new grantees only). | Medium | Spec owner to update FR-ACCESS-011 to D6 before W12 cap tests execute; tests in §7 assert D6 as the authority. |
| S4-BUG-002 | **Superseded — corrected during plan writing:** the original brief said W12 grant tests were blocked on a missing migration 023. Verification showed `029_w12_babysitters.sql` exists and implements the full D6 grant engine (tables, `request_sitter_grant`, `sitter_grant_cap`, `record_sitter_grant_outcome`), adding the timeboxed columns idempotently itself. Reframed as S4-BLK-004 (schema-applied precondition). Lesson: verify migration state before declaring blocks. | Low | None — corrected in-plan. |
| S4-BUG-003 | **Missing coverage:** repo has no shopping route smoke test; `smoke-test-staging.py` checks only `/`, `/login`, `/auth/callback`, `/c/dawson`, `/select-child`. W20 is the one live Squad 4 module and has no route-level regression net. | Medium | Add shopping route checks (per S4-W20-010) to `smoke-test-staging.py` or a sibling script; QA owns the test list. |
| S4-BUG-004 | **Spec vs implementation:** FR-ACCESS-011 says over-cap grants "convert to indefinite-grant flow with teen approval". `request_sitter_grant` (029) raises `grant_cap_exceeded` (hard reject) instead — no convert path exists. | Medium | MD/product to confirm: is hard-reject the intended D6 behavior? If yes, update FR-ACCESS-011; if no, build the convert flow. Tests S4-W12-004/013 assert the current behavior and will flip when decided. |
| S4-BUG-005 | **Stale comment:** `018_access_authority.sql:43-44` says the timeboxed columns are "added by 023" — 023 is `023_health_reconsent.sql` and adds no such columns; 029 adds them idempotently. (Already flagged to Platform Team 1 in the Squad 4 PM BUILD-LOG entry.) | Low | Platform Team 1: fix the stale comment; confirm no migration-ordering hazard between 018's `grant_access()` and 029's columns. |
| S4-BUG-006 | **Semantic question:** the task brief allowed installment detection to "count as one occasion OR flag". 029 implements flag-only: chain ≥ 3 within 7d-chaining/30d window → `status='flagged'`, `teen_coapproval_status='installment_review'`; it never merges installments into one cap occasion. | Low | MD/product to confirm the flag-only semantic is acceptable (S4-W12-008/009 lock in the implemented behavior). |

---

*End of Squad 4 test plans v1.0. Plans execute against implementation when it lands; blocked items carry their named dependencies. No test passes against mock data.*
