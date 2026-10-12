# Vendor Assessment Template

**Status:** ISSUE-SPOTTING DRAFT · 2026-10-12 · Compliance reviewer (Fractional Team 1)
**Gates:** NFR-PRIVACY-001 (G6) · NFR-LEGAL-007/009. Binds to `docs/solutions/sol-legal.md` §1c.
**Rule:** no vendor touching child, health, education, or credential data goes live
without a completed assessment. Re-assess **annually**; continuous monitoring for
change-of-terms.

> **NOT LEGAL ADVICE.** Issue-spotting scaffold for licensed counsel. Nothing ships without
> attorney drafting/review. Contract terms are the compliance artifact — counsel reviews each
> executed agreement.

## 1. How to use this template

1. Copy §2 for each vendor. One assessment per vendor.
2. Fill every field. Unknown = gap (recorded in §4 with owner + date).
3. Risk rating: **approve** / **approve-with-conditions** / **reject**.
   Conditions are recorded with owners and dates — not left as verbal promises.
4. Re-assessment date is set at approval; the Compliance Owner tracks the calendar.
5. Offboarding plan is filled **before** go-live, not at termination.

## 2. Assessment template (copy per vendor)

| Field | Content |
|---|---|
| Vendor name | |
| Data processed | (classes: identity, child profiles, health H0–H3, education records, credentials, financial metadata, location-coarse, audit metadata) |
| Data flow diagram (text) | App → Vendor (regions) → subprocessors; return path for reads; where encryption boundaries sit |
| DPA / data-processing terms signed? | Y/N + date + version; must include: no sale of data, no advertising use, **no training models on Pookie inputs** (broad "train" definition: training, fine-tuning, RLHF, eval datasets, embedding stores — NFR-PRIVACY-010), deletion on request, breach-notification SLA, audit/certification rights |
| Retention terms | Vendor-side retention windows; alignment with `COPPA-RETENTION-SCHEDULE.md` (backup purge ≤30 days) |
| Subprocessor list + change notice | Named subprocessors; **change-notice SLA (minimum 30 days advance notice before any new subprocessor — especially AI — touches data**, NFR-PRIVACY-010) |
| Security certs | SOC 2 Type II or equivalent; pen-test summaries; vuln-disclosure channel |
| Breach notification SLA | Contracted notification window (propose ≤72 hours to Pookie; attorney confirms) |
| Deletion on termination | Data return/destruction commitment; certification of deletion; timeline |
| State-law posture | **MHMDA-applicable? TX SCOPE? CA AB 2246 / SB 1119? IL BIPA?** — does the vendor's processing create exposure under each (starting inventory for NFR-LEGAL-009 multi-state review) |
| Evidence collected | Contracts, certs, completed questionnaire, pen-test summaries — dated |
| Risk rating & decision | approve / approve-with-conditions / reject; conditions + owners + dates |
| Re-assessment date | |
| Offboarding plan | Data return/destruction steps; certification; timeline |

## 3. Pre-filled vendor rows (baseline inventory)

### 3.1 Supabase
| Field | Content |
|---|---|
| Vendor name | Supabase (project **pookie**, ref `fspvcuaupkdsekpwmnep`, Pookie org; account `mehedikamal@gmail.com` via GitHub sign-in) |
| Data processed | **All app data**: auth identities, profiles, child profiles (incl. under-13 parent-managed), grades/attendance, health syncs (H1–H3), credentials vault (field-level encrypted), check-ins/mood, AI-chat saved records, school mail copies, support tickets, `access_events`, link codes |
| Data flow diagram (text) | Next.js app (Cloudflare Pages) → Supabase PostgREST/Auth/Storage (AWS region — **confirm region**) → backups (PITR). RLS enforces the access matrix; `service_role` key in Secure Vault for direct DB inspection (restricted to Compliance Owner + on-call eng) |
| DPA signed? | **NO — GAP.** Execute Supabase DPA before production. (D2: "NEVER train" commitment cannot be published until vendor terms verified.) |
| Retention terms | Supabase backup/PITR window must align to ≤30-day source-deletion purge — **unconfirmed, GAP** |
| Subprocessor list + change notice | AWS (inherited); full subprocessor list **unconfirmed — GAP** |
| Security certs | Vendor claims SOC 2 Type II — **evidence not yet collected — GAP** |
| Breach notification SLA | **None agreed — GAP** (propose ≤72h; attorney confirms) |
| Deletion on termination | **Not agreed — GAP** |
| State-law posture | MHMDA-applicable: **yes** (health data at rest — processor posture; Pookie is the regulated entity). TX SCOPE: tbd. CA AB 2246/SB 1119: tbd at health-module scale. IL BIPA: n/a unless biometrics stored (**never store biometric templates — note**) |
| Risk rating | **approve-with-conditions** — conditions: DPA executed; retention alignment confirmed; SOC 2 evidence collected; breach SLA agreed; deletion-on-termination agreed. Owner: Compliance Owner. Target: before production |
| Evidence collected | None yet — **GAP** |

### 3.2 Cloudflare (Pages + Workers)
| Field | Content |
|---|---|
| Vendor name | Cloudflare — Pages (staging `d-dash-staging`, production `pages.dev`) + Workers (incl. **pookie-tutor** at `pookie-tutor.mehedikamal.workers.dev`; Workers AI) |
| Data processed | Static assets; edge request logs (IPs — minimization review needed); **pookie-tutor: AI chat prompts/responses** (transient); Workers AI: Llama 3.3 70B inference |
| Data flow diagram (text) | Browser → Cloudflare edge (Pages) → Workers (tutor) → Workers AI inference → response. Prompt/response **transient-only** per NFR-PRIVACY-010; no persistent prompt/response store. Debug logs ≤30-day TTL, access-controlled |
| DPA signed? | **NO — GAP.** Cloudflare DPA required, **including explicit zero-retention-for-training, no-secondary-use, subprocessor flow-down, and AI-specific terms for Workers AI** |
| Retention terms | Edge-log retention must be minimized (propose ≤30 days — **unconfirmed, GAP**) |
| Subprocessor list + change notice | Model provider for Workers AI (Meta Llama via Cloudflare — flow-down terms **unconfirmed, GAP**). **30-day advance notice** before any new AI subprocessor touches chat data (NFR-PRIVACY-010) |
| Security certs | Vendor claims SOC 2 — **evidence not yet collected — GAP** |
| Breach notification SLA | **None agreed — GAP** |
| Deletion on termination | **Not agreed — GAP** |
| State-law posture | MHMDA-applicable: **yes** (tutor prompts may be consumer health data — D3). TX SCOPE: tbd. CA SB 1119: **watch** (AI self-harm protocols — operative 2027-07-01; design to the shape now per FR-AI-001/FR-SAFETY-002). IL BIPA: n/a |
| Risk rating | **approve-with-conditions** — conditions: DPA with AI terms executed; training-prohibition verified in contract; edge-log minimization confirmed. Owner: Compliance Owner. Target: before production. **D2 gate: do NOT publish the "NEVER train" promise until this row's conditions clear** |
| Evidence collected | None yet — **GAP** |

### 3.3 Google (OAuth)
| Field | Content |
|---|---|
| Vendor name | Google — OAuth 2.0 identity provider (signup/sign-in) |
| Data processed | Identity: email, name, profile photo (avatar). **Not**: child data, health, education |
| Data flow diagram (text) | Browser → Google OAuth → ID token → Supabase Auth → app session. Google does not receive app data |
| DPA signed? | Standard Google OAuth terms apply; **verify data-use terms for OAuth profile data (no secondary use) — GAP** |
| Retention terms | Pookie retains only what Supabase Auth stores; Google-side retention per Google terms |
| Subprocessor list + change notice | n/a (IdP direction is inbound) |
| Security certs | n/a for this use |
| Breach notification SLA | n/a for this use |
| Deletion on termination | User disconnects OAuth; Pookie deletes linked identity on account deletion (≤30 days) |
| State-law posture | MHMDA: n/a (identity only). TX SCOPE: n/a. CA: n/a |
| Risk rating | **approve-with-conditions** — condition: verify OAuth data-use terms. Owner: Compliance Owner |
| Evidence collected | None yet — GAP |

### 3.4 OCR / document-AI vendor (TBD)
| Field | Content |
|---|---|
| Vendor name | **TBD — no vendor selected** |
| Data processed | (Future) W21 mail-snap images: bills, cards, documents — **GIPA personal information** |
| Required terms before selection | Extract-then-mask architecture (last-4 only); **raw images never retained by the vendor beyond processing**; no training on inputs; DPA with breach SLA; deletion certification; SOC 2 or equivalent |
| State-law posture | MHMDA: possible (purchase data can reveal health inferences — vendor must not retain). GIPA: **yes** (account numbers) |
| Risk rating | **No assessment possible until a vendor is selected. No image may flow to any OCR vendor before this row is completed and approved.** Owner: Compliance Owner |
| Evidence collected | None — vendor not selected |

### 3.5 AI vendor — tutor inference (Cloudflare Workers AI / Meta Llama)
> Covered in §3.2 (Cloudflare) for infrastructure. This row tracks the **model layer**
> separately because the no-training commitment attaches to the model provider.

| Field | Content |
|---|---|
| Vendor name | Model layer: Meta Llama 3.3 70B served via Cloudflare Workers AI (Anthropic key exists but is **unused** — $0 credits) |
| Data processed | Pookie tutor prompts/responses (may include teen school/health-adjacent content) |
| Required terms | **Binding "never train" commitment** with broad "train" definition (training, fine-tuning, RLHF, eval datasets, embedding stores); zero-retention-for-training; no-secondary-use; subprocessor flow-down; audit/certification rights; documented processing regions; **30-day advance notice** before any model/provider change (NFR-PRIVACY-010) |
| State-law posture | MHMDA: **yes** (prompts may be consumer health data). CA SB 1119: **watch** (operative 2027-07-01). TX SCOPE: tbd |
| Risk rating | **approve-with-conditions** — conditions: contractual no-training terms verified; processing regions documented. **D2 gate: the absolute "NEVER train" promise stays unpublished until this clears.** Owner: Compliance Owner |
| Evidence collected | None yet — **GAP** |

### 3.6 Email / notification provider (TBD)
| Field | Content |
|---|---|
| Vendor name | **TBD** (magic links currently via Supabase Auth email; push provider not selected) |
| Data processed | (Future) email addresses, notification payloads (lock-screen-safe previews only; **no health-content push**) |
| Required terms | DPA; no secondary use; breach SLA; deletion on termination |
| State-law posture | MHMDA: possible if payloads contain health data (**prohibited by design** — FR-AI-003) |
| Risk rating | **Assess before any provider goes live.** Owner: Compliance Owner |
| Evidence collected | None — vendor not selected |

## 4. Gap register (blocks production per sol-legal gate)

| # | Gap | Vendor(s) | Owner | Target |
|---|---|---|---|---|
| V-1 | **DPA not yet executed** | Supabase, Cloudflare, (future: OCR, email) | Compliance Owner | Before production |
| V-2 | No-training-on-inputs term not yet contractual | Cloudflare / Workers AI | Compliance Owner | Before production; **D2: "NEVER train" promise unpublished until cleared** |
| V-3 | Breach-notification SLA not agreed | Supabase, Cloudflare | Compliance Owner | Before production |
| V-4 | Deletion-on-termination not agreed | Supabase, Cloudflare | Compliance Owner | Before production |
| V-5 | Backup-retention alignment unconfirmed (≤30-day source-deletion purge) | Supabase, Cloudflare | Compliance Owner + Security Eng | Before production |
| V-6 | SOC 2 evidence not collected | Supabase, Cloudflare | Compliance Owner | Before production |
| V-7 | OAuth data-use terms unverified | Google | Compliance Owner | Before production |
| V-8 | OCR vendor not selected — assessment impossible | TBD | Compliance Owner | Before W21 ships |
| V-9 | Email/push provider not selected — assessment impossible | TBD | Compliance Owner | Before notifications ship |

## 5. Continuous monitoring

- **Change-of-terms detection:** Compliance Owner subscribes to vendor terms-change
  notices; any change affecting data use, retention, subprocessors, or AI terms triggers
  re-assessment within 30 days.
- **Annual re-assessment:** every approved vendor re-assessed annually; evidence
  re-collected; re-assessment date in §2.
- **Offboarding:** data return/destruction executed per the §2 offboarding plan;
  certification of deletion collected and filed.

## 6. Change log

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-12 | Initial template + baseline inventory; state-law posture column added (D3/D7) | — (attorney review pending) |
