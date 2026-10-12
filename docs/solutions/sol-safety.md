# Pookie Safety Solutions — Buildable Designs for Panel Safety Recommendations

**Author:** safety-systems solution designer (subagent) · 2026-10-12
**Source WHAT:** `docs/ACCESS-MODEL-REVIEW-CHECKLIST.md` (18-expert panel, 2026-10-12) + Guidance Framework Part 7 + locked access model (Mehedi, 2026-10-12)
**Scope:** Design only — the HOW. No code changes, no deploys.
**Stack assumptions:** Next.js 16 (App Router, Route Handlers, Server Actions) + Supabase (Postgres, RLS, Edge Functions) + Cloudflare Pages/Workers. Migrations continue at `022+` (`021` = `access_events`). All access enforcement server-side; RLS everywhere.
**Gates referenced:** DV-advocate review of all revoke/notify strings (launch gate); licensed-attorney sign-offs per checklist §5 (§10.2 list) — panel memo is issue-spotting, not legal advice.

> **Cross-cutting terminology.** "Teen" = 13–17 user. "Trusted adult" = teen-nominated adult (parent, other relative, counselor, coach, faith leader — adult by Pookie's age rule: 18+) who receives safety/crisis alerts and certain family-safety flows. A trusted adult is a *notification target*, never a data-access grantee — designation does NOT grant access to any record (scope firewall: see §1). "Independent" = teen whose parent access is revoked/removed.

---

## §1 · G1 — Crisis tripwire vs revoke contradiction (CRITICAL)

### The contradiction, stated precisely
- **Guidance Framework Part 7** promises: crisis language in mood pulse / check-ins / AI chat → **parent alert**.
- **Access spec** promises: revoked parents **lose all access** to the teen's records (incl. all future notifications).
- They cannot both be true. A crisis protocol that alerts a revoked parent (a) violates the access promise and possibly the teen's safety (the revoke may be an abuse-exit — §3), and (b) is exactly the surveillance leak the panel blocked in §1.4.1.

### Resolution adopted (panel fix G1)
**Crisis alerts route to the teen's *designated trusted adult* (see §4), never to a revoked parent.** A required trusted-adult designation (or explicit, informed decline) precedes any revoke / go-independent execution. The parent-tripwire language in the Guidance Framework is retired and replaced with this routing. This resolves the contradiction: the crisis protocol keeps a safety channel *open* while the access model keeps the revoke *airtight*.

### 1.1 Data model — `trusted_adults` table (NEW)

**Migration `022_trusted_adults.sql`** (create table + RLS + indexes + audit wiring).

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | gen_random_uuid() default |
| `child_profile_id` | uuid FK → `child_profiles.id` | NOT NULL; index |
| `display_name` | text | NOT NULL. What the teen calls them ("Aunt Rosa") |
| `full_name` | text | Legal-ish name for verification, see §1.3 |
| `relationship` | text | Enum-ish check: `parent / relative / counselor / coach / faith_leader / neighbor / other` |
| `contact_channel` | text | `sms / email / app_push` (one primary; see §1.4) |
| `contact_value` | text | Encrypted-at-rest (pgcrypto column-level; never logged plaintext — same standard as credential vault, checklist §Cat-7) |
| `verification_status` | text | `unverified / pending / verified / failed` default `unverified` |
| `verified_at` | timestamptz | nullable |
| `verification_method` | text | `link_code / same_room / parent_vouched / none_needed` (see §1.3) |
| `role` | text | `crisis_alert / revoke_guardian / outing_contact / all` — multi-role via join or array; see `role` enum below |
| `priority` | int | 1 = primary crisis contact; ties broken by recency of verification |
| `is_active` | bool | default true; teen deactivates (never hard-delete — audit continuity; access_events rows reference by id) |
| `is_parent` | bool | derived at insert (matches a granted parent). **A revoked parent may NOT serve as crisis routing** — constraint/trigger: `is_active=false` or role-stripped when that parent's access is revoked. A *currently-access-holding* parent may be designated (default suggestion), but designation survives only while their grant is live. |
| `teen_visible_note` | text | optional, ≤140 chars, teen-authored ("call after 5pm") |
| `created_at / updated_at` | timestamptz | |
| `created_by_grantor` | uuid FK → auth user | `granted_by`-parallel column: only the teen (or their legal steward <13) may insert/update |

**Role enum:** `crisis_alert` (receives crisis-routing alerts), `revoke_guardian` (satisfies the pre-revoke designation requirement), `outing_contact` (receives "share my plan" + overdue nudges). One row may carry multiple roles (`roles text[]` preferred over single `role` — avoids duplicate rows per purpose).

**RLS:**
- Teen (own `child_profile_id`): full CRUD on own rows.
- Parents/grantees: **no SELECT** — the list is teen-visible only (even a parent who IS a trusted adult sees only their own contact row, not the whole list; a revoked parent sees nothing). This is the "teen-controlled visibility" requirement (§4).
- `service_role` only: insert crisis-routing audit rows.

**Wiring:** `access_events` (migration 021) gets `related_trusted_adult_id` (nullable FK) and event types `trusted_adult.added / verified / deactivated / crisis_alert.sent / crisis_alert.declined_path`.

### 1.2 Designation UI flow — when it triggers

**Trigger points** (any one):
1. Teen taps "Revoke parent access" (Sharing screen) — see §3 full flow.
2. Teen taps "Go independent" (13–17) or 18+ "make private quietly".
3. First time a crisis-relevant surface activates: mood pulse first use, Wellbeing module first open, or first crisis-language detection in chat when no trusted adult exists yet (prompt is informational, not blocking — see §1.5).

**Screens (all teen-side; plain words, ≤8th-grade reading level per panel):**

**Screen A — Why you're here.**
> "Before this change goes through, you need one adult Pookie can reach in a real emergency. This adult does **not** get to see your Pookie — they only get a safety alert if you're in danger. You choose them. You can change this anytime."

Buttons: `Choose an adult` · `I don't want to name one` (decline path, §1.5).

**Screen B — Nominate.**
Fields: name, relationship (chips), how to reach them (phone # / email — phone preferred for crisis speed), note (optional). Microcopy under contact field: "We'll text them a short message to confirm this number is really theirs."
Teen taps `Send confirmation`.

**Screen C — Verification pending.** Explains: "We sent a text to [name]. They need to tap the link to confirm. You can finish choosing later — your request is saved as a draft."
If the adult verifies, designation activates and (if this flow was launched from revoke) the revoke flow continues. If 48h pass unverified → nudge teen once → teen may swap the adult or continue unverified-with-acknowledgment (see §1.5 decline).

### 1.3 Verification — "how do we know the trusted adult is real?"

Tiered by risk, all server-side:

| Method | When used | How |
|---|---|---|
| **SMS/email link-code** (default) | All nominations | 6-digit code, 15-min expiry, 5-attempt lockout (same anti-brute-force shape as §1.2.2 link codes). Confirming proves *control of the contact channel*, which is what crisis routing needs — we do not need a government-ID identity proof. Code entry happens on a zero-PI public page (`/verify-adult` — same hardening as `/verify-invite`: unguessable token, no enumeration). |
| **Parent-vouched** | Adult is an already-granted parent or listed school emergency contact | Auto-`verified` (channel already trusted by the family). |
| **Same-room** | Teen + adult together | Adult enters the code on the teen's device with an anti-coercion check ("Did [teen name] ask you to be their safety contact, freely?" — adult taps Yes; logged). Same-device flag in audit (mirrors link-code anti-coercion note). |
| **Failed** | 5 bad codes / 48h expiry / teen cancels | `verification_status=failed`; teen must re-nominate. |

**Explicitly NOT required:** identity documents, background checks. The panel's "parent-vetted, not background-checked" language (W12) is the right honesty bar — copy says "We confirmed this number belongs to [name]" not "We verified this person."

### 1.4 Crisis-routing logic

**What counts as crisis language** (server-side, versioned ruleset — `crisis_tripwire_rules` version pinned in the alert audit row so routing decisions are reproducible):

| Tier | Signals | Route |
|---|---|---|
| **T1 — Imminent-risk language** | explicit plan/means/timeline for self-harm or harm to others; "I'm going to kill myself tonight", detailed method, "goodbye" notes with plan | Trusted adult (SMS, immediate) + in-app 988/Crisis Text Line card to teen + mandatory DFCS-escalation evaluation per mandatory-reporter program (G7 — compliance owner decides, logged). **No parent notification unless the parent IS the designated trusted adult with a live grant.** |
| **T2 — Crisis-ideation language** | "I want to die", "I can't do this anymore", self-harm mention without plan | Trusted adult (SMS, within 5 min) + teen-facing 988 card + "tell a trusted adult" action (teen-controlled, §2) |
| **T3 — Pattern signals** | mood pulse 1–2 for ≥5 of 7 days; escalating negative sentiment; check-in streak of despair language | **No external alert.** Teen-facing nudge only ("This week has been heavy. Want support options?") + offer trusted-adult designation if none exists. Never parent-visible (panel: W8 never parent-visible incl. aggregates) |

Detection sources: mood pulse (W8), check-in text, AI chat disclosures. All detection is **server-side** (Worker/Edge Function), never client-side — teens can and will find client flags. AI-chat detection lives in the tutor Worker's safety middleware, not in the model prompt (prompt-level safety is bypassable).

**What the alert contains** (to the trusted adult, via SMS — crisis needs speed):
> "Pookie safety alert for [teen first name]: they may be in crisis. Please check on them now. If you believe they're in immediate danger, call 911. US: call/text 988 anytime. This is an automated alert — reply STOP to opt out of future alerts."
What it does NOT contain: no mood text, no check-in content, no chat excerpts (privacy + the panel's scope firewall; details go only to the teen's own screens).

**If the trusted adult doesn't respond:**
1. Alert logged with `delivered / undelivered` carrier status.
2. If SMS fails (undelivered) → retry email if on file → if both fail → **escalate to secondary trusted adult** (priority 2) if one exists.
3. If no verified adult reachable at all → in-app escalation to the teen: persistent crisis card with 988 + Crisis Text Line + "call 911" + option to name a new adult; logged as `crisis_alert.no_reachable_adult`.
4. **We do NOT fall back to the parent** (that reintroduces the contradiction). The one exception: a live-grant parent who is themselves the designated trusted adult — which is just normal routing.
5. Retries: T1 re-alerts the same adult at +15 min once if no acknowledgment (ack = tapping the link in the SMS, lightweight, non-blocking). T2: no re-alert.

**Staff-escalation hook:** per G7, the compliance owner + DFCS path (1-855-422-4453) is evaluated for T1; human review queue exists but Pookie is **not** a crisis-response service (W19 disclaimer language applies: "call 911 first").

### 1.5 The decline path ("I don't want to name one")

Screen: plain-language, no dark patterns (CA AB 2246 shape — no shaming, equal visual weight):
> "If you don't name an adult, here's what happens in an emergency:
> • Pookie will still show you crisis help (988, Crisis Text Line) right in the app.
> • **No adult will be told.** Not your parents, not anyone.
> • You can name someone later anytime in Settings → Safety.
>
> ☐ I understand no adult will be alerted if I'm in crisis. [checkbox, unchecked by default]"
> Buttons: `Go back and choose` (primary) · `Continue without naming anyone` (enabled only when checkbox checked)

Effect: `trusted_adults` gets a sentinel row? **No** — a decline is recorded as an `access_events` row (`crisis_alert.declined_path`, with the checkbox text version pinned) on the teen's record, teen-visible, never parent-visible. Crisis routing then = in-app resources only. The revoke flow may proceed (decline is informed, not coerced — the panel required the *option*, not compulsion).

### 1.6 Server actions / RPCs (names; exact signatures in build spec)

- `rpc_nominate_trusted_adult(p_child_profile_id, p_display_name, p_relationship, p_contact_channel, p_contact_value_enc, p_note)` → returns `{ trusted_adult_id, verification_code_issued }`. Server-side: rate-limits nominations (≤5/day/teen), encrypts contact, issues code, sends SMS/email via provider, writes `access_events(trusted_adult.added)`.
- `rpc_verify_trusted_adult(p_token, p_code)` → public-safe; lockout after 5; sets `verified`, writes audit.
- `rpc_decline_trusted_adult(p_child_profile_id, p_ack_version)` → records informed decline; requires checkbox ack version match.
- `edgefn_crisis_router` (Supabase Edge Function, service_role): consumes detection events, applies versioned ruleset, sends alerts, writes `crisis_alerts` audit table (NEW — migration 023: `id, child_profile_id, tier, ruleset_version, detection_source, trusted_adult_id, channel, sent_at, delivery_status, ack_at, teen_inapp_card_shown`).
- `rpc_send_crisis_alert` is **not** client-callable — Edge Function only.
- `rpc_revoke_grant` (existing, modified): **refuses to execute** for teen 13–17 revoke/go-independent unless `trusted_adults` has ≥1 verified `revoke_guardian`-role row OR a valid `crisis_alert.declined_path` event exists. Error copy: "Name a trusted adult (or choose 'no adult') first — this keeps a safety channel open."

### Conflict flagged
**Safety vs teen privacy (the core tension).** Any crisis-routing necessarily discloses *something* to *someone*. Resolution: (1) route to a teen-chosen adult, not a default parent — preserves the revoke promise; (2) alert content is presence-only ("may be in crisis"), never content (mood text/chat excerpts stay teen-private); (3) T3 patterns never leave the device/account. The residual risk (a trusted adult who is themselves unsafe) is mitigated by teen-controlled removal + the decline path + safe-exit (§3) — documented in the DV-advocate review gate.
**Interaction with §1.5.3:** this section *is* the §1.5.3 implementation.

---

## §2 · G2 — Crisis/safety protocol for mood pulse (W8) + check-ins + AI chat (CRITICAL, launch-blocking for Wellbeing)

### 2.1 Escalation ladder (single source of truth for all three surfaces)

| Level | Name | Trigger | Teen sees | Adult sees | Data handling |
|---|---|---|---|---|---|
| L0 | Baseline | normal use | — | — | standard retention |
| L1 | Bad day | single low mood (1–2/5) or sad check-in/AI disclosure | Empathy response + optional resources link (quiet, one-tap) | Nothing | logged as mood data |
| L2 | Pattern | L1 signals ≥5 of last 7 days, or declining 2-week trend, or repeated same-theme disclosures | "This week has looked heavy" nudge + resources + optional trusted-adult designation prompt | Nothing — **never parent-visible, incl. aggregates** (panel W8) | pattern flag teen-visible only |
| L3 | Crisis trigger | T2 ideation language (no plan/means) | 988/Crisis Text Line card (persistent until dismissed, re-surfaces per session) + teen-controlled "tell a trusted adult" action | Trusted adult SMS (T2 routing, §1.4) | crisis event logged (teen-visible audit) |
| L4 | Imminent risk | T1 plan/means/timeline | L3 + "call 911" + stay-with-me grounding flow | Trusted adult SMS immediate + staff escalation evaluation (G7/DFCS path) | crisis event logged; mandatory-reporter program engaged |
| ED-adjacent | Eating-disorder signals | food/weight/body language patterns in check-ins/mood (W23-adjacent) | NEDA resources card + weight-neutral framing; never calorie/weight-loss content <18 (panel W23) | Nothing unless L3/L4 tier met | — |

**Hard rule:** L1/L2 are *entirely* teen-side. No parent, no aggregate, no "wellness digest" line. L3/L4 route to the trusted adult only (per §1), never to a revoked parent, never auto-to-parents absent the teen's own action.

### 2.2 988 / Crisis Text Line surfacing rules

**When:** L3/L4 (persistent card), plus (a) first Wellbeing onboarding, (b) decline-path screen (§1.5), (c) safe-exit completion (§3), (d) anytime the teen types crisis-adjacent language even below T2 (soft offer).
**Where in UI:** (1) persistent crisis card pinned above mood pulse; (2) AI chat: inline resource block *inside* the conversation (not a modal — modals get dismissed); (3) check-in screen footer when L1+ detected; (4) Settings → Safety → "Get help now" always available.
**Copy (US; Georgia launch):**
> "If you're thinking about hurting yourself, you don't have to face it alone.
> **Call or text 988** — free, 24/7, confidential.
> **Text HOME to 741741** — Crisis Text Line.
> If you might act right now, **call 911**."
Design: high-contrast, no neon-on-neon, one-tap `tel:`/`sms:` links. Internationalized later per state workstream (R10).

### 2.3 Teen-controlled "tell a trusted adult" action

Available at L1+ (teen's choice, never auto-sent below L3):
- Button: `Let [adult first name] know I'm having a hard time`.
- Teen picks message tier: (a) "I'm having a hard time" (presence only), (b) + their own typed note (max 280 chars, teen-authored).
- Preview-before-send screen showing exactly what the adult receives.
- Sent via teen's chosen channel; logged to `access_events` (teen-visible).
- Copy honesty: "This sends a text from Pookie to [name]. It won't share your check-ins or chats."

### 2.4 Documented self-harm response protocol for the AI (CA SB 1119 shape)

System-level minor-safety policy (applies identically in Pookie mode and "direct mode" — panel: safety rules mode-independent; Muse "unfiltered" is 18+-gated regardless, R7):

1. **Detect** (safety middleware, server-side — see §1.4): classify T1/T2/T3.
2. **Respond** (model behavior contract, versioned):
   - T2: empathetic, non-clinical acknowledgment → resource block (988/CTL) → offer "tell a trusted adult" → continue conversation supportively. **Never**: "just between us" promises (G10 — the AI must never promise secrecy it can't keep; required line: "I'm not a person and I can't keep secrets the way a friend can — but what you tell me stays in your private space unless you're in danger").
   - T1: same + explicit 911 nudge + grounding exercise offer + "I'm going to make sure [trusted adult name] knows you need someone right now" (transparency about the alert — never silent alerting).
   - **Never**: diagnosis, therapy role-play ("as your therapist"), means/method discussion (refuse + redirect), or auto-parent-notification absent imminent risk.
3. **Route**: Edge Function fires trusted-adult alert per §1.4; in-app card persists.
4. **Record**: crisis event audit row; conversation flagged for the (future, counsel-gated) human-review queue — **no human reads it at launch** (R12: re-run mandatory-reporter analysis the moment any human/AI-read of check-in content begins).
5. **Never presents as therapist**: persistent "Pookie is an AI, not a therapist or medical professional" line in Wellbeing + chat settings (panel Cat-2).

**Disclosure policy for abuse disclosures (G10)** — teen-readable, shown at first AI-chat use and in Safety settings:
> "If you tell Pookie someone is hurting you: Pookie will listen and help you find support (like 988 or a trusted adult). Pookie won't promise to keep it secret — and won't tell your parents automatically. If you're in immediate danger, Pookie will try to get help to you fast."

### 2.5 "Private spaces are not safety-monitored" copy (explicit, launch-required)

Shown at: Wellbeing first-open, check-in first use, AI chat first use (one-time, dismissible, re-findable in Settings → Safety → "How safety works"):
> **"Your private spaces are yours.** Your moods, check-ins, and chats with Pookie are private to you — not even your parents can see them.
> **But they're not watched over.** Pookie doesn't read everything you write looking for problems. If you use words that sound like you might hurt yourself, Pookie will show you help options and — only then — may alert the trusted adult you chose. Nothing else you write is ever sent to anyone.
> **If you need help now:** call or text 988."

Honesty requirement (panel §Cat-2/G7): we say "may alert" because T1/T2 routing exists; we say "doesn't read everything looking for problems" because detection is keyword/pattern-tiered, not human review. No overclaiming either direction.

### 2.6 Build pieces
- Migration `023_crisis_protocol.sql`: `crisis_rulesets(version, rules_json, active_from)` + `crisis_events(id, child_profile_id, tier, ruleset_version, source, detected_at, inapp_card_shown_at, trusted_adult_id, alert_sent_at, teen_action_taken)` + RLS (teen: own rows read; service_role: write).
- Edge Function `crisis-router` (shared with §1.4).
- Client: `CrisisCard` component (persistent, dismissible-per-session at L3, non-dismissible at L4 until 911/988 tapped or session ends — DV-advocate reviews this interaction), `SafetyHowItWorks` explainer, `TellAdultAction` flow.
- AI: safety middleware in pookie-tutor Worker + versioned response contract doc (`docs/AI-CRISIS-PROTOCOL.md`, DV-advocate + counsel reviewed).
- **Launch gate:** Wellbeing (W8) does not ship until §§2.1–2.5 + §1 routing are live and DV-advocate has reviewed all strings (R9: gate health modules behind protocol completion).

### Conflict flagged
**Clinical safety vs "private spaces" promise.** The protocol deliberately narrows monitoring (T1/T2 language only, pattern-level stays teen-side). A teen in slow decline without crisis language gets nudges, not alerts — this is the panel's chosen trade-off (honesty punished by surveillance stops; the crisis protocol *depends* on truthful check-ins, panel §Cat-3). Documented explicitly in the "How safety works" copy so the limitation is a promise kept, not a gap discovered.

---

## §3 · G4 + §1.4.1 — Cooling-off redesign (was 🛑 BLOCKED)

**What was blocked:** 7-day cooling-off + immediate dual-parent notification = "the single most dangerous element in the spec" (surveillance continues during delay; notification endangers abuse-exit; friction on privacy choice).
**Redesign (panel's required fix), built end-to-end below.** Note: the 7-day window itself is under 6-month reassessment (R1); this design makes the window *safe* regardless of its length.

### 3.1 Design principles (non-negotiable)
1. **Default = notify at effect, only the revoked parent, never both.**
2. **Safe-exit path** for "telling my parents could put me at risk": immediate cutoff + suppressed notification + crisis resources.
3. **Parent UI shows access as UNCHANGED during pending** — no countdown banner, no "revoking in 6 days."
4. **No new parent-visible syncs during the window** — freeze parent-visible pipelines for that child's data at revoke-initiation.
5. **Safe exits are visually boring** (§1.5.1): neutral screens, no confetti, no celebration where an abuser might see the screen.

### 3.2 Step-by-step flow

**Step 0 — Entry.** Teen: Sharing screen → per-person row → `Remove access` (wording: "Remove access", not "Revoke" — less adversarial; DV-advocate confirms).

**Step 1 — Scope & consequences (required by §1.4.2).**
Screen lists, per scope (Performance / Communications / Reflection / Wellness), what the parent loses, in plain words. Includes:
- Alternatives row: "Instead of removing everything: [narrow to Performance only] [pause for 30 days] [talk it through — prompts]".
- **School-transparency line** (history/counselor, §1.4.2): "This only changes Pookie. Your school still shares grades and official messages with your parents — Pookie can't change that."
- Button: `Continue`.

**Step 2 — Trusted-adult gate (§1).** Screen A/B/C flow. Must complete with (verified adult) OR (informed decline) before proceeding. Back button allowed (no data changed yet).

**Step 3 — Notification choice.**
> "When should [Parent name] find out?
> ○ **When it takes effect** (recommended) — they see the change after it's done.
> ○ **Tell them now** — they get a message as soon as you confirm.
> Only [Parent name] is told. Your other parent isn't notified."
Default: at-effect. Copy note: "During the waiting period, what they see doesn't change."

**Step 4 — Safety screen (the safe-exit path).**
> "One more thing — your safety matters more than any setting.
> ☐ **Telling my parents about this could put me at risk.**
> If you check this: access ends **right now**, no message is sent, and we'll show you support options. You can always undo this later if things change."
- If checked → **safe-exit executes immediately** (skip to Step 6-safe).
- If unchecked → continue to Step 5.

**Step 5 — Confirm (pending state begins, standard path).**
> "You're removing [Parent]'s access to [scopes]. This takes effect [date, 7 days]. Until then, nothing they see changes. You can cancel anytime in Sharing."
- `rpc_initiate_revoke(...)` writes: `access_events(revoke.initiated)`, creates `pending_revokes` row (migration 024), **freezes parent-visible syncs** for that child (flag on child profile: `parent_sync_frozen_until`; sync workers check this flag and skip parent-destined pipelines — grades already pulled stay as-is; nothing new flows).
- Teen's Sharing screen shows: "Removing [Parent]'s access — takes effect [date]. [Cancel]". Neutral styling.
- **Parent's UI: literally unchanged.** Same data, same timestamps-as-before (frozen, not refreshed — a "last updated" label that stops advancing is itself a signal; mitigation: freeze shows the last pre-freeze timestamp with no "sync failed" error state — it reads as normal staleness, matching what a parent sees when syncs are merely idle).

**Pending-state mechanics:**
- Cancel: teen taps `Cancel` → `rpc_cancel_revoke` → row voided, freeze lifted, `access_events(revoke.cancelled)`. No notification to parent (nothing ever changed for them).
- During pending: teen may still narrow/expand scopes; each change logged.
- At effect (scheduled job, daily cron `revoke-effect-runner`): `rpc_execute_revoke` — grant row deactivated, API tokens for that grantee+child revoked (`graduate_child_access`-parallel cleanup), notification sent per Step-3 choice (at-effect default), `access_events(revoke.effected)`.
- Notification copy (at-effect, to revoked parent only): "An update on Pookie: [Teen first name] has changed their sharing settings, and you no longer have access to [their/them] Pookie records. School records are unaffected — contact the school directly for grades and official messages." Neutral, no reason given, no countdown history.

**Step 6-safe — Safe exit (immediate).**
- `rpc_safe_exit(...)`: grant deactivated **immediately**; `pending_revokes` row written with `suppressed_notification=true`; **no notification ever sent** (not delayed — suppressed); parent-visible syncs frozen permanently until teen re-grants; crisis resources card shown (988/CTL + trusted-adult confirm); `access_events(safe_exit.executed)` — **this event is teen-visible only and excluded from any parent-facing audit surface** (checklist §1.3.6: never shown to revoked parent).
- Parent's UI: access simply stops (records disappear / show "no longer shared" neutral state — same as a standard revoke's end-state, so the parent cannot distinguish safe-exit from standard revoke by UI).
- Undo: teen may re-grant later; re-grant after safe-exit triggers a gentle "are you sure? you can keep them removed" confirm (anti-coercion — mirrors link-code anti-coercion principle).

**16–17 instant path:** same screens, but Step 5 executes immediately (no 7-day pending) with the Step-3/Step-4 choices intact — notification still defaults to at-effect (which is now), safe-exit still available. The R2 tension (no developmental basis for the 16 cliff) is acknowledged in-spec; the safety properties don't depend on the cliff.

### 3.3 What the parent sees — stage table

| Stage | Standard path (parent view) | Safe-exit (parent view) |
|---|---|---|
| Initiated → pending | **Unchanged.** Same data, frozen timestamps, no banner | n/a (no pending) |
| Cancelled | Unchanged (never knew) | n/a |
| Effected | Neutral "no longer shared" state + one notification (if notify-at-effect) | Same neutral state, **no notification** |
| Post-effect | Cannot re-request for 30 days (welfare, §1.3.4); re-request goes to teen only | Same |

**Non-revoked other parent:** sees nothing at any stage (never both notified). Fact-only notification to other parent applies only to *access-request* flows (§1.3.4), not revokes.

### 3.4 Data & RPCs
- Migration `024_pending_revokes.sql`: `pending_revokes(id, child_profile_id, grantee_id, scopes_removed text[], initiated_at, effect_at, notify_mode enum('at_effect','now'), notification_sent_at, safe_exit bool default false, cancelled_at, status)`.
- `rpc_initiate_revoke`, `rpc_cancel_revue`→`rpc_cancel_revoke`, `rpc_execute_revoke` (cron-called, service_role), `rpc_safe_exit`, `rpc_regrant_access` (with post-safe-exit confirm).
- Sync-worker contract: `parent_sync_frozen_until` checked before any parent-destined write; documented in Engineering Handbook sync chapter.
- **DV-advocate review gate:** all strings in Steps 1–6 + notification copy + the retaliation matrix reviewed before launch (checklist §5 gate #4). Schedule this as a milestone dependency, not an afterthought.

### Conflict flagged
**Abuse-exit immediacy vs the 7-day developmental rationale (R1).** The safe-exit path effectively lets any teen bypass the cooling-off by checking a box — which is the point (a friction-free exit must exist), but it means the 7-day window only binds teens who *don't* feel at risk. That's the correct hierarchy (safety > developmental friction), and R1's 6-month review will show whether safe-exit clustering means the default should flip to instant-with-delayed-notification.

---

## §4 · G15 — Trusted-adult / safe-contact infrastructure

### 4.1 The persistent list
The `trusted_adults` table from §1.1 **is** the infrastructure — G15 and G1 share it by design (one list, role-tagged, rather than two parallel systems that drift). Roles: `crisis_alert`, `revoke_guardian`, `outing_contact`. Teen adds/removes; verification per §1.3; visibility teen-only (§1.1 RLS).

### 4.2 Add / verify / remove flows
- **Add:** Settings → Safety → "My trusted adults" → `Add adult` → Screen B/C flow (§1.2). Cap: 5 active adults (enough for redundancy, small enough to stay meaningful). Adding a 6th requires deactivating one.
- **Verify:** link-code flow (§1.3); status chips: `Confirmed ✓` / `Waiting for confirmation` / `Couldn't confirm — try again`.
- **Remove/deactivate:** teen taps adult → `Remove`. Immediate, no confirm-wall beyond one "Remove [name]? They won't get safety alerts anymore" (if they're the *only* crisis adult, the remove flow re-offers the decline screen — we never leave a revoke-guardian requirement silently unsatisfied; but we never block removal — removal + decline-ack is always allowed).
- **Re-verify cadence:** contact re-confirmation yearly (light nudge: "Is [name]'s number still right?"), because stale crisis contacts are worse than none.

### 4.3 Where it surfaces across the product
| Surface | Use |
|---|---|
| Revoke / go-independent flows | `revoke_guardian` role satisfies §1 gate |
| Crisis routing | `crisis_alert` role receives T1/T2 alerts (§1.4) |
| Out & About "share my plan" | `outing_contact` role = default recipient; teen picks per-plan (§5) |
| Wellbeing "tell a trusted adult" | `crisis_alert` adults offered (§2.3) |
| W19 Emergency | break-glass contact card shows teen's adults to *the teen* on their lock-screen/QR card (§6) |
| 18+ transition | emergency-contact re-designation decoupled from access grants (panel §1.6.2) reuses this list |
| Settings → Safety | the single management home ("product home for safety prompts" — G15) |

### 4.4 Copy (management screen)
> "Trusted adults — the grown-ups Pookie can reach if you're in danger. They **can't see your Pookie**. You choose them, and you can remove them anytime."

---

## §5 · §1.5.4 — Safety gate for Out & About modules (was 🛑 BLOCKED)

**Blocked shape:** independent 13–15 + AI-planned outings + no adult in loop.
**Required fix:** trusted-adult contact + 3-min Safety Basics + family-aware defaults until 16. Built below.

### 5.1 "Explorer Setup" — the one-time gate (13–15; 16–17 see a lighter version)

Triggers on first open of any Out & About module (Events W27, Trails W29, Restaurants W28, Weather W26 read-only exempt — Weather is informational; the gate applies to *going* places, but Weather shows the safety footer anyway).

**Screen 1 — Trusted-adult contact check.** "Who should get your plans when you go out?" → pick from `trusted_adults` (outing_contact role) or add one (§4). Required to proceed for 13–15; 16–17: optional-but-encouraged (family-aware default flips at 16 — see §5.3).

**Screen 2 — Safety Basics (3 minutes, interactive, not a wall of text).** Four 45-second cards, each ends with a one-tap acknowledgment:
1. **Share your plan** — "Before you go: where, with whom, when you'll be back. Pookie can text it to your trusted adult in one tap." (demo the button)
2. **Public places, daylight** — "Stick to public, populated places. Parks close at dusk — plan to be out well before dark. Trust your gut; leaving is always okay."
3. **Check in** — "Set a check-in timer. If you miss it, Pookie nudges *you* first — then your trusted adult if you don't respond." (teen controls the timer)
4. **If something feels wrong** — "Call 911 first, then your trusted adult. Your live plan is on your phone even with no signal." (offline plan card)
Completion recorded (`explorer_setup_completed_at` on child profile); under-16 cannot dismiss without completing; content versioned for DV-advocate review.

**Screen 3 — Family-aware defaults (until 16).** Auto-applied, shown as "your safety defaults — you can loosen these at 16":
- "Share my plan" pre-filled (not auto-sent — teen taps send, but the draft is always ready).
- Event/traildiscovery defaults to Family/Teen audience modes (§8).
- Coarse location only; no retained location history <18 (G14).
- Dusk guard on (90-min sunset warning, §7).

### 5.2 Gating logic per module

| Module | 13–15 gate | 16–17 | 18+ |
|---|---|---|---|
| **W27 Events** | Explorer Setup required; Teen/Family audience default; 18+/21+ filtered (invisible, not "locked"); per-event safety block (§8) | Setup-lite (review Safety Basics once); Teen default, Grown-up visible-but-flagged | Full |
| **W29 Trails** | Explorer Setup required; **no solo-hike recommendations** (§7); group-size guidance on every card; dusk check enforced (can't save a plan ending <90 min before sunset without explicit teen override + trusted-adult share) | Solo allowed with "share my plan" prompt; dusk warning (overridable) | Full |
| **W28 Restaurants** | Explorer Setup-lite (contact only); teen night-safety bias in ranking (well-lit, populated areas after dark); 21+/bar-primary excluded | Same, lighter | Full |
| **W26 Weather** | No gate (informational); safety footer always; coarse location default <18 | Same | Precise location optional |

Gating is **server-side** (RLS + RPC guards on plan-save), not UI-hiding — a 14-year-old calling the API directly gets the same refusal.

### 5.3 Family-aware defaults — what changes at 16

| Default | 13–15 | 16–17 |
|---|---|---|
| Trusted-adult outing contact | Required (blocker) | Optional (nudge) |
| Safety Basics | Full 3-min, mandatory | 60-sec refresher, skippable after first view |
| "Share my plan" | Draft pre-filled every plan; send is one tap | Available, not pre-filled |
| Audience filter (Events) | Family/Teen only | Teen default; Grown-up visible with flag |
| Solo-trail recommendations | Suppressed | Allowed with share prompt |
| Dusk guard | Hard (override requires share) | Soft warning |
| Location precision | Coarse; no history retained | Coarse default; history opt-in |

16 is the panel's cliff (R2 notes the developmental arbitrariness — acknowledged; the *direction* (more autonomy with age) is what's load-bearing, and R2's measurement plan applies).

### 5.4 "Share my plan" — first-class step (G23)

- **Voluntary, teen-controlled:** the teen composes (destination, who-with, depart/return times, transport) and taps send. Pookie never auto-shares location.
- **Recipient:** teen picks per plan (default: outing_contact trusted adult).
- **Check-in timers:** teen sets ("nudge me at 4pm"); miss → nudge teen → +15 min no response → notify the plan's recipient with the plan card ("[Name]'s plan: [place], expected back [time]. They missed their check-in."). **Overdue nudges go to the teen-chosen contact, never auto-to-parents.**
- **Offline:** plan card cached on-device (works with no signal — "even with no signal" promise from Safety Basics).
- **Data:** `outing_plans(id, child_profile_id, destination, companions, depart_at, return_at, recipient_trusted_adult_id, checkin_at, status, created_at)` — migration 025. Status: `active / completed / overdue / cancelled`. Auto-complete at return_at + 2h; rows teen-deletable; no location history retained <18 (G14 — the plan is an itinerary, not a track).

### Conflict flagged
**Teen autonomy vs community-safety liability.** The gate adds friction to exactly the "independent teen exploring" experience the product celebrates. Resolution: friction is front-loaded (one-time Setup) and the ongoing cost is one tap ("share my plan" draft pre-filled). The hard lines (no solo <16, dusk guard) are non-negotiable per the panel — liability for AI-planned minor outings is the "highest community-safety liability" in the whole spec.

---

## §6 · W19 Emergency module

### 6.1 Positioning: storage-only, never a response service
Persistent banner at the top of the Emergency module (and on every emergency card), verbatim:
> **"Pookie is not an emergency service. In an emergency, call 911 first — then use this page."**
Also in module subtitle: "Your info, ready when you need it. Not a replacement for 911."

### 6.2 Preloaded resources (Georgia launch; per-state tables from day one per panel W6 note)
Seeded reference table `emergency_resources(region_code, name, number, sms, url, sort)` — migration 026. Georgia seed:
- **911** — Emergency — call 911
- **Poison Control** — 1-800-222-1222 (call or text)
- **988 Suicide & Crisis Lifeline** — call/text 988
- **Georgia Crisis & Access Line (GCAL)** — 1-800-715-4225
- **Crisis Text Line** — text HOME to 741741
- **DFCS child-abuse reporting** — 1-855-422-4453 (G7 path, labeled "If a child is being hurt or is unsafe")
- Cobb County non-emergency police line (seed at build; verify number at seed time)
Copy honesty: "Numbers verified [date]. If one doesn't work, call 911."

### 6.3 Break-glass medical info — reachable WITHOUT parental access
**The problem** (internal medicine): an independent teen in an ER needs their medical info reachable even though parents are revoked — and a parent's phone may not be present.
**Design:**
- `emergency_medical` row per child (migration 026): blood type, allergies (hard-block list shared with W28 — never inferred), conditions, medications, pediatrician/doctor, insurance card photo (vault-standard encryption; GIPA masking rules apply — extract-then-mask for display).
- **Break-glass access:** teen generates a time-boxed QR + 6-digit code (valid 24h, single-viewer) from the Emergency module → ER staff scan → read-only medical card, no login, no Pookie account needed. Every break-glass view is audit-logged (`access_events(emergency.break_glass_viewed)`, teen-visible).
- **Independent-teen rule:** break-glass works regardless of parent access state — it reads the *teen's own* record, and parent grants are irrelevant to it. At 18+ transition, this record is explicitly re-confirmed (decoupled from access grants, §1.6.2).
- **Lock-screen/QR reachability (G25):** "Add to lock screen" generates a wallet-pass-style card (or printable QR) with: teen name, emergency contact (trusted adult), blood type, top-3 allergies, "full info: scan QR". Works with the phone locked (via wallet pass) — no Pookie login. Teen controls what's on the card (checkboxes per field).

### 6.4 Lab emergency quick-card (science)
Per class with a lab component (synced from school data — chemistry, bio, physics): a one-tap card with teacher name, room, school nurse/front-office number, and the universal lab rules (goggles, spill = tell teacher immediately, eyewash location "ask your teacher day one"). Content seeded from a template; teacher-specific numbers filled from school directory where available. Panel science requirement; lives in Emergency module + linked from the class page.

### 6.5 Action-plan templates (G25 — "storage, not a plan" fix)
Teen-fillable templates: severe allergy action plan, asthma action plan, seizure response — each: "my signs → my meds → who to call → what to tell 911". Stored encrypted; printable; shareable via break-glass QR at teen's discretion. (Templates are informational scaffolding, not medical advice — no diagnostic language, FDA wellness boundary per W2 note.)

---

## §7 · W15 Screen Time

### 7.1 13+: co-set flow (teen proposes, parent approves) + teen appeal
**Principle: always transparent, never covert** — the panel's "spyware characterization risk" kills any stealth monitoring. The teen always sees exactly what is limited, reported, and to whom.

**Co-set flow:**
1. Teen opens Screen Time → "Propose my limits": bedtime wind-down, daily app-category budgets, homework focus blocks. (Teen proposes first — agency, not imposition.)
2. Parent reviews in their view: approve / adjust-with-teen (adjustments go back to teen as a counter-proposal, not silently applied) / decline-with-reason.
3. Active plan shows identically on both sides: same numbers, same enforcement. **No parent-only dashboard, no secret reports.**
4. **Teen appeal path:** "Ask for a change" → teen writes reason → parent responds within the app (approve/deny with reason). Appeal history visible to both. If a parent ignores appeals, the plan keeps running (no auto-escalation — avoids weaponization), but the teen sees "no response yet."

**What's measured:** OS-level screen-time APIs where available (Apple Screen Time API / Android Digital Wellbeing via Health Connect-adjacent integrations), app-category budgets, schedule-based focus. **What is NOT built:** keystroke logging, content surveillance, location-gated enforcement, or any "parent sees what teen typed."

### 7.2 Under-13: device-level agents are 🛑 (COPPA)
**What's allowed instead:**
- **No Pookie device agent, no MDM profile, no background monitoring** for under-13 — technical ban (mirrors §1.1.4's server-side ban list).
- **Allowed:** (a) parent-managed routines surfaced in the *parent's* Pookie ("bedtime routine checklist" the parent runs), (b) OS-native parental controls guidance (point parents to Apple Screen Time / Google Family Link setup guides — the OS vendor is the COPPA-responsible party for device-level enforcement), (c) in-app *content* gating by age tier (what Pookie shows the child profile), which is first-party content moderation, not surveillance.
- Under-13 profiles have no login/session at all (§1.1.4) — so there is no device to agent-manage from Pookie's side anyway.

### 7.3 Transparency copy
> "Screen Time in Pookie is a deal you both can see. [Teen name] proposes, [Parent] approves, and everyone sees the same rules. Pookie never watches secretly — if it's limited, it's listed here."

---

## §8 · W29 Trails & Parks (was 🛑 for solo under-16)

### 8.1 Recommendation-card safety block (every card, every age)
Below the description, a fixed-format block — never omitted, never LLM-generated (official sources only):
> **🥾 Safety**
> Source: [Park authority name] · Updated [date]
> Difficulty: [Easy/Moderate/Hard] — [official rating]
> Best with: [group size guidance, e.g. "groups of 3+; not recommended solo under 16"]
> Supervision: [e.g. "under 16: go with an adult or group"]
> Closes at: [dusk/park hours] — plan to be out 90 min before sunset
> [Share my plan →] [Official park page →]

### 8.2 Rules engine (server-side, in the recommendation RPC)
1. **No solo-hike recommendations <16:** any trail card served to a 13–15 profile carries group-size/supervision guidance; the "solo" filter option is hidden (not footnoted — same honesty standard as W31's "hidden from teen accounts").
2. **Difficulty → supervision mapping:** official difficulty rating maps to minimum group guidance via a seeded table (`trail_safety_guidance(difficulty, min_group_13_15, min_group_16_17, notes)`); LLM never invents supervision advice.
3. **Official sources only:** park authority sites/APIs (Georgia State Parks, NPS, Cobb County Parks). No scraped blogs, no AI "I think this trail is easy." Source link + retrieved date on every card.
4. **Dusk/darkness check:** at plan-save, compute sunset for the trailhead date (astronomical calc, no LLM); if `return_at` is within 90 min of sunset → hard warning for 13–15 ("Parks close at dusk. Move your return earlier or share your plan with [trusted adult] to proceed") → override requires trusted-adult share (§5.2). 16–17: soft warning.
5. **Weather cross-check:** if NWS active alert covers the trail area (W26 feed), the card shows the alert banner with official link + timestamp — recommendation suppressed for severe alerts (tornado/wildfire/flood warnings).

### 8.3 Data
- `trails(id, name, park_authority, authority_url, difficulty_official, length_mi, group_guidance_13_15, group_guidance_16_17, closes_at_dusk bool, source_verified_at)` — migration 027. Seeded from official sources; re-verified quarterly (stale-trail job).
- `rpc_get_trails(p_child_profile_id, p_filters)` — enforces age gating server-side; returns cards with the safety block pre-rendered.

---

## §9 · W27 Events (was 🛑 as specified)

### 9.1 Published curation policy (in-app, Settings → About → "How events are chosen")
> "Every event in Pookie comes from a public ticket seller, a city or county calendar, a school, a nonprofit, or a host we've verified. We never list private-residence events or 'DM for address' meetups. Age tags come from the venue or organizer; when in doubt we tag up. Something wrong? Report it — a human reviews every report."

### 9.2 Vetting data model
**Migration 028 — `events` table:**

| Column | Notes |
|---|---|
| `id` uuid PK | |
| `title, description` | description: organizer-supplied or municipal text; AI *summaries* labeled "AI summary" |
| `venue_name, venue_address` | required; geocoded |
| `host_type` | enum: `ticketed_public / municipal / school / nonprofit / verified_host` — **NOT NULL; anything else cannot be inserted** (check constraint = the curation policy in SQL) |
| `host_verification` | for `verified_host`: `verified_at, verified_by, verification_note`; re-verified yearly |
| `age_tag` | enum: `all_ages / 13+ / 18+ / 21+` NOT NULL |
| `age_tag_source` | `organizer / venue_policy / pookie_review` — "when in doubt tag up" rule documented |
| `audience_mode` | array: `family / teen / grown_up` |
| `source` | `cobb_parks_rec / marietta_calendar / school_calendar / ticket_partner / nonprofit_feed / manual_review` |
| `source_url` | official listing link |
| `starts_at, ends_at` | |
| `is_private_residence` | bool default false + **exclusion constraint**: rows with true are rejected at insert (defense in depth beyond the host_type check) |
| `report_count, last_reviewed_at` | user reports → human review queue |
| `safety_block` | jsonb: `{well_lit, populated_area, transit_access, notes}` — filled at curation, never LLM-guessed |

**Seed sources (municipal first):** Cobb County Parks & Recreation calendar, City of Marietta events calendar, school district calendars, then ticket partners. Manual-review queue for nonprofit/verified-host submissions.

### 9.3 Filter logic (server-side, `rpc_get_events`)
- Age gate: `<18` → `18+`/`21+` rows **excluded from results** (not shown-locked). `<13` → `all_ages` + `family` only.
- Audience mode: teen's default per §5.3 (13–15: Family/Teen); switchable where age allows.
- Every card: age tag chip, host-type chip ("City of Marietta • municipal"), source link, "share my plan" button (§5.4), report button.
- Report flow: `event_reports(event_id, reporter_child_id, reason, created_at)` → human review SLA 48h → takedown or tag correction; reporter notified of outcome (teen-visible).

---

## §10 · W26 Weather

### 10.1 Sourcing law: NWS/NOAA only, never LLM-generated
- All forecast data, alerts, and watches come from api.weather.gov (NWS) — cached server-side, refreshed per NWS guidance.
- **AI may translate** ("what does a flash flood watch mean for my soccer practice?") but every AI weather answer must include: (a) link to the official NWS alert/product, (b) data timestamp ("as of 2:14 PM EDT"), (c) the sentence: "This is Pookie's plain-language take — the official alert is the source of truth."
- Server-side guard: the weather RPC returns `{nws_data, retrieved_at, alert_links[]}`; the AI layer is *forbidden* from asserting conditions not present in `nws_data` (prompt + output validation; violations logged).

### 10.2 "Not an emergency-alert system" disclaimer
On the Weather module header + every severe-weather card, verbatim:
> "Pookie shows official National Weather Service info. **Pookie is not an emergency-alert system** — for urgent warnings, use NOAA Weather Radio, Wireless Emergency Alerts on your phone, or local news."
This is liability load-bearing (checklist §5: disclaimer sufficiency under GA law is counsel-review).

### 10.3 Coarse location default for <18
- Under-18: weather resolved to ZIP/city level (coarse), never precise GPS, unless the teen 16+ opts into precise for a saved outing plan (scoped, per-plan, not retained — G14).
- No location history retained <18, period. The weather RPC takes a coarse locator; precise coordinates are rejected server-side for <18 outside an active outing plan.
- Copy: "Pookie uses your general area for weather — never your exact location."

---

## Appendix A — Migration index (new, this doc)

| # | Contents |
|---|---|
| 022 | `trusted_adults` table + RLS + indexes (§1.1, §4) |
| 023 | `crisis_rulesets`, `crisis_events`, `crisis_alerts` (§1.4, §2.6) |
| 024 | `pending_revokes` + `parent_sync_frozen_until` on child profile (§3.4) |
| 025 | `outing_plans` (§5.4) |
| 026 | `emergency_resources` seed + `emergency_medical` + break-glass audit (§6) |
| 027 | `trails` + `trail_safety_guidance` (§8) |
| 028 | `events` + `event_reports` (§9) |
| 029 | `access_events` new event types: `trusted_adult.*`, `crisis_alert.*`, `revoke.*`, `safe_exit.*`, `emergency.break_glass_viewed` (extends 021) |

## Appendix B — RPC / Edge Function index

| Name | Type | § |
|---|---|---|
| `rpc_nominate_trusted_adult` | RPC | §1.6 |
| `rpc_verify_trusted_adult` | RPC (public-safe) | §1.6 |
| `rpc_decline_trusted_adult` | RPC | §1.6 |
| `edgefn_crisis_router` | Edge Function (service_role) | §1.4, §2.6 |
| `rpc_initiate_revoke` / `rpc_cancel_revoke` / `rpc_execute_revoke` / `rpc_safe_exit` / `rpc_regrant_access` | RPCs | §3.4 |
| `rpc_get_trails` | RPC (age-gated) | §8 |
| `rpc_get_events` | RPC (age/audience-filtered) | §9 |
| weather RPC (NWS-backed) | RPC / Route Handler | §10 |

## Appendix C — Launch gates & reviews required by these designs

1. **DV-advocate review:** all revoke/notify/safe-exit strings (§3), crisis protocol strings (§2), Safety Basics content (§5.1), retaliation matrix — before launch (checklist §5 gate #4).
2. **Licensed attorney sign-offs** per checklist §5 (ToS, mandatory-reporter program, FERPA consent design, retention/litigation-hold, COPPA package, law-enforcement policy) — panel memo is not legal advice.
3. **Wellbeing (W8) launch-blocked** until §§1–2 live (§2.6).
4. **R1 6-month review:** revoke counts, delayed-notification uptake, cancellation rate, retaliation reports, safe-exit clustering → decide: keep/modify/kill cooling-off.
5. **R12 tripwire:** the moment any human (or non-safety AI read) touches check-in content, re-run the G7 mandatory-reporter analysis immediately.

## Appendix D — Conflicts resolved in this doc

| # | Conflict | Resolution |
|---|---|---|
| D1 | Crisis tripwire vs revoke promise (G1) | Alerts route to teen-chosen trusted adult; parent-tripwire retired |
| D2 | Clinical safety vs "private spaces" promise (G2) | Tiered detection; L1/L2 never leave teen-side; honest "not safety-monitored" copy |
| D3 | Abuse-exit immediacy vs 7-day developmental rationale (G4/R1) | Safe-exit bypasses the window; safety > friction; R1 measures the outcome |
| D4 | Teen autonomy vs outing liability (§1.5.4) | One-time Setup friction + one-tap plan sharing; hard lines (no solo <16, dusk guard) non-negotiable |
| D5 | Sibling/household leakage (G26, adjacent) | Trusted-adult list is per-child + teen-RLS-only; crisis alerts carry presence-only content; revoke flows never notify the non-revoked parent — each mechanism re-checked against per-child boundaries at build |
