# Squad 4 — Home & Money Track: UX Flows & Screen Specs

**Author:** UX Designer, Squad 4 (Home & Money Track)
**Date:** 2026-10-12 · **Branch:** `staging-build` · **Status:** spec for Frontend Engineer (no React code here)
**Authority:** `docs/BUILD-SPECIFICATION.md` (FR-MOD-W21/W20/W11/W7/W24/W14/W12, FR-UX), `docs/solutions/sol-ux.md`, `docs/solutions/sol-legal.md` (§11–12), `docs/MD-DECISIONS.md` (D6 tiered caps)
**Mehedi directives honored:** NO PLACEHOLDERS — every flow describes a fully working experience. Integration seams (OCR vendor, Plaid sync, licensed-partner content, legal gates) are specced as working local behavior with the seam noted — never a dead screen. The W24/W14 "pending legal review" states are first-class UI states with real content behind them; the gate is legal, not functional.

## Design language (global, Mehedi's standing rule)

Shades of green everywhere. Subtle neon — soft glows, sparkles, never harsh. Nature-and-love theme: organic, warm, nurturing, like sunlight through leaves. Divine light: soft glows, god-and-angel touches. Dark cosmos Nebula base (`#050510`, animated starfield) as specified in `docs/solutions/sol-ux.md`. Every surface, no exceptions.

**Shared component vocabulary** (from sol-ux.md — Frontend Engineer reuses these): `Starfield`, `GlowCard`, `CollapseRow` (collapsed by default, expandable on tap — information must never be a chunky wall), `InfoLine` (small plain-English explainer), `Sheet` (bottom sheet), `FullPageFlow` (wizard shell), `PrimaryButton`, `QuietButton`, `InfoBanner` (non-dismissible plain-language notice), `AuditLine` ("who changed what, when"), `RetentionCountdown` (documented below), `TrustChip` (small green shield-glow badge for trust messaging), `ImmutableCard` (locked-card visual — see W14), `ScopeSummary` ("exactly what this person can see" list).

**Copy contracts:** ≤8th-grade reading level on all legal/compliance-adjacent copy. Shame-free, agency-first language ("you decide," never "are you sure?"). Plain English everywhere — no metaphorical names. Never punitive, never "cut off" as a headline verb. Firewall honesty: say plainly what Pookie can't change (schools share directly, etc.).

**Standard states (every module, every screen):**
- **Loading** — Nebula shimmer veil, first-name-only or module-appropriate copy ("Reading your mail…", never a skeleton of the wrong shape). Min 600ms to avoid flicker.
- **Empty** — calm illustration-card + one plain-English line + one primary action. Empty states are working screens: they teach and onboard.
- **Error** — warm, non-technical copy + one retry path + one manual fallback (manual entry always exists wherever OCR/sync is involved).
- **Populated** — collapsed-by-default; tap to expand. Numbers side-by-side with words, never judgment color-coding (no red for "bad").

---

## 0. Shared pattern: RetentionCountdown (W21, W7)

Used everywhere a document carries a legal retention deadline. NOT a "coming soon" concept — it is a working component:

```
┌─────────────────────────────────────────────┐
│  Raw photo — auto-deletes in 23 days         │
│  ▓▓▓▓▓▓▓▓▓▓░░░░░░░░  [Delete now]          │
│  We keep only the extracted details.        │
└─────────────────────────────────────────────┘
```

- Countdown bar drains in soft green → amber at ≤7 days. Tap "Delete now" → immediate secure deletion + warm confirmation ("Gone. The extracted details stay in your Mail file.").
- Server honors it; this UI is the user's honest window into it. FTC Disposal Rule messaging rides on the same component for W11/W7 (see register §8).

---

## 1. W21 Mail — snap a photo → file it (Home)

**Route idea:** `/home/mail` (Frontend Engineer places per IA). Module = photo intake of physical mail, extract-then-mask, file with action cards.

### Flow

**Screen 1 — Mail home (populated)**
```
┌────────────────────────────────────────────────┐
│  ✉️ Mail                                        │
│  Snap it. We pull out what matters.             │
│                                                 │
│  ┌─ TrustChip ───────────────────────────┐    │
│  │ 🛡️ We never keep full account numbers.  │    │
│  │    We read the last 4 digits only.      │    │
│  └────────────────────────────────────────┘    │
│                                                 │
│  [+ Scan new mail]                              │
│                                                 │
│  📬 Action needed (2)  [collapsed→expanded]     │
│  ┌──────────────────────────────────────┐      │
│  │ Electric Co.      $84.12   Due Oct 28  │      │
│  │ [Pay this]  [Mark done]  (•••• 4821)  │      │
│  └──────────────────────────────────────┘      │
│  ┌──────────────────────────────────────┐      │
│  │ Water Works         $31.00   Due Nov 5 │      │
│  │ [Pay this]  [Mark done]  (•••• 9910)  │      │
│  └──────────────────────────────────────┘      │
│  🗂️ Filed (9)  [collapsed]                      │
└────────────────────────────────────────────────┘
```

- Action cards are the hero: payee, amount, due date, one primary action. Overdue gets a gentle green-amber glow ring, never red shame.
- Account numbers render **last-4 only everywhere**: `•••• 4821`. No tap-to-reveal. There is no full number in the client — ever.
- Each filed card carries a small `RetentionCountdown` for its raw photo (see §0).

**Screen 2 — Capture (on-device redaction guidance) — this is FIRST, before the shutter**
```
┌────────────────────────────────────────────────┐
│  Before you snap it                             │
│                                                 │
│  📷 Cover the full account number with your     │
│     finger — we only need the last 4 digits     │
│     and the amount.                             │
│                                                 │
│   ┌─────────────┐                               │
│   │  BILL       │   ← camera preview            │
│   │  •••• 4821  │     divine-light corner       │
│   │  $84.12     │     guides, soft green        │
│   └─────────────┘                               │
│                                                 │
│  [Take the photo]        [Type it in instead]   │
└────────────────────────────────────────────────┘
```
- The guidance is the compliance feature made human: it reduces what ever leaves the device. "Type it in instead" is a full manual-entry path (payee/amount/due date/last-4) — same destination, no OCR needed. Working today, no vendor required.

**Screen 3 — OCR processing (loading state, honest)**
```
┌────────────────────────────────────────────────┐
│  Reading your mail…  (shimmer, min 600ms)       │
│                                                 │
│  ✓ Photo captured                               │
│  ◌ Finding the amount and due date              │
│  ○ Masking account numbers                      │
│                                                 │
│  Your photo stays on this screen until we       │
│  finish — then only the details are kept.       │
└────────────────────────────────────────────────┘
```
- Real progress steps, not a spinner. If the OCR vendor is unavailable, the step list still resolves by dropping to Screen 4's manual-entry variant with the photo attached for reference — never a dead end.

**Screen 4 — Confirm & edit (extracted action card)**
```
┌────────────────────────────────────────────────┐
│  Here's what we found — fix anything            │
│                                                 │
│  Payee      [Electric Co.        ]              │
│  Amount     [$ 84.12             ]              │
│  Due date   [Oct 28, 2026        ]              │
│  Account    •••• 4821  (last 4 only — locked)   │
│  Action     (•) Pay this  ( ) Just file it      │
│                                                 │
│  [Looks right — file it]    [Retake photo]      │
└────────────────────────────────────────────────┘
```
- Account field is locked: masked at extraction, non-editable, non-expandable. The UI makes the masking visible — the user *sees* that Pookie never holds the full number.
- Low-confidence fields (OCR unsure) get an amber underline + "double-check this one" hint — honest, not hidden.

**Screen 5 — Filed confirmation**
- Warm glow card: "Filed. The electric bill is in your Mail file, due Oct 28."
- The raw photo gets its `RetentionCountdown` immediately: "This photo auto-deletes in 30 days. [Delete now]" — the **30-day auto-delete notice is part of the confirmation**, not buried in settings.
- Primary next action: [Scan another] · [Back to Mail].

### States
- **Empty:** "No mail filed yet. Snap a bill, a notice, anything with a due date — we'll pull out what matters." + [Scan your first piece].
- **Error (OCR fails):** "We couldn't read that one. Try better light, or type it in — takes 20 seconds." + [Retake] [Type it in].
- **Populated:** as above.

### Nebula notes
Scan frame uses divine-light corner brackets (soft green glow). Action cards get a soft green underline-glow when due ≤7 days. Filed cards are flat, quiet. The TrustChip sits at module top on every visit — trust messaging is ambient, not a one-time popup.

### Legal/compliance UI in this flow
1. **GIPA masking, made visible:** on-device guidance (Screen 2) + locked last-4 field (Screen 4) + `••••` rendering everywhere. The UI teaches the rule by showing it.
2. **30-day auto-delete notice:** on the filed confirmation AND on every card's `RetentionCountdown`. "Delete now" is immediate.
3. **Sign-off gate (for the record, not UI copy):** sol-legal §12 — attorney review of extract-then-mask, disposal-rule applicability, teenPrivate treatment. If review is pending, the module still works fully; the gate is on *expanding* (e.g., new document types), not on shipping what this spec describes. No user-facing "awaiting review" dead screen here — the flow is complete.

### Integration seam
OCR engine/vendor (TBD by Platform team): the flow is fully functional with the manual-entry path and degrades gracefully per Screen 3. Frontend builds the five screens; the vendor plugs into the extraction step only.

---

## 2. W20 Shopping List — audit + improvement spec (Home)

**Route:** `/household/shopping` — LIVE. Component: `src/components/shopping/shopping-board.tsx` (693 lines, audited 2026-10-12).

### What exists today (audit)
- Household-anchored list (not per-child — correct). Add form (name/qty/unit/note) with Enter-to-add.
- Three lanes: 🌱 Needed → 🤲 Claimed ("I'll grab it") → ✅ Recently bought ("Bought it" + store/price sheet).
- **Attribution exists but is thin:** `whoTag()` renders "— You" / "— {added_by_name}" / "— Family" as small grey text; price reports carry "· you" / "· {name}". Claimed/bought-by attribution is missing — once claimed, the card doesn't say *who* claimed it.
- Price memory (per-item expandable price reports + "Cheapest at {store}" family hint — honestly labeled "based on your reported prices").
- Parent-only store preferences (preferred stores, standing rules like "we don't do Walmart").
- Remove permission: owner or parent (correct).
- Loading: "Gathering the family list…" (plain, no veil). Error: inline alert. Empty states: warm one-liners. Solid base.

### Gaps found (what the Frontend Engineer should fix)
1. **No bought-by attribution:** after "Bought it," the card says "Got at Kroger · $4.20" but not *who* bought it. Household money questions ("who got the milk?") go unanswered.
2. **No check-off delight:** status transitions are instant re-renders — no animation. For the make-or-break UI bar, "Bought it" deserves a moment.
3. **Claimed lane is anonymous:** "Claimed — on the way" doesn't show who claimed; two shoppers can double-buy.
4. **Bought lane grows forever:** no auto-archive; the "Recently bought" section will bloat.
5. **No conflict handling:** two people editing the same item (claim + remove race) surfaces a raw error string.
6. **Price memory is per-item only:** no household-level "where we shop" view despite the data existing.
7. **Accessibility:** remove is an ✕ with title tooltip only; status buttons lack pressed-state affordance; no reduced-motion respect noted.

### Improvement spec (fully working, no placeholders)

**A. Attribution everywhere (the core ask)**
```
┌──────────────────────────────────────┐
│ Oat milk  1 gal                      │
│ — Added by Dawson · Claimed by Mom   │
│    [avatar chips: D][M]              │
└──────────────────────────────────────┘
```
- Every card shows an **attribution line with avatar chips**: added-by always; claimed-by when claimed; bought-by + store + price when bought.
- Avatar chips are first-initial circles in soft green glow; tap → tiny sheet ("Added by Dawson · Oct 12, 9:41 AM").
- Price reports keep their existing "· you / · name" suffixes; add store-date grouping.

**B. Check-off animations (make-or-break bar)**
- "I'll grab it" → card lifts with a soft green glow pulse, then settles into the Claimed lane (lane move animates, 300ms, respects `prefers-reduced-motion` → instant move, no pulse).
- "Bought it" → **spark burst** (tiny green-gold particles from the button, divine-light style), card gets a checkmark-draw animation, then glides to "Recently bought." A one-line toast: "Nice — oat milk is home. ✨" (warm, not gamified; no points, no streaks).
- Undo window: 5 seconds ("Undo" on the toast) — handles the "oops, wrong item" case without a confirm dialog on every tap.

**C. Claimed lane upgrade**
- Claimed cards show claimer chip + "on the way" + optional store hint ("Mom's heading to Kroger").
- If someone else tries to claim an already-claimed item: gentle sheet — "Mom already claimed this. Want to unclaim it for her? [Ask Mom] [Claim it anyway]" — no silent overwrite, no raw error.

**D. Bought lane auto-archive**
- Bought items auto-collapse into "This week's haul" after 24h, then archive after 7 days (still searchable via price memory). The lane stays fresh; the data isn't lost.
- "Buy it again" one-tap on archived items → back to Needed (this is the real re-order loop).

**E. Conflict + error handling**
- Optimistic updates with rollback: claim/buy apply instantly; on failure the card eases back with a warm inline note ("Couldn't save that — you're offline. It'll retry."). Never a raw error string.
- Remove keeps `window.confirm` → replace with an in-app quiet sheet ("Remove oat milk? [Remove] [Keep]") — confirm dialogs are browser-chrome, not Nebula.

**F. Household price view (uses existing data)**
- New collapsed section "Where we shop" (collapsed by default): store leaderboard from reported prices ("Kroger · 14 reports · usually cheapest for dairy"), fully derived from the existing price_reports table. No new backend needed.

### States
- **Loading:** Nebula veil "Gathering the family list…" (upgrade existing plain text to the standard veil).
- **Empty (whole list):** "The list is empty — the pantry glows. ✨ Add the first thing you're out of." + quick-add chips ("Milk", "Eggs", "Bread") learned from price memory.
- **Error:** inline warm alert (keep existing pattern) + retry.

### Nebula notes
Claimed lane cards carry the warm amber `shadow-sun-warm` already — keep. Bought animation is the signature moment: green-gold particle spark, soft and brief. Attribution chips use the stardust/glow-sm tokens already in the codebase.

---

## 3. W11 Spending — parent view vs teen view (Home)

**The privacy promise is the product.** Teen's own purchase detail is teen-private by default (sol-legal §12.5). The UI must make the boundary legible to both sides — the teen must *see* what their parent sees.

### Teen view — "Your money"
```
┌────────────────────────────────────────────────┐
│  💸 Your spending                                │
│                                                 │
│  ┌─ InfoBanner (always visible, plain) ─────┐  │
│  │ 🔒 Your parents see totals, not your      │  │
│  │    line items.                            │  │
│  │                                           │  │
│  │    They see:  October total · $214.50     │  │
│  │    They DON'T see: where you shopped or   │  │
│  │    what you bought. That's just yours.    │  │
│  │                                           │  │
│  │    [See exactly what they see →]          │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  October  $214.50                                │
│  [collapsed categories]                          │
│  ┌──────────────────────────────────────┐      │
│  │ ☕ Food & drink        $86.20    [>]   │      │
│  │    Starbrew · Oct 11 · $6.40           │      │
│  │    Chipotle · Oct 9 · $12.85           │      │
│  │    (full line items — yours only)      │      │
│  └──────────────────────────────────────┘      │
└────────────────────────────────────────────────┘
```
- **[See exactly what they see →]** opens the literal parent aggregate card (see below) rendered inside the teen's phone. This is the anti-suspicion affordance: no imagination required. It shows October total + category totals + the masked account line `•••• 4821` — and nothing else. The teen can verify the promise anytime.
- Full line items (merchant, date, amount) render for the teen only. Full account/card numbers never render — last-4 only, everywhere.
- Copy contract: "totals, not line items" is the exact phrase, repeated verbatim in both views so the two sides match.

### Parent view — "Household spending"
```
┌────────────────────────────────────────────────┐
│  💸 Household spending                           │
│                                                 │
│  October household total   $1,842.10             │
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │ 🏠 Household              $1,627.60   │      │
│  │    (groceries, bills, gas —          │      │
│  │     full detail below)         [>]    │      │
│  └──────────────────────────────────────┘      │
│  ┌─ aggregate card, visibly different ───┐     │
│  │ 🔒 Dawson's spending       $214.50    │     │
│  │    Total only — line items are        │     │
│  │    private to Dawson.                 │     │
│  │    [Why? →]                           │     │
│  └──────────────────────────────────────┘     │
│                                                 │
│  Recent household transactions                  │
│  ┌──────────────────────────────────────┐      │
│  │ Kroger          Oct 12    $86.44      │      │
│  │ Shell           Oct 11    $52.00      │      │
│  │ Electric Co.    Oct 10    $84.12      │      │
│  │    •••• 4821 (last 4 only)            │      │
│  └──────────────────────────────────────┘      │
└────────────────────────────────────────────────┘
```
- The teen aggregate card is **visually distinct** (lock icon, flat slate, no expand affordance — there is nothing to expand). Tapping it does NOT reveal line items; it opens the explainer:
  > "Dawson's line items are private to him. You see the monthly total and category totals so the household budget stays honest. If you need detail — say, for a shared expense — ask him; he can share any receipt one by one from his view."
- Household transactions (parent's own + shared) show full detail — merchant, date, amount — with account numbers masked to last-4.
- If the teen hasn't granted the parent the spending scope at all: the aggregate card reads "Dawson hasn't shared spending totals." — honest, no guilt, no "ask them to share" CTA pushed at the parent (the teen's Sharing screen is the teen's business).

### The "what the parent sees" parity rule
Both views render the SAME aggregate numbers from the SAME data. If they ever disagree, that's a bug, not a feature. The teen's "See exactly what they see" screen is the parity test made visible.

### Deletion & disposal (FTC Disposal Rule, visible)
- Deleting a transaction or disconnecting an account: quiet sheet — "Delete this? We'll remove it securely — shredded digitally, not just hidden. (This follows the FTC's Disposal Rule.)" [Delete securely] [Keep].
- The rule is named in plain language at the point of deletion. Not legalese, not buried.

### States
- **Empty (teen):** "Nothing here yet. Connect an account or add spending manually — your line items stay yours." [Connect account] [Add manually].
- **Empty (parent, no teen sharing):** aggregate card shows the not-shared state (above) — a working screen, not a gap.
- **Loading:** "Adding it all up…" veil.
- **Error (sync fails):** "Couldn't refresh just now — showing last good numbers from {time}." + [Retry]. Stale data is labeled stale, never silently presented as fresh.

### Integration seam
Bank/card sync (Plaid or equivalent — Platform team): the module is fully functional with **manual add** (amount/merchant/date/category, 20 seconds) and CSV import from day one. The sync plugs into the refresh step; the teen/parent views, masking, and aggregates are identical either way. Spec the manual path as the primary working path, not a fallback apology.

### Nebula notes
Category rows expand with a soft green glow on the expanded card. The lock-aggregate card uses flat slate (Nebula-Neutral) — deliberately un-pretty, so "private" reads as a fact, not a feature being sold.

### Legal/compliance UI in this flow
1. **Teen purchase privacy, communicated both directions:** teen banner ("totals, not line items") + "see exactly what they see" + parent aggregate card ("Total only — line items are private to Dawson") + [Why?] explainer. The promise is verifiable in-app.
2. **GIPA masking:** last-4 only on every account/card reference, both views.
3. **FTC Disposal Rule:** named at deletion points.
4. **Scope honesty:** parent views filter server-side by the teen's granted scopes; the UI never implies access the grant doesn't include.

---

## 4. W7 Money & Documents — the vault (Home)

**Route idea:** `/home/vault`. The family's important documents, encrypted, masked, retention-honest.

### Vault home
```
┌────────────────────────────────────────────────┐
│  🔐 Money & Documents                            │
│                                                 │
│  ┌─ TrustChip (persistent, top of module) ──┐  │
│  │ 🛡️ We never store full card numbers.      │  │
│  │    Upload anything — we keep the last 4   │  │
│  │    digits and shred the rest.             │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  [+ Add a document]                             │
│                                                 │
│  💳 Cards (3)              [collapsed→expanded]  │
│  ┌──────────────────────────────────────┐      │
│  │ Chase Sapphire        •••• 4821       │      │
│  │ ⏳ Photo auto-deletes in 12 days       │      │
│  │ [View details]                        │      │
│  └──────────────────────────────────────┘      │
│  🏦 Accounts (2)           [collapsed]          │
│  🪪 IDs & insurance (4)    [collapsed]          │
│  📄 Tax & legal (2)        [collapsed]          │
└────────────────────────────────────────────────┘
```
- Document cards grouped **by type** (Cards / Accounts / IDs & insurance / Tax & legal). Counts on collapsed headers. Tap to expand.
- Every card shows: friendly name, masked identifier (`•••• 4821`), and its `RetentionCountdown` (see §0) — retention is ambient, per-card, always visible. No document's lifespan is a mystery.
- **"View details" is step-up gated:** device PIN/biometric (the teen's own, never the parent's) before the masked details expand. The gate is quick and local.

### Upload flow
```
Screen 1 — [+ Add a document] → type picker (4 big cards):
  💳 A card   🏦 An account   🪪 ID / insurance   📄 Tax / legal

Screen 2 — capture (per type):
  ┌────────────────────────────────────────────┐
  │  Snap the front. Cover the full number —   │
  │  we only keep the last 4.                  │  ← on-device guidance, every time
  │                                            │
  │  [Take photo]  [Upload PDF]  [Type it in]  │
  └────────────────────────────────────────────┘

Screen 3 — confirm (extract-then-mask, same as W21):
  Name      [Chase Sapphire        ]
  Number    •••• 4821  (last 4 only — locked)
  Expires   [08 / 28               ]
  Keep photo for [30 days ▾]  ← retention picker (7/30/90 days; default 30)
  [Save to vault]
```
- The retention picker is set **at upload**: the user chooses the raw-image lifespan; the countdown starts immediately. Extracted metadata (name, last-4, expiry) follows the per-type retention schedule and says so: "The details stay in your vault until you delete them. The photo deletes itself — you chose 30 days."
- Full numbers typed or photographed are masked at extraction and never persisted (NFR-SEC-006). The UI shows the masking happening: the confirm screen renders `•••• 4821` with the lock note before anything is saved.

### Trust messaging (ambient, not a popup)
- Module-top TrustChip (persistent, every visit): "We never store full card numbers."
- Upload Screen 2 guidance (every upload): "Cover the full number."
- Confirm Screen 3 lock note: "last 4 only — locked."
- The same sentence shape in three places = a learned truth.

### States
- **Empty:** "Your vault is empty. Add a card, an ID, insurance — anything the family needs in one safe place." [Add your first document]. Plus the TrustChip — trust is established before the first upload, not after.
- **Loading:** "Locking it away…" (encryption happens; say so — it builds trust).
- **Error:** "Couldn't save that — nothing was stored. Try again." (Failed writes must be explicit: the user must never wonder whether a half-saved card number exists somewhere.)

### Nebula notes
Vault cards have a deeper green tint with a soft inner glow — the "safe" feeling. The TrustChip carries the divine-light treatment (soft halo). Step-up gate uses system biometric sheet styling (boring = trustworthy here).

### Legal/compliance UI in this flow
1. **"We never store full card numbers"** — persistent module banner + per-upload guidance + confirm-screen lock note.
2. **Retention countdown per document** — `RetentionCountdown` on every card; retention picker at upload; "Delete now" honored immediately.
3. **FTC Disposal Rule** — named at document deletion, same pattern as W11.
4. **Sign-off gate (record):** sol-legal §12 — same attorney gate as W21. Fully working as specced; the gate covers expansion, not this flow.

---

## 5. W24 Credit — minor security-freeze management (Home)

**Re-scoped per BUILD-SPECIFICATION FR-MOD-W24 and sol-legal §11:** NO 3-bureau monitoring, NO scores, NO bureau pulls — Pookie never had FCRA permissible purpose and the bureaus won't furnish. What ships: **guided freeze placement/lift tracking for a minor's credit file** (O.C.G.A. §§ 10-1-914/914.1 — lawful, GA-native) + credit-hygiene coaching. **The app guides and tracks; it never pulls the file itself.**

**Age gating:** parent/guardian action for under-16; teen 16–17 participates with guardian; 18+ self-service. Teen accounts (13–15) do not see this module tile. Parent view is per-child.

### Freeze-status dashboard (the module home — real, working)
```
┌────────────────────────────────────────────────┐
│  🧊 Credit freezes                               │
│                                                 │
│  ┌─ InfoBanner ────────────────────────────┐   │
│  │ Pookie is not a credit reporting agency. │   │
│  │ We don't show credit scores or reports — │   │
│  │ we help you freeze and track them.       │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  ┌─ pending-legal-review banner ───────────┐   │
│  │ ⏳ Freeze requests are being reviewed by │   │
│  │    our lawyers. Your checklists, docs,   │   │
│  │    and freeze status below are saved and │   │
│  │    ready — we'll unlock requests when    │   │
│  │    review clears. [What's this? →]       │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  Dawson (15)                                    │
│  ┌────────────┬────────────┬────────────┐       │
│  │ Equifax    │ Experian   │ TransUnion │       │
│  │ 🧊 FROZEN  │ 🧊 FROZEN  │ ○ Not yet  │       │
│  │ since Mar  │ since Mar  │ [Request →]│       │
│  └────────────┴────────────┴────────────┘       │
│                                                 │
│  📚 Freeze guides  [collapsed]                   │
│    "What a freeze does (and doesn't do)"        │
│    "When to lift: first job, college apps"      │
│    "If you suspect identity theft"              │
│    "Turning 18: your file becomes yours"        │
└────────────────────────────────────────────────┘
```
- The per-bureau × per-child grid is the module's heart: status pills (🧊 Frozen / ○ Not frozen / ⏳ Request sent / ? Unknown), dates, and one-tap drill-down per bureau (documents sent, confirmation reference, lift history).
- **The "pending legal review" banner is a first-class state, not a shell:** everything behind it works — the dashboard, the per-bureau tracking, the document checklists, the guides. Only the *request-freeze submission step* is held (the button reads "Request →" and opens the flow; the final submit step shows the review notice and saves the packet as "ready to send"). The data model works; the gate is legal. When review clears, the same screens unlock — no redesign.
- The "not a credit reporting agency" disclaimer sits at module entry AND on every coaching surface (sol-legal §11.4) — persistent, plain, ≤8th grade.
- "Unknown" status is honest: "We haven't tracked this bureau yet — [start the checklist]." Never auto-filled, never inferred.

### "Request freeze" flow (works end-to-end as a guided packet builder)
```
Step 1 — Who & where:  [Dawson (15) ▾]  Bureau: (•) Equifax ( ) Experian ( ) TransUnion
Step 2 — Document checklist (per bureau, real checklist with uploads):
         ☐ Child's birth certificate  [Upload]
         ☐ Child's Social Security card (last 4 shown after upload: ••• 1234)
         ☐ Parent/guardian photo ID   [Upload]
         ☐ Proof of address           [Upload]
         Progress: "2 of 4 ready"
Step 3 — How to send (bureau-specific, plain language):
         "Equifax takes freeze requests for minors by mail. Here's the address,
          what to include, and a cover letter we filled in for you. [Print packet]"
Step 4 — Track it:
         [x] Packet mailed  →  status becomes "⏳ Request sent (Oct 12)"
         "Bureaus usually confirm in 1–3 weeks. We'll remind you to check."
         Confirmation reference: [enter when it arrives] → status becomes "🧊 Frozen"
```
- Every step is real: checklist state persists, uploads are masked (last-4), the cover letter is generated from the family's data, the packet prints. During legal review, Step 4's submit is the held step — the packet is saved as "ready to send" with the review banner, not discarded.
- **Lift flow** mirrors it: "Lifting for a reason?" → occasion picker (first job / college application / other) → per-bureau lift checklist → status "⏳ Lift requested" → back to "🧊 Frozen" with history. Reminders: "You lifted Experian for a job application — re-freeze when it's done? [Re-freeze]".

### Coaching (first-party, working content)
- Four guides ship as real articles (plain language, GA-specific): what a freeze does/doesn't do; lift-before-application reminders; identity-theft response steps; the 18th-birthday handoff ("your file becomes yours — here's the checklist").
- Licensed-partner content is the **seam**: partner-supplied modules slot into the same guide list when the contract lands. The screens don't change; the content source does. No empty "partner content coming" rows — first-party guides are the complete experience until then.

### States
- **Empty (no child tracked):** "Freezing a minor's credit file stops anyone from opening accounts in their name. Start with one bureau — we'll walk you through it." [Start with Equifax].
- **Loading:** "Checking your freeze board…"
- **Error:** "Couldn't load the board — your checklists are safe. [Retry]"

### Nebula notes
Frozen bureaus get the ice-green glow (soft, cool — the one place cool tones lead). "Not yet" bureaus are quiet flat cards. The review banner uses warm amber, calm — a pause, not an alarm.

### Legal/compliance UI in this flow
1. **"Not a credit reporting agency" disclaimer** — module entry + every coaching surface, persistent.
2. **"Pending legal review" banner** — first-class state: real dashboard behind it, only submission held; [What's this?] explains in plain language ("Our lawyers are reviewing the freeze-request steps to make sure we get them exactly right. Your progress is saved.").
3. **O.C.G.A. §§ 10-1-914/914.1 basis** — named in the "What a freeze does" guide in plain language ("Georgia law lets parents freeze a minor's credit file…").
4. **FCRA counsel sign-off gate (record):** sol-legal §11 — **W24 does not ship in any form without it.** The pending-review banner IS the UI expression of this gate.
5. **Age gating:** hidden from teen (13–15) accounts entirely; 16–17 with guardian; 18+ self-service.

---

## 6. W14 Co-parenting — parallel-parenting mode (Home)

**The hardest UX in the squad. Re-scoped per FR-MOD-W14:** blocked for high-conflict as designed. Required: parallel-parenting mode — **two separate surfaces, no shared thread, no messaging UI at all**; immutable uneditable log; logistics-only entry types; custody-order awareness + travel-restriction profile (FR-SAFETY-012); neutral teen-facing coaching/pattern flags. Launch read-only/logistics-only; expand only after family-law practitioner review (R5).

**Design principle:** this module reduces contact, not facilitates it. Every screen choice asks: "does this create a surface for conflict?" If yes, it doesn't ship.

### The two surfaces

**Parent A's surface** (`/home/coparenting`) and **Parent B's surface** (same route, their own data) are structurally identical but completely separate:
- **My logistics** — my entries only. I add, I see mine.
- **Shared log** — the immutable timeline both parents can read; neither can write directly, edit, delete, or comment. Entries appear here after each parent logs them on their side.
- **Teen lens** — neutral coaching content (same for both parents, read-only).

There is **no messaging UI. Deliberately absent.** Where a message thread would normally sit, the module says so:

```
┌────────────────────────────────────────────────┐
│  There's no messaging here — on purpose.       │
│                                                 │
│  Messages become screenshots. Screenshots       │
│  become court exhibits. This space keeps        │
│  logistics clean and documented instead.       │
│                                                 │
│  Need to say something? Put the logistics      │
│  in the log. The rest can wait.                │
└────────────────────────────────────────────────┘
```
- This card appears once per parent at first run and lives permanently as a collapsed "Why no messaging?" row. The absence is designed, explained, and permanent.

### My logistics — entry types (logistics ONLY)
```
[+ Log an entry] → type picker (4 cards, no free-text-everything):

  🚗 Pickup / dropoff     💵 Expense     📅 Schedule change     🤝 Handoff note

🚗 Pickup:  who (which child) · date · time · place (coarse — neighborhood/ZIP, never precise GPS per D7)
💵 Expense: what for · amount · who paid · [receipt photo] · status (logged / settled)
📅 Schedule change: what changed · old plan → new plan · effective date
🤝 Handoff note: one line, logistics only ("Inhaler is in the blue backpack.")
     ↳ The handoff note field is capped at 140 characters and logistics-hinted.
       It is not a letter. It is not a message.
```
- **No "message to teen" type exists.** There is no child-as-courier path: entries are parent-to-log, never parent-to-child. If a parent types something addressed to the teen ("tell Dawson…"), inline guidance appears: "This log is between parents. Talk to Dawson directly — or check the Teen lens below for ideas."
- Each entry, on save: timestamped, attributed ("Logged by Parent A · Oct 12, 6:02 PM"), and **immediately immutable** — the edit button never exists. The save confirmation says it plainly: "Logged. Entries can't be edited or deleted — that's what makes the log trustworthy."

### Shared log — the immutable timeline (read-only for both)
```
┌────────────────────────────────────────────────┐
│  📜 Shared log                                  │
│  ┌─ ImmutableBanner ─────────────────────┐    │
│  │ 🔒 This log can't be edited. Entries   │    │
│  │    are permanent once saved — for both │    │
│  │    parents. That's what makes it       │    │
│  │    trustworthy.                        │    │
│  └────────────────────────────────────────┘    │
│                                                 │
│  ┌─ ImmutableCard ───────────────────────┐    │
│  │ 🚗 Pickup · Oct 14 · 6:00 PM           │    │
│  │    Logged by Parent A · Oct 12, 6:02 PM │    │
│  │    [no edit · no delete · no reply]     │    │
│  └────────────────────────────────────────┘    │
│  ┌─ ImmutableCard ───────────────────────┐    │
│  │ 💵 Expense $45 · soccer cleats          │    │
│  │    Logged by Parent B · Oct 11, 9:14 AM │    │
│  │    Status: logged (not yet settled)     │    │
│  └────────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```
- **Visually distinct:** ImmutableCards use a locked visual language — flat slate, lock icon, hairline border, NO hover affordances, no action buttons at all. They look un-editable because they are. Contrast with every editable card elsewhere in the app (which all carry glow/hover).
- Both parents see the same log, same order, same entries. Neither sees drafts, typing indicators, or "Parent B is viewing."
- Filters: by child, by type, by month. Search: plain text. Export: "Download the log (PDF)" — the court-ready artifact, generated from the immutable record.

### Pending family-law review banner (first-class state)
```
┌─ pending-review banner (top of module, both parents) ─┐
│ ⏳ A family-law professional is reviewing this        │
│    co-parenting setup. Everything below — your        │
│    entries, the shared log, the teen guides — is      │
│    saved and working. After review, we may add        │
│    more entry types. [What's being reviewed? →]       │
└───────────────────────────────────────────────────────┘
```
- Real UI, real content behind it: entries log, the immutable log renders, teen coaching reads, PDF export works. The gate is on **expansion** (new entry types, any messaging-shaped feature) — never on what's specced here. [What's being reviewed?] → plain-language sheet ("A family lawyer is checking that this setup is safe and fair for high-conflict situations…").
- The banner is calm amber, not alarming — review is diligence, not danger.

### Teen lens (neutral coaching, same for both parents, read-only)
- Short neutral guides: "What parallel parenting means for your teen," "The no-messenger rule, explained for teens," "Patterns that help: consistency, no quizzing."
- **Pattern flags (neutral, private to each parent):** "You've logged 3 schedule changes this month — teens do best with predictable rhythms. [Ideas →]" — private to the parent who sees it, never shown to the other parent, never shown to the teen as a judgment. Coaching, not surveillance.
- The teen never sees either parent's surface. The teen's own experience of this module: nothing — by design. (Their Sharing screen governs what they share; this module is parent-logistics only.)

### Custody-order awareness + travel-restriction profile (FR-SAFETY-012)
- Read-only profile line at module top (collapsed): "Travel rules on file: out-of-state travel needs 14 days' notice (per custody profile). [View]" — informational, set from the custody profile, not editable in-module.
- Pickup entries near travel: if a pickup is logged with an out-of-ZIP location, a quiet line appears: "This looks like travel — check your travel rules above." Guidance, not enforcement.

### States
- **Empty:** "No entries yet. Log your first pickup — the shared log starts with you." [Log a pickup]. The immutable log shows: "Nothing here yet. Entries appear here once logged — permanently."
- **Loading:** "Opening your space…" (each parent's surface loads only their data; the veil prevents any flash of the other parent's entries).
- **Error:** "Couldn't load your entries — nothing was lost. [Retry]"

### Nebula notes
Nebula-Neutral throughout this module — calm, flat, no celebration, no particle delight. This is the one module where restraint IS the design. ImmutableCards are the flattest cards in the app. The "no messaging" card is quiet slate with soft green text — firm but kind.

### Legal/compliance UI in this flow
1. **"Pending family-law review" banner** — first-class state; expansion gated on practitioner review (R5). Plain-language explainer behind [What's being reviewed?].
2. **Immutability, communicated at three points:** save confirmation ("can't be edited or deleted"), ImmutableBanner atop the log, locked card visuals. The user understands permanence *before* they need it.
3. **No-messaging absence, explained:** the designed-absence card (not a missing feature — a stated choice).
4. **No child-as-courier:** no "message to teen" type; inline redirect when entries address the teen.
5. **Custody-order awareness:** read-only travel-restriction line from the custody profile; travel-adjacent guidance on pickups.

---

## 7. W12 Babysitters — directory + time-boxed grants (Marketplace)

**Category note:** W12 lives in **Marketplace** (with W6), not Home. Entry: Marketplace → Babysitters.
**Unblocks:** FR-ACCESS-011 (time-boxed grants). **MD D6 applied:** tiered caps — 8/grantee/30d for recurring/trusted grantees, 2/30d for first-time grantees; teen co-approval (13–15) for NEW grantees only, not renewals within cap.

### Directory (parent-built, parent-vetted)
```
┌────────────────────────────────────────────────┐
│  🧸 Babysitters                                  │
│                                                 │
│  ┌─ DisclaimerBanner (PROMINENT, every visit) ┐ │
│  │ ⚠️ Parent-vetted, not background-checked    │ │
│  │    by Pookie.                               │ │
│  │                                             │ │
│  │    Everyone here was added and vetted by    │ │
│  │    YOU — a parent. Pookie has not run       │ │
│  │    background checks on anyone listed.      │ │
│  │    [What vetting means →]                   │ │
│  └─────────────────────────────────────────────┘ │
│                                                 │
│  [+ Add a sitter]                               │
│                                                 │
│  ┌──────────────────────────────────────┐      │
│  │  M   Maya R. — neighbor               │      │
│  │      ✅ Vetted by Mom · Mar 2026       │      │
│  │      trusted sitter · 5 of 8 shares    │      │
│  │      left this month                   │      │
│  │      [Share for a bit →]               │      │
│  └──────────────────────────────────────┘      │
│  ┌──────────────────────────────────────┐      │
│  │  J   Jordan T. — college sitter        │      │
│  │      ✅ Vetted by Mom · Oct 2026       │      │
│  │      new sitter · 2 of 2 shares        │      │
│  │      left this month                   │      │
│  │      [Share for a bit →]               │      │
│  └──────────────────────────────────────┘      │
└────────────────────────────────────────────────┘
```
- **The disclaimer is prominent, not buried:** top of module on every visit, on every directory card (compact form), AND inside the grant flow. Three placements, same sentence shape. [What vetting means →] → plain-language sheet ("Vetted means a parent added them, met them, and trusts them with their kids. It does not mean a criminal background check. If you want a real background check, here's how families usually get one…").
- **Vetted-by attribution on every card:** "✅ Vetted by Mom · Mar 2026" — who vetted, when. In two-parent households: "Vetted by Mom" vs "Vetted by Dad" is visible to both (attribution is honesty). A sitter vetted by Parent A shows that attribution to Parent B — no anonymous entries.
- **Tier + remaining grants on every card (D6):** "trusted sitter · 5 of 8 shares left this month" / "new sitter · 2 of 2 shares left this month." The tier is computed: first-time grantees (never granted, or blocked history) get 2/30d; recurring/trusted (previously approved, no blocks) get 8/30d. The count is a rolling 30-day window, shown in plain words.
- Directory fields: name, relationship, phone, notes ("great with the dog, CPR certified 2025"), comfort info (bedtime routine, allergies to know — from the family's own notes, never medical-record pulls). Add-sitter flow: 30 seconds, then the vetted-by attestation checkbox: "☐ I've met this person and trust them with my kids." (unchecked default — the attestation IS the vetting record.)

### "Share for a bit" — time-boxed grant flow (two paths per D6)

**Path 1 — Trusted sitter renewal (Maya, 5 of 8 left): no teen re-prompt**
```
Step 1 — Who: [Maya R. — trusted sitter, 5 of 8 shares left this month]
Step 2 — When: occasion presets with computed end times:
           (•) Tonight 6–10 PM   ( ) Saturday 6–10 PM   ( ) Custom…
           "Ends Saturday 10:00 PM — access switches off by itself."
Step 3 — What they can see (Sitter basics preset, scope allowlist ONLY):
           ☑ Schedule & logistics (pickup times, calendar)
           ☑ Pickup authorization (can pick up the kids)
           ☑ Emergency medical card (allergies, conditions, emergency contacts)
           ── Not included, ever: check-ins, journals, chats with Pookie,
              mood & health details, full family messages.
           "Temporary shares never include private stuff — the app won't allow it."
Step 4 — Review & share:
           "Maya gets schedule, pickup, and the emergency card until Saturday
            10:00 PM. That's it."
           [Share for Saturday 6–10 PM]
```
- No teen co-approval on renewals within cap (D6) — the flow says so honestly on the review step: "Maya's shared before — no need to ask Dawson again."
- Exceeding the cap converts: "Maya's at 8 of 8 this month. To share again, set up an ongoing share — Dawson approves it." → routes to the indefinite-grant flow with teen approval (per FR-ACCESS-011), not a dead end.

**Path 2 — First-time grantee (Jordan, 2 of 2 left): teen co-approval required (13–15)**
```
Steps 1–3 — same as Path 1, with "new sitter · 2 of 2 shares left this month"
         on the Who step.

Step 3b — Teen co-approval (NEW — only on this path, ages 13–15):
┌────────────────────────────────────────────────┐
│  One more step — Dawson gets a say              │
│                                                 │
│  Jordan hasn't sat for you before, so we're     │
│  asking Dawson too. He sees:                    │
│                                                 │
│    • Who: Jordan T. (college sitter)            │
│    • When: Saturday 6–10 PM                     │
│    • What: schedule, pickup, emergency card     │
│    • What NOT: his check-ins, chats, anything   │
│      private                                     │
│                                                 │
│  [Ask Dawson] → he gets a simple yes/no         │
│  in his Pookie. The share starts only if        │
│  he says yes.                                   │
│                                                 │
│  (Under-13: you decide as the parent. 16–17:    │
│   Dawson is notified and can revoke anytime.)   │
└────────────────────────────────────────────────┘

Teen side (Dawson's phone) — simple yes/no, Nebula-Neutral:
┌────────────────────────────────────────────────┐
│  Can Jordan T. sit Saturday 6–10 PM?            │
│                                                 │
│  They'd see: your Saturday schedule, pickup     │
│  info, and the emergency card.                  │
│  They would NOT see: your check-ins, chats,     │
│  or anything private.                           │
│                                                 │
│  [Yes, that's fine]   [No]                      │
│                                                 │
│  Your parents won't know how you voted —        │
│  only whether the share went ahead.             │
└────────────────────────────────────────────────┘

Step 4 — Review & share (parent, after teen approves):
           "Dawson said yes. Jordan gets schedule, pickup, and the
            emergency card until Saturday 10:00 PM."
           [Share for Saturday 6–10 PM]
         If the teen says no: "Dawson wasn't comfortable with this one.
           No share was created." — warm, no guilt, no parent notification
           of the vote (only the outcome: no share).
```
- **Anti-coercion note:** the teen votes on their own device, in their own Pookie, with the explicit "your parents won't know how you voted" line. Same-device grant creation is flagged in the audit log (welfare, invisible to the parent).
- Frequency cap honesty: the Who step always shows remaining shares; at 0 remaining the [Share for a bit →] button becomes "At this month's limit — [set up ongoing share]" (the indefinite path with teen approval), never a grey dead button with no explanation.

### Active grant card + expiry slope (working, fully specced)
```
┌────────────────────────────────────────────────┐
│  🟢 Maya has access until Sat 10:00 PM           │
│     Schedule · pickup · emergency card           │
│     [End now]              ⏳ ends in 3h 12m     │
└────────────────────────────────────────────────┘
```
- **Expiry as a slope (FR-ACCESS-011):** T-24h → parent nudge ("Maya's share ends tomorrow at 10 PM"); T-1h/T-15m → sitter wrap-up notice ("Your access ends in 15 minutes — wrap up!"); at expiry → sitter sees the "All done" screen: "All done — thanks! [Request more time] [Text parent]" + 10-minute read-only grace.
- **Expiry notices are single-fire, zero attribution, no re-request CTA** toward the family: the parent's nudge is informational; the sitter is never told "the parent didn't renew."
- **Teen 13+ is notified of every third-party grant** with one-tap revoke — a quiet line in their Sharing screen: "Maya R. can see schedule + pickup until Sat 10 PM. [Revoke]" — instant for third-party grants.
- **Idempotent 5-minute sweeper** (`revoked_by='system'`, reason `expiry`) — enforcement owner; the UI never shows a grant past its end time.
- **Saved templates + one-tap re-grant:** "Saturday night sitter" template (Maya, Sat 6–10 PM, sitter basics) → one tap re-grants as a new time-boxed grant (counts against the cap; no auto-recurring — saved templates are convenience, not subscriptions).

### Background pattern detection (installment behavior)
- If grants to the same person approach the cap in a suspicious pattern (e.g., 2+2+2 rapid cycling), the teen's Sharing screen flags it: "Jordan's been shared with 6 times this month in short bursts — [Review]" — the teen sees the pattern; the parent sees a quiet line on the directory card. Detection is visible to the protected party, not the granter.

### States
- **Empty:** "No sitters yet. Add someone you trust — you'll vet them, and time-boxed shares keep it safe." [Add a sitter]. Disclaimer still shows (it describes the directory's nature, not its contents).
- **Loading:** "Opening your sitters…"
- **Error:** "Couldn't load sitters — your list is safe. [Retry]"

### Nebula notes
Directory cards use warm green glow; the disclaimer banner is calm amber with a soft pulse on first view per session (attention without alarm). Active grant cards carry a living countdown ring (soft green → amber in the last hour). The teen yes/no screen is Nebula-Neutral — a decision, not a celebration.

### Legal/compliance UI in this flow
1. **"Parent-vetted, not background-checked by Pookie"** — module top (every visit) + every card (compact) + grant flow. [What vetting means →] plain-language sheet. Never buried.
2. **Scope allowlist, shown not hidden:** the grant flow lists what's included AND what's never included. The RPC rejection of Reflection/Wellness/H2/H3/full-communications is expressed as UI truth: those rows don't exist as options.
3. **D6 tiered caps, visible:** tier + remaining shares on every card and in the flow; cap-exceeded converts to the indefinite-grant path with teen approval (never a dead end).
4. **Teen co-approval (13–15) for new grantees:** dedicated step on Path 2; private vote; renewals within cap skip it (stated honestly).
5. **Vetted-by attribution:** who vetted + when, on every card.
6. **FCRA counsel note (record):** "or integrate real checks (FCRA counsel first)" — if real background checks ever ship, they arrive as a new, separately-gated feature. This spec ships directory-only.

---

## 8. Legal/compliance communication register — every place the UI must speak the law

| # | Constraint | Where the UI says it | Exact UI surface |
|---|---|---|---|
| 1 | GIPA masking (extract-then-mask, last-4 only) | W21 Mail | On-device guidance (Screen 2), locked `••••` field (Screen 4), `••••` rendering everywhere, module TrustChip |
| 2 | GIPA masking | W7 Vault | Module TrustChip (persistent), upload guidance, confirm-screen lock note |
| 3 | GIPA masking | W11 Spending | Last-4 on all account/card references, both views |
| 4 | Raw-image auto-delete ≤30 days | W21 Mail | Filed-confirmation notice + per-card `RetentionCountdown` + [Delete now] |
| 5 | Retention countdown, per document | W7 Vault | Per-card `RetentionCountdown`; retention picker (7/30/90d) at upload |
| 6 | FTC Disposal Rule | W11 Spending, W7 Vault | Named in plain language at every delete/disconnect point ("shredded digitally… follows the FTC's Disposal Rule") |
| 7 | Teen purchase detail = teen-private | W11 Spending | Teen banner ("totals, not line items"), "see exactly what they see," parent aggregate card + [Why?] |
| 8 | "Not a credit reporting agency" | W24 Credit | Module entry + every coaching surface, persistent |
| 9 | W24 pending legal review (FCRA counsel gate) | W24 Credit | First-class banner; only submission held; [What's this?] explainer; dashboard/checklists/guides fully working behind it |
| 10 | O.C.G.A. §§ 10-1-914/914.1 basis | W24 Credit | "What a freeze does" guide, plain language |
| 11 | W24 age gating (parent/guardian <16) | W24 Credit | Module hidden from 13–15 teen accounts; 16–17 with guardian; 18+ self-service |
| 12 | W14 pending family-law review (R5) | W14 Co-parenting | First-class banner; expansion gated; [What's being reviewed?] explainer; entries/log/coaching/export fully working behind it |
| 13 | W14 immutability | W14 Co-parenting | Save confirmation + ImmutableBanner + locked card visuals (three-point communication) |
| 14 | W14 no-messaging (designed absence) | W14 Co-parenting | "No messaging here — on purpose" card, permanent collapsed row |
| 15 | W14 no child-as-courier | W14 Co-parenting | No "message to teen" type; inline redirect when entries address the teen |
| 16 | W14 custody-order / travel-restriction awareness | W14 Co-parenting | Read-only travel-rules line from custody profile; travel-adjacent pickup guidance |
| 17 | Babysitter background-check disclaimer | W12 Babysitters | Module top (every visit) + every card (compact) + grant flow; [What vetting means →] sheet |
| 18 | W12 scope allowlist (never Reflection/Wellness/H2/H3/full-comms) | W12 Babysitters | Grant flow lists included + never-included; disallowed scopes have no UI affordance |
| 19 | D6 tiered caps (8/30d trusted, 2/30d new) | W12 Babysitters | Tier + remaining on every card + grant flow; cap-exceeded converts to indefinite-grant path with teen approval |
| 20 | Teen co-approval 13–15, new grantees only | W12 Babysitters | Dedicated step on first-time path; private teen vote; renewals skip it (stated honestly) |
| 21 | Vetted-by attribution | W12 Babysitters | "Vetted by {parent} · {date}" on every card; vetted-by attestation checkbox at add |
| 22 | Coarse location only (D7) | W12, W14 | Pickup/place fields accept neighborhood/ZIP only; no precise-GPS affordance anywhere |
| 23 | Grant expiry slope + zero-attribution notices | W12 Babysitters | T-24h parent nudge; T-1h/T-15m sitter wrap-up; "All done" screen; single-fire neutral notices |
| 24 | Teen one-tap revoke of third-party grants | W12 Babysitters | Quiet line in teen's Sharing screen per active grant |

**Copy standard for all of the above:** ≤8th-grade reading level, plain English, no legalese, no em dashes in teen-facing copy. Every legally-relevant item gets the plain-language explanation AND the reason Pookie's policy aligns (per Mehedi's FAQ content standard) — the [Why?] / [What's this?] sheets are where that lives.

---

## 9. Handoff notes for the Frontend Engineer

1. **No React code in this spec is intentional.** Build against the component vocabulary (§0 intro): `TrustChip`, `InfoBanner`, `ImmutableCard`, `RetentionCountdown`, `CollapseRow`, `ScopeSummary` are new shared components — propose them to the design-system owner before building module-local versions.
2. **W20 is an audit, not a greenfield:** the improvements in §2 bolt onto `src/components/shopping/shopping-board.tsx`. Keep its API contract (`/api/v1/household/shopping/*`).
3. **W24/W14 review banners** are state-driven (`legal_review_status: 'pending' | 'cleared'`) — when cleared, the same screens unlock. Do not build separate "review" and "live" variants.
4. **D6 tier logic** (`trusted` = previously approved, no blocks → 8/30d; else 2/30d; rolling window) is server-computed; the UI renders the tier + remaining count it is given and never computes eligibility client-side.
5. **Teen co-approval (W12 Path 2)** needs the teen's Sharing-screen surface — coordinate with Squad 1 (access model) on the yes/no interaction; this spec defines the copy and the privacy properties (private vote, outcome-only parent notification).
6. **W11 parity rule** (teen's "see exactly what they see" = parent's aggregate card) should be ONE component rendered in both places.
7. **Placeholder ban:** if an integration isn't ready (OCR vendor, Plaid, licensed partner), the manual/first-party paths in this spec are the shipped experience. Never render "coming soon."

---

*End of Squad 4 UX flows. Questions/blockers → UX Designer via Managing Director handoff.*
