# Prism E1 — UX Audit: Surfaces A (30 pages, a–m)

**Auditor:** Prism E1 (UX Researcher, surfaces A) · **Date:** 2026-10-12 ~12:00 EDT
**Repo:** `~/workspace/pookie-app`, branch `staging-build` · **Method:** source read of every `page.tsx` + its rendered components (no browser available to this agent); headings, CTAs, back-links, empty states, hover/focus classes, glow utilities, hard-coded colors.

**Design language checked against:** cool hi-tech (not warm), well-lit (not dark), Title Case everywhere, subtle neon glow on interactive elements (never harsh), bottom toolbar = spaceship console, pages = popup modules, collapsed-by-default detail (Dawson-dashboard pattern).

**Global strengths observed:**
- Bottom toolbar (`child-toolbar.tsx`) persists on all `/c/*` pages: 5 tabs with per-tab glow colors, `aria-current="page"`, `data-active`, per-tab drop-shadow glow — current-page indicator is glowing ✓.
- Shared design tokens are the real deal: `.btn-dapple` (glow-sm built in), `.card-living`, `.tab-active-glow`, `.cta-glow`, `.divider-neon`, `.instrument-divider`, `.text-sunlit`, `animate-bloom`. Most pages use them.
- No harsh colors found anywhere in the audited set — reds/ambers appear only at low opacity (`red-500/10`, `amber-400/25`) for warnings/disclaimers. Nothing gaudy.
- Empty states are consistently guiding, never dead ("Log your first pickup — the shared log starts with you", "No sitters yet — add your first", "Nothing on the radar — clear skies ahead").
- Collapsed-by-default is honored on Home (`OverviewSection` with `instrument-divider` + chevron) and sharing (`<details>` for not-yet-built domains).

**Global gaps:**
- **Title Case violations are widespread** — see ranked list P1. This is a Mehedi non-negotiable.
- Raw `<button>` elements in several components have little/no hover feedback and skip the glow utilities (P2).

---

## `/account-deleted`
- **Intuitive: 4** — Plain-language grace-period copy, purge date shown boldly, one clear primary CTA ("Cancel deletion and restore everything").
- **Neon: 4** — `card-living` + `btn-dapple` + `PookieOrb`; h1 `text-sunlit`.
- **Flow: 3** — The page says "Just sign out and let the date pass" but provides **no sign-out button**; the user must hunt for sign-out elsewhere (Settings). Restore → `/` ✓. Non-pending → redirect ✓.
- Issues: no sign-out control (P1); h1 "This account is scheduled for deletion" not Title Case (P2).

## `/add-child`
- **Intuitive: 4** — `StepShell` wizard pattern, age-aware `InfoLine`s (under-13 vs 13–17), honest school-data-sharing disclaimer, "Back" QuietButton → `/me` ✓. Labels "Child's name"/"Child's email" not Title Case.
- **Neon: 3** — `card-living` shell ✓, but `PrimaryButton` is only `hover:brightness-110` (no glow), inputs are `focus:border-nova-400/70` (border change only, no glow shadow), QuietButton has no hover feedback.
- **Flow: 4** — Back ✓; success `router.push("/")` ✓; guarded (zero-membership only) ✓.

## `/c/[childSlug]` (Home / Overview)
- **Intuitive: 5** — `OverviewSection`s with badge counts, glance survives in headers.
- **Neon: 5** — Collapsible sections, `instrument-divider`, `animate-bloom` stagger.
- **Flow: 5** — Toolbar Home tab; class cards link to class pages.
- Issues: section titles "Course corrections" / "On the horizon" not Title Case (P2).

## `/c/[childSlug]/coparenting`
- **Intuitive: 4** — `PageHeader` (eyebrow/icon/title/subtitle) orients well; parent-only, no-messaging model explained; guiding empty states.
- **Neon: 4** — Uses glow utilities (4 files in home-money use them).
- **Flow: 4** — Reachable via More popup; no in-page back link (toolbar only).

## `/c/[childSlug]/credit`
- **Intuitive: 4** — Checklist-driven freeze packet; honest copy ("Nothing was mailed and no bureau was contacted. Your checklist is safe.").
- **Neon: 4** — Glow utilities present.
- **Flow: 3** — Registry marks `minAge: 18`; page relies on server-side parent assertion — fine, but no graceful underage notice in-page that I could find.
- Issues: h1 "Credit freezes" → "Credit Freezes" (P2, Title Case).

## `/c/[childSlug]/health` (Health hub)
- **Intuitive: 4** — Tier-badged sections, provenance labels, disclaimers; `TeenPrivateNotice` pattern is graceful.
- **Neon: 4** — Glow utilities present (`health-hub`, `wellbeing-view`, `sharing-health-view` use them).
- **Flow: 3** — **The hub has no in-hub links to its own subpages** (activity/meals/nutrition/wellbeing) — they are only discoverable via the More popup registry. P1 discoverability gap.
- Issues: several headings not Title Case ("Delete my health data", "Food diary", "Recent check-ins", "Your past check-ins", "How is today feeling?", "Who can see my health stuff?") (P1 batch).

## `/c/[childSlug]/health/activity`
- **Intuitive: 4** — Quick workout logging, streak view, step goal; `Button` atoms for primary actions; empty states guide.
- **Neon: 4** — Uses `Button` (btn-dapple glow); some raw toggle buttons present.
- **Flow: 4** — Via More popup; no back link to health hub.

## `/c/[childSlug]/health/meals`
- **Intuitive: 4** — Meal planning (not logging) framing is shame-free ✓; preferences view.
- **Neon: 4** — Soft amber accents at low opacity only.
- **Flow: 4** — Via More popup; no back link to health hub.

## `/c/[childSlug]/health/nutrition`
- **Intuitive: 4** — Age-tiered (descriptive for under-18, diary for 18+) — correct sensitivity.
- **Neon: 4** — Glow utilities present.
- **Flow: 4** — Via More popup; no back link to health hub.
- Issues: headings "Did you eat regularly today?", "Food diary", "Recent diary entries" not Title Case (P2).

## `/c/[childSlug]/health/review-18`
- **Intuitive: 3** — Multi-step flow (per-tier grants OFF by default, review-correct-seal, export) is well-structured, but button copy is terse ("Keep", "Save correction").
- **Neon: 3** — **Raw buttons with no hover states at all** (one has `shadow-glow-sm`, the rest are flat `bg-nova-500`/border styles). Inconsistent with the design language.
- **Flow: 3** — Non-subject (parent) view renders the privacy notice + disclaimer with **no way back** (no back link/CTA) — privacy-correct but a visual dead end. Confirm/skip-private CTAs exist in the main flow.
- Issues: P1 (dead-end for parents); P2 (button hover/glow).

## `/c/[childSlug]/health/wellbeing`
- **Intuitive: 4** — Teen-private enforcement with graceful `TeenPrivateNotice` for parents (no dead 404) ✓; steward-parent exception handled.
- **Neon: 4** — Glow utilities present.
- **Flow: 4** — Via More popup; no back link to health hub.
- Issues: headings "How is today feeling?", "Recent check-ins", "Your past check-ins" not Title Case (P2).

## `/c/[childSlug]/marketplace`
- **Intuitive: 4** — Babysitters + driving-school panels; guiding empty states ("No sitters yet — add your first").
- **Neon: 4** — `Button` atoms used for primary actions.
- **Flow: 4** — Via More popup.
- Issues: raw occasion/state selector chips (raw `<button>`, no hover: classes in either panel — hover states live only in shared Button) (P2).

## `/c/[childSlug]/pookie`
- **Intuitive: 5** — "Hailing your co-pilot" loading state, placeholder "Hail Pookie — what's on your mind, Captain?", viewer-age-gated Direct mode.
- **Neon: 5** — Input has soft box-shadow glow; send button has `shadow-glow-sm` + `hover:scale-105` + `active:scale-95`. Exemplary.
- **Flow: 5** — Toolbar orb tab; `PookieNudgeHost` present.

## `/c/[childSlug]/safety/screen-time`
- **Intuitive: 5** — Best copy in the set: "A deal you both can see", teen-proposes/parent-approves, appeal flow, "Back it up" — first-timer can follow the whole model.
- **Neon: 3** — **Only one `hover:` in the entire 700-line component, no glow utilities** — many raw buttons (propose/review/appeal) with minimal feedback. Biggest neon gap in the audit set.
- **Flow: 4** — Single-purpose page; toolbar back.
- Issues: P2 (hover/glow on all action buttons); headings "A deal you both can see", "Ask for a change", "Change requests", "Check in", "The plan" not Title Case (P2).

## `/c/[childSlug]/school`
- **Intuitive: 5** — Full dashboard: semester card, GPA, attendance, sync-health strip, classes, due-next, bell schedule, calendar, check-in; provenance labels mark school-of-record data.
- **Neon: 4** — Rich but consistent; uses shared cards.
- **Flow: 5** — Toolbar Progress tab (glow `#fbbf24`); class cards → class pages ✓.

## `/c/[childSlug]/school/[classSlug]`
- **Intuitive: 5** — Grade hero (numeric + letter side by side), Path to 90, top-3 next steps, check-in — the Dawson-dashboard pattern Mehedi loves.
- **Neon: 4** — Consistent with school overview.
- **Flow: 5** — "← All Classes" back link ✓; 404 on bad slug ✓.

## `/c/[childSlug]/school/health`
- **Intuitive: 4** — Pull-health mission control; honest about worker state ("Awaiting First Contact" instead of mock data).
- **Neon: 4** — Sync console views use glow utilities.
- **Flow: 5** — "← School Overview" back link ✓.

## `/c/[childSlug]/school/minutiae`
- **Intuitive: 4** — Calendar view of school minutiae; role-aware.
- **Neon: 4** — Consistent.
- **Flow: 4** — Reachable via school overview/More; no back link found in component.

## `/c/[childSlug]/settings`
- **Intuitive: 4** — Parent → full panel ("Ship systems"), child → scoped "My controls" — good role split.
- **Neon: 4** — `animate-bloom` stagger, `text-sunlit` headings.
- **Flow: 4** — `SettingsTabs` present on all settings pages (Profile/Family/Sharing/Sync/Workers/School logins).
- Issues: "Ship systems" → "Ship Systems", "My controls" → "My Controls", tab "School logins" → "School Logins" (P1 Title Case batch). SettingsTabs active-tab visual styling could not be verified from source — needs a visual check (P1).

## `/c/[childSlug]/settings/credentials`
- **Intuitive: 4** — School login management with masked usernames, write-only passwords, test-connection — careful security UX.
- **Neon: 4** — `LoginsView` in sync components (glow utilities present).
- **Flow: 4** — `ParentOnlyNotice` (🔒 "Parents only") is graceful, not a 404 ✓.
- Issues: "School logins" / "Parents only" not Title Case (P2).

## `/c/[childSlug]/settings/family`
- **Intuitive: 4** — Parent: members + invites; teen: independence flow — clear split.
- **Neon: 4** — Consistent.
- **Flow: 4** — SettingsTabs (child role sees tabs minus parent-only) ✓.

## `/c/[childSlug]/settings/health` (Workers)
- **Intuitive: 4** — Agent heartbeat cards; honest states.
- **Neon: 4** — `WorkersView` uses glow utilities.
- **Flow: 4** — Parent-only + SettingsTabs ✓. (H1 "Workers" under a `/health` route is slightly odd naming but harmless.)

## `/c/[childSlug]/settings/sharing`
- **Intuitive: 5** — "Who can see my stuff?" + "You decide. Change anything, anytime." — excellent plain-language framing; unbuilt domains (location) render as honest collapsed `<details>`, not fake controls ✓ (Mehedi's collapsed-by-default preference honored).
- **Neon: 4** — `card-living` details card.
- **Flow: 4** — SettingsTabs ✓; VillageCrew + consent panel inline.
- Issues: h1 not Title Case → "Who Can See My Stuff?" (P2).

## `/c/[childSlug]/settings/sync`
- **Intuitive: 4** — Sync console; parent-only.
- **Neon: 4** — `SyncConsoleView` uses glow utilities.
- **Flow: 4** — Parent-only + SettingsTabs ✓.

## `/c/[childSlug]/support/chat`
- **Intuitive: 4** — AI support chat; `?article=` context passthrough from FAQ articles ✓.
- **Neon: 4** — Consistent.
- **Flow: 5** — "← Support" back link ✓.

## `/c/[childSlug]/support/faq`
- **Intuitive: 5** — Search-first Help Center + category tree + footer cross-links ("Ask Pookie (AI chat)" · "Open a ticket") — no dead ends.
- **Neon: 4** — `FaqSearch`/`FaqTree`; tree rows are `hover:bg-nova-500/10` only (no glow).
- **Flow: 5** — Full triangle: FAQ ↔ chat ↔ tickets ✓.
- Issues: P2 (tree-row hover glow).

## `/c/[childSlug]/support/faq/[slug]`
- **Intuitive: 5** — Article template with plain-language legal explainer + citation + review dates; stale-legal flagging; related articles.
- **Neon: 4** — `legal-accordion` uses soft amber accents (low opacity ✓).
- **Flow: 5** — "← Help Center" ✓; related-article links ✓; band-gated 404 is correct.

## `/c/[childSlug]/support/tickets/[id]`
- **Intuitive: 4** — Thread view; status/SLA display.
- **Neon: 4** — Consistent cards.
- **Flow: 5** — "← Tickets" ✓.

## `/c/[childSlug]/support/tickets/new`
- **Intuitive: 4** — Form with "What can support see?" (?) helper popover — nice trust touch; submit → ticket thread.
- **Neon: 4** — Helper "?" button has no hover feedback (P2 minor).
- **Flow: 5** — "← Tickets" ✓.
- Issues: h1 "Open a ticket" → "Open a Ticket" (P2).

---

## Ranked issue list

### P0 (broken flow) — none found
No dead-end pages without recovery, no fake CTAs, no harsh/gaudy color violations in the audited set.

### P1 (confusing / rule-breaking)
1. **Title Case violations (~25 headings)** — Mehedi's non-negotiable "Title Case everywhere" is broken across: settings ("Ship systems", "My controls", "School logins" tab, "Parents only"), sharing ("Who can see my stuff?"), credit ("Credit freezes"), health ("Delete my health data", "Food diary", "Recent check-ins", "Your past check-ins", "How is today feeling?", "Did you eat regularly today?", "Recent diary entries", "Who can see my health stuff?", "Hide my past health data too", "Save your choices", "How long to keep my words", "Meal logging activity", "Take it to your new doctor", "Who should be called in an emergency?"), safety ("A deal you both can see", "Ask for a change", "Change requests", "Check in", "Emergency info", "How safety works here", "If something feels wrong", "My action plans", "Name your adult"), school ("Coming up", "Counselor conversations", "Daily log", "Files & handouts", "Teacher messages", "This week"), overview ("Course corrections", "On the horizon"), account-deleted ("This account is scheduled for deletion"), add-child labels ("Child's name", "Child's email"). Recommend a single sweep (codemod or squad pass).
2. **`/account-deleted`: no sign-out control** — copy says "Just sign out and let the date pass" but the page offers no sign-out button. Add a secondary sign-out action on the page.
3. **Health hub has no links to its own subpages** (activity/meals/nutrition/wellbeing) — discoverable only via the More popup. Add a sub-navigation row or section cards in `HealthHub`.
4. **`/health/review-18` parent view is a visual dead end** — privacy notice + disclaimer, no back link. Add "← Back" (browser-back or link to `/health`).
5. **`SettingsTabs` active-tab styling unverified** — source shows `active = pathname === t.href` but the visual treatment (glow on current section) could not be confirmed from code alone. Needs a visual/browser check.

### P2 (polish)
6. **ScreenTimeCoSet neon gap** — ~1 `hover:` in a 700-line component, no glow utilities; propose/review/appeal buttons feel flat vs. the rest of the app.
7. **review-18 raw buttons** — no hover states; bring in shared `Button` atoms or hover/glow classes.
8. **Onboarding atoms** (`PrimaryButton`/`QuietButton`/`inputClass`, reused by `/add-child`) — hover is brightness-only; inputs get border-color-only focus. Add `cta-glow`/focus glow for consistency.
9. **MorePopup module rows + faq-tree rows** — hover is border/bg only; add soft glow to match `card-living` language.
10. **Micro hover gaps** — overview-section header button, ticket-form "?" helper, marketplace selector chips, pookie-chat already fine (reference example).
11. **Sub-page back links** — health/activity, health/meals, health/nutrition, health/wellbeing, school/minutiae, coparenting, credit have no in-page back link (toolbar is the only way back). Low priority given the persistent toolbar, but a "← Health"/"← School" link would match the support/class-detail pattern.
12. **review-18 button copy** — "Keep" / "Save correction" are terse; consider "Keep as is" / "Save Correction" (also Title Case).

### Suggested verification for the parent (browser pass)
- SettingsTabs active glow; ScreenTimeCoSet buttons' actual hover rendering; review-18 parent dead-end; account-deleted sign-out flow; HealthHub discoverability from a teen account.
