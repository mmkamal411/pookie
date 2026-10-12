# Squad 5 — NO PLACEHOLDERS Addendum

**Authority:** Managing Director directive (Mehedi, 2026-10-12). Supersedes the older launch strategy ("elegant placeholders/seedlings") for all Squad 5 scope.
**Companion:** Overrides seedling language in `UX-SPECS.md` §§1–2; supplements `TEST-PLAN.md`; binds the Wave-2 Frontend Engineer.

---

## 1. The directive

Every module Squad 5 ships is a **full working implementation**: real database tables, real API endpoints, real UI wired to real data, real RLS policies. No mock data, no "coming soon"/seedling screens, no stubbed functions, no TODO/FIXME comments in shipped code. Standing code-cleanliness rule applies (no dead code, no console.logs, clean every file touched).

If a module depends on another squad's unbuilt work: build against the spec'd interface in `BUILD-SPECIFICATION.md`, mark the integration point with a code comment + a note in the relevant doc — but the shipped code path must be complete and work end-to-end against real data.

Where an external API key is required but unavailable: the integration code is complete and documented (key from env, test procedure written); only the missing credential may surface an honest "configuration needed" state.

---

## 2. MD decisions binding Squad 5 (from `docs/MD-DECISIONS.md`)

| ID | Decision | Squad 5 impact |
|---|---|---|
| D2 | AI training → absolute NEVER (no opt-out toggle) | S2 disclosure copy + FAQ legal accordion state this. **Do not publish the claim until Cloudflare/Meta DPA zero-retention terms are verified** (NFR-PRIVACY-010 gate). |
| D4 | Support: rotating holiday on-call; $50 in-ticket financial authority | S3 SLA/holiday copy reflects rotation. Resolves FR-SUPPORT-006 open items. |
| D6 | Time-boxed grants: **8/grantee/30d** trusted (previously approved, no blocks) · **2/30d** first-time grantees · installment detection always on · teen (13–15) co-approval for **NEW grantees only** | Applies to W12 Babysitters grant templates. **Supersedes** Panel Round 2's flat 2/30d. |
| D7 | Location → **COARSE ONLY** (city/ZIP max, never precise GPS). Architectural constraint, not policy. | All Travel modules: "nearby" = coarse location + user-selected radius. **No precise-geolocation code** (permission requests, schema columns, API payloads) anywhere in Squad 5 scope. Break-glass location scope = coarse + W19 medical card. |

---

## 3. UX spec revisions (overrides to `UX-SPECS.md`)

- **Travel hub tiles are real functional cards**, not seedlings. Each tile spec now requires four data states: **loading / loaded / empty** (source genuinely returned nothing nearby) **/ error** (source failure — honest message, never fake data).
- **W26 Weather:** live NWS conditions + alerts for the coarse location; "not an emergency-alert system" disclaimer; AI translation links the official alert + timestamp.
- **W25 Fuel & Charging:** real fuel prices (EIA) + chargers (OpenChargeMap) within the user's radius of coarse location.
- **W27 Events:** real vetted listings from municipal sources (Cobb Parks & Rec, Marietta calendars); curation-policy note; per-event age tags; audience segmented control (Grown-up disabled <18).
- **W28 Restaurants:** real verified listings (source per Tech Lead's API-CONTRACTS decision — Foursquare vs Google Places); GA DPH scores; allergen hard-blocks from the health allergy list; 21+/bar-primary excluded <18.
- **W29 Trails:** real trail data (NPS API + park authority); supervision guidance; "share my plan" first-class step; 90-min sunset warning computed from location + date.
- **W30 Flights:** real fare/route information display; 18+ purchaser invariant — teen sees "Flights need a grown-up to book" + "Share this trip idea with a parent" CTA, **never** a checkout flow.
- **W31 Rental Cars:** hidden from teen accounts entirely (no placeholder tile).
- **Marketplace:** W12 real directory structure with "Parent-vetted, not background-checked by Pookie" micro-label; W6 "Your Georgia timeline" from DOB + real Joshua's Law hours-log UI backed by the DB table.
- **S1 FAQ:** assumes the seeded real corpus (migration 029) — search/tree/article template operate on real content.
- **S2/S3:** already real-interaction specs; confirm no text implies stubbed AI or fake tickets. S2 wires to the real pookie-tutor worker endpoint.
- All gated states, age-band variations, and copy decks from UX-SPECS.md remain in force.

---

## 4. QA test-plan addendum

- **No-placeholder audit (per module):** verify real data end-to-end (e.g., W26 returns live NWS data for a test ZIP; W25 returns real fuel/charger results; S1 search returns seeded articles; S2 reaches the worker endpoint; S3 ticket create → list → reply round-trips real tables; W6 log persists entries and the ring reflects DB state).
- **Fixture-signature spot checks:** responses must not contain mock/fixture markers. **Grep gate:** no TODO/FIXME/STUB in shipped code.
- **External-source failure modes** (each: NWS, EIA, OpenChargeMap, NPS, municipal calendars, restaurant source, tutor worker): source down → honest error state; never silent, never synthetic data.
- **D7 compliance tests:** assert no precise GPS is requested (permission prompts), stored (schema), or transmitted (payloads) in Squad 5 code.
- **D6 grant-tier tests:** 8/30d trusted vs 2/30d first-time enforcement; installment detection; teen co-approval fires for new grantees only, not renewals.
- **D2 gate:** the "never train" claim must not be user-visible until NFR-PRIVACY-010 verification is recorded.

---

## 5. Real data sources (canonical for Squad 5)

| Module | Source | Key | Failure behavior |
|---|---|---|---|
| W26 Weather | NWS api.weather.gov | None (free) | Honest "weather unavailable" |
| W25 Fuel | EIA API (gas), OpenChargeMap (chargers) | EIA key (free); OCM free tier | Honest "prices unavailable" |
| W27 Events | Municipal public calendars (Cobb Parks & Rec, Marietta) | None (public) | Honest "no events found" |
| W28 Restaurants | Foursquare (free tier) or Google Places — Tech Lead decides in API-CONTRACTS | Per decision | Honest "listings unavailable" |
| W29 Trails | NPS API + park authority data | None (free) | Honest "trail data unavailable" |
| W6 DDS rules | Seeded reference data (dds.georgia.gov) | None (static seed) | N/A (local) |
| S1 FAQ | Seeded corpus (migration 029) | None (local) | N/A (local) |
| S2 chat | pookie-tutor worker | Env-configured | Escalate to S3 ticket |
| S3 tickets | Supabase tables (028) | None (local) | N/A (local) |

---

## 6. Cross-squad integration points (marked, not blocked)

- **S2 → pookie-tutor worker:** real endpoint from env. If the worker URL is unset, S2 shows the honest configuration state; escalation to S3 always works.
- **Crisis vendor (D1, contracted):** S2 crisis pattern-interrupt is client-side per sol-safety; the vendor API contract is Squad 1's scope. Squad 5 marks the handoff point and does not build vendor integration.
- **Health allergy list (W28):** reads the standalone `health_allergies` table (Round 2 resolved the W23↔W28 circularity). If Squad 2 hasn't created it, Squad 5 creates the table per spec and notes ownership.
- **`access_events` (021):** support audit event types extend it; if 021 isn't in tree, Squad 5's migrations carry dependency comments (already required).

---

*Wave-2 Frontend Engineer: this addendum overrides any seedling/placeholder language in UX-SPECS.md. Build everything real.*
