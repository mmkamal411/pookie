# AI Training Prohibition — Verification Document ("Never Train" Commitment)

**Track:** Fractional Team 1 — Compliance (Security Engineer input)
**Branch:** `staging-build` · **Date:** 2026-10-12
**Requirement sources:** NFR-PRIVACY-008, NFR-PRIVACY-010 (Round 2 Proposal 4);
`docs/solutions/sol-legal.md` §1c (vendor assurances); **MD decision D2** — AI training
→ absolute "NEVER" (publish only after DPA verification); **MD decision D7** —
location coarse-only.

> **Scope note (engineering, not legal):** This document traces where user content flows
> and renders a per-path verdict. Whether any vendor term is *legally sufficient* is
> counsel's call (sign-off gates in `sol-legal.md` §1c/§15).

**Commitment under verification:** Pookie will *never* train on user data. Broad
"train" definition per NFR-PRIVACY-010: training, fine-tuning, RLHF, eval datasets,
embedding stores. **No opt-out toggle** (nothing to opt out of). Separate default-OFF
opt-in for aggregated de-identified *product analytics*, clearly distinguished from
chat content. Disclosed safety-review carve-out (human review of crisis conversations,
never used for training). State-law posture documented (WA MHMDA, TX SCOPE,
CA AB 2246 defaults-off/no-dark-patterns, CA SB 1119, IL BIPA). Annual internal
attestation; if any vendor term changes to permit training, the commitment is pulled
BEFORE the change takes effect.

---

## 1. Data-flow map: every path user content takes

### Path A — Tutor chat via tenant-scoped server proxy (primary, in repo)
1. Client → `POST /api/v1/tutor/chat` (`src/app/api/v1/tutor/chat/route.ts`).
   - zod schema: `childId` (uuid), `messages[]` (1–50, ≤8000 chars each).
   - `assertTenant(childId)` — membership-checked server-side; prompts are
     parameterized from the `children` row, never trusted from client text.
   - Proxy uses **server-side** `process.env.POOKIE_TUTOR_URL` (not the
     `NEXT_PUBLIC_` var) — worker URL stays out of the client bundle. ✅
2. App server → `POST {POOKIE_TUTOR_URL}/chat` with `{ child_id, messages }`,
   `x-request-id` header.
3. Worker (`~/workspace/d-dash-app/workers/pookie-tutor/src/index.ts`, `/chat`):
   - Builds system prompt embedding **student name, grades, due-next list**
     (`systemPrompt()`), up to 20 messages, model
     `@cf/meta/llama-3.3-70b-instruct-fp8-fast`.
   - Calls `env.AI.run(...)` = **Cloudflare Workers AI**.
   - No `console.log` of prompts/responses anywhere in the worker. ✅
   - Quiz path (`/quiz`): on parse failure returns a ≤300-char model-output slice in
     the *transient* error response — never persisted. ✅ transient only.
4. `/api/v1/tutor/chat` calls `auditEvent(childId, 'tutor_chat')` — **action only, no
   prompt/completion text** in the audit row. ✅
5. **Persistence of content:** the MUSE-queue endpoints (`/muse-queue*`) store full
   `message`, `llamaResponse`, `context`, and `history` in **Cloudflare KV with
   `expirationTtl: 86400` (24 hours)**. This is transient processing storage, not a
   transcript archive — but it IS a 24-hour retention of user content on Cloudflare
   infrastructure and must be covered by the DPA. Regular `/chat` calls are **not**
   KV-persisted (in-memory only). ✅ transient-by-design; the KV queue is the one
   bounded exception.
- **Verdict:** 🟡 **NEEDS CONTRACT** — code path is clean (no logging, no transcript
  store); the 24h KV retention and the inference itself are governed by Cloudflare's
  terms, which must be verified per the DPA checklist in §4.

### Path B — Direct client → worker tutor calls (legacy path, in repo)
- `src/lib/pookie-tutor.ts` (`askTutor`, `classifyNeedsDepth`, muse-queue helpers)
  calls `${POOKIE_TUTOR_URL}/chat` **directly from the browser** when
  `NEXT_PUBLIC_POOKIE_TUTOR_URL` is set, sending up to 20 history messages + full
  `context` (student name, grades, due-next).
- Same worker, same model, same vendor — the *vendor* verdict is identical to Path A.
- **Security note (not training, but flagged):** this path bypasses the tenant-scoped
  proxy (Path A); CORS is restricted to `dawsonkamal.com` +
  `*.d-dash-staging.pages.dev` in the worker. Path A is the spec's secure pipe; Path B
  should be a conscious decision, not drift.
- **Verdict:** 🟡 **NEEDS CONTRACT** (same vendor row as Path A).

### Path C — Support AI chat (S2)
- **Not built.** `src/lib/modules.ts` lists S2 "AI Support Chat" as `seedling`, no
  route. When built, it must route through the same verified vendor path and inherit
  this document's DPA row — **do not add a second AI vendor for S2 without re-running
  §4.**
- **Verdict:** ⬜ NOT APPLICABLE YET — gated on §4 coverage before launch.

### Path D — Debug / error logs
- Worker: error responses contain `err.message.slice(0, 300)` — transient, not stored.
  No prompt/completion logging in worker code. ✅
- App: `handleRoute` (`src/server/rest.ts`) logs `err` on `INTERNAL` only — never the
  request body. ✅ (Guard: never log `await req.json()` on error paths in future.)
- `audit_log.detail` has a **DB trigger** (`audit_log_detail_secret_guard`, migration
  004) rejecting secret-shaped top-level keys — defense-in-depth against credential
  leakage into logs. ✅ VERIFIED.
- Cloudflare-side logs (Workers logs, AI Gateway logs if enabled): retention and
  content are vendor-controlled.
- **Requirement:** debug/error logs TTL **≤30 days**, access-controlled, contractually
  excluded from model improvement.
- **Verdict:** 🟡 **NEEDS CONTRACT** — app/worker code is clean; vendor log retention
  must be pinned in the DPA (Cloudflare's default log retention is not itself a
  contractual training exclusion).

### Path E — Analytics
- Grep of `src/` finds **no analytics SDK** (no PostHog/Segment/Amplitude/Mixpanel).
  Conversation content is not sent to any analytics endpoint. ✅
- Requirement: any future analytics is aggregated-only, default-OFF opt-in, and must
  never carry chat content.
- **Verdict:** ✅ **VERIFIED CLEAN** (as of this repo state; re-verify per release).

### Path F — OCR / document AI (W21 mail intake, W7 vault)
- `src/server/ocr/providers.ts` + `src/server/ocr/pipeline.ts`: v1 ships a **stub
  provider** (`StubOcrProvider`, confidence 0, no reading). The seeded registry row
  `workers-ai-vision` is not wired to any external vendor; external providers require
  per-document consent (`isExternal` flag).
- **Verdict:** ✅ **VERIFIED CLEAN** (v1; no external vendor). Any external OCR vendor
  fires the §4 vendor row before it touches a document.

### Path G — Embeddings / moderation classifiers / eval datasets
- None found in the repo. No embedding store, no moderation classifier, no eval
  dataset pipeline exists on this branch.
- **Verdict:** ⬜ NOT APPLICABLE — re-run this audit if any is introduced (the broad
  "train" definition explicitly covers embeddings and eval datasets).

### Path H — Subprocessors beyond the app (infra layer)
- **Supabase** (Postgres, Auth, Storage): holds chat-adjacent metadata only
  (`audit_log` rows with action names, no prompt text). Subject to the vendor row in §4.
- **Cloudflare Pages** (app hosting): serves the bundle; no user content processing
  beyond request/response transit + edge logs.
- **Cloudflare Workers + KV** (pookie-tutor): processes prompts; KV holds MUSE-queue
  content 24h (Path A §5). Same vendor row.

---

## 2. What Cloudflare's published terms say today (2026-10-12, public docs)

From Cloudflare's "Your Data and Workers AI" page
(`developers.cloudflare.com/workers-ai/platform/data-usage/`, retrieved 2026-10-12):
- Inputs, outputs, and embeddings are **Customer Content**; the customer owns them.
- Cloudflare **does not use Customer Content to (1) train any AI models made available
  on Workers AI or (2) improve any Cloudflare or third-party services**, and would not
  do so without explicit consent.
- Cloudflare **neither creates nor trains** the models; the models are Third-Party
  Services (Meta's Llama license terms apply between customer and model provider).
- Customer Content **may be stored** if a storage service (KV, R2, DO, Vectorize) is
  used in conjunction with Workers AI — which is exactly our MUSE-queue KV usage.

**Gaps the public docs do not close** (third-party tracker PrivacyWatch, 2026-09-30:
"Training off, but live docs no longer document ZDR or an inference retention
period"):
- No published **zero-data-retention (ZDR)** commitment for Workers AI inference.
- No documented **inference retention period** for prompts that are *not* routed to a
  storage binding.
- These are *contractual* gaps, not code gaps — they are what §4's DPA row exists to
  close. Public docs are not a DPA.

---

## 3. Per-vendor verdicts (current)

| Path | Vendor surface | Verdict |
|------|---------------|---------|
| A — tutor via proxy | Cloudflare Workers AI (inference) + Workers KV (24h queue) | 🟡 NEEDS CONTRACT |
| B — tutor direct from client | Same as A | 🟡 NEEDS CONTRACT |
| C — S2 support chat | Not built | ⬜ N/A — gated on §4 |
| D — debug/error logs | App/worker code + Cloudflare logs | ✅ code clean / 🟡 NEEDS CONTRACT (vendor log retention) |
| E — analytics | None | ✅ VERIFIED CLEAN |
| F — OCR | Stub only | ✅ VERIFIED CLEAN (v1) |
| G — embeddings/moderation/eval | None | ⬜ N/A |
| H — Supabase / Pages | Infra | 🟡 NEEDS CONTRACT (standard DPA row) |

---

## 4. Per-vendor DPA verification checklist (D2 — publish only after this is green)

One row per vendor that touches user content. For each clause mark:
**PRESENT** (in the executed agreement) · **MISSING** · **NEEDS COUNSEL REVIEW**
(whether the language is sufficient is counsel's judgment, per `sol-legal.md` §1c).

### 4a. Cloudflare (Workers AI inference + Workers KV + Pages + edge logs)
Required clauses:
- [ ] **Zero-retention-for-training** — Cloudflare shall not use Customer Content
      (prompts, completions, embeddings, queue payloads) to train, fine-tune, or
      RLHF any model. Status: ⬜ MISSING (public docs state it; the *executed DPA*
      must state it — docs are not the agreement).
- [ ] **No secondary use** — no use of Customer Content for product improvement,
      analytics, or any purpose beyond providing the service. Status: ⬜ MISSING.
- [ ] **Flow-down to subprocessors** — Cloudflare's subprocessors (including any
      GPU/inference infrastructure provider) bound by the same restrictions.
      Status: ⬜ MISSING.
- [ ] **Audit / certification rights** — right to evidence of compliance (SOC 2,
      deletion/retention attestations). Status: ⬜ MISSING.
- [ ] **30-day advance notice** before any new AI subprocessor touches chat data
      (NFR-PRIVACY-010). Status: ⬜ MISSING.
- [ ] **Retention pinning** — inference-path retention period and KV/log retention
      ≤30 days; contractual exclusion of retained data from model improvement.
      Status: ⬜ MISSING.
- [ ] **Data regions** — documented processing regions. Status: ⬜ MISSING.
- [ ] **Deletion on request** — purge path for the 24h KV queue content on teen
      deletion request (crypto-shred or immediate delete; TTL expiry is not a
      deletion SLA). Status: ⬜ MISSING.

### 4b. Meta (Llama 3.3 70B model provider)
**Which DPA governs depends on the serving path — document both:**
- **Path in use (Cloudflare-hosted):** the model runs inside Cloudflare Workers AI;
  no prompt/completion data is sent to Meta. The governing agreement is the
  **Cloudflare DPA (§4a)**. Meta's role is model licensor (Llama Community License);
  confirm the license imposes no data-feedback obligation on API/hosted use.
  - [ ] License review: no input-data grant-back to Meta. Status: ⬜ NEEDS COUNSEL REVIEW.
- **Hypothetical direct-Meta path** (e.g., future direct Llama API use): would be
  governed by Meta's API/platform terms — would need its own §4-style row
  (zero-retention-for-training, no-secondary-use, flow-down, audit rights,
  30-day notice). **Do not add a direct Meta API path without completing this row.**
  - [ ] Row completed: ⬜ N/A unless the path is built.

### 4c. Any other AI/ML vendor in the chain
- Embeddings provider: ⬜ none — re-run if added.
- Moderation classifier: ⬜ none — re-run if added.
- External OCR vendor (W21/W7): ⬜ none (stub only) — the `isExternal` consent flag
  in `src/server/ocr/providers.ts` must gate a completed §4-style row before any
  external provider is activated.
- AI Gateway / observability on the inference path: ⬜ none configured — if AI
  Gateway logging is ever enabled, its log retention becomes a §4a line item.

### 4d. Supabase (database/auth/storage — holds metadata, not prompts)
- Standard DPA row per `sol-legal.md` §1c (no sale, no advertising use, no training
  on inputs, deletion on request, breach-notification SLA, SOC 2 or equivalent,
  audit rights). Status: ⬜ NEEDS COUNSEL REVIEW (executed agreement not verified
  in this audit).

---

## 5. Publish gate — HARD RULE (D2)

> **The "never train" promise MUST NOT appear in the FAQ, Privacy Policy, ToS, or any
> marketing until every vendor row in §4 reads PRESENT or NEEDS COUNSEL REVIEW is
> cleared by counsel. Publishing early is deceptive-trade-practice risk (FTC).**
>
> Concretely: §4a (Cloudflare) must be fully PRESENT, §4b license review cleared, §4d
> (Supabase) executed — and counsel must sign the "no-training-on-inputs" vendor
> assurance per `sol-legal.md` §1c sign-off gate — before any user-facing "never
> train" language ships. The annual internal attestation (NFR-PRIVACY-010) re-verifies
> these rows; if any vendor term changes to permit training, the commitment is pulled
> BEFORE the change takes effect.

**Pre-publish checklist:**
- [ ] §4a: all Cloudflare clauses PRESENT in the executed DPA.
- [ ] §4b: Llama license review cleared by counsel (no data grant-back).
- [ ] §4d: Supabase DPA executed with no-training-on-inputs term.
- [ ] Teen-saved records (if any "study history" feature ships) are labeled as user
      records, never training data; no persistent prompt/response store otherwise.
- [ ] Debug-log TTL ≤30 days verified in vendor settings + code.
- [ ] Counsel sign-off recorded (`sol-legal.md` §1c gate).

---

## 6. Location data — D7 coarse-only audit (part of the data-flow audit)

**MD decision D7:** location is **coarse only by architecture** — city/ZIP max, never
precise GPS. This shrinks the break-glass disclosure scope (location = coarse +
W19 medical card only).

**Code audit (this branch):**
- [x] Grep of `src/` for `navigator.geolocation`, `getCurrentPosition`,
      `watchPosition`, `enableHighAccuracy`, `coords.latitude` — **zero hits.** ✅
- [x] Grep of `src/server/` for `lat`/`lng`/`latitude`/`longitude` — **zero hits**
      (matches are false positives: `relation`, `platform`, `latestGrade`). ✅
- [x] No `location pings` table or history column in any migration; the retention
      schedule's "location pings" row (sol-legal §6) has nothing to schedule yet. ✅
- [ ] W29 "Trails & Parks" seed action "Set your home location" (`src/lib/modules.ts`)
      has no code path yet — when built, it must accept **city/ZIP text only**.
- [ ] W19 Emergency vault / medical card (seedling) — must store address as text
      (user-entered), never coordinates.

**Architectural requirement (for the build teams):** no schema field may hold
coordinates — location fields are `city`/`zip` text only; any API accepting
coordinates is rejected in review. No mobile GPS permission may be requested.
**Verdict:** ✅ **VERIFIED CLEAN** — no precise-location path exists; D7 holds by
absence. Re-run this grep per release.

---

## 7. Annual attestation + change monitoring

- Annual internal attestation that every §4 row is still PRESENT (NFR-PRIVACY-010).
- Change-of-terms detection on Cloudflare and Supabase agreements; any term change
  permitting training triggers immediate pull of the "never train" promise *before*
  the change takes effect.
- This document re-runs on: any new AI vendor, any new inference path (e.g., direct
  Meta API), S2 launch, external OCR activation, or any change to KV/log retention.
