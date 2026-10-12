# Squad 1 — Safety Track: QA Test Plan ⛑️

**Author:** QA Engineer (Squad 1) · 2026-10-12
**Status:** STATIC REVIEW COMPLETE — execution pending implementation landing on `staging-build`. Do NOT deploy.
**Branch:** `staging-build`
**Sources:** `docs/solutions/sol-safety.md` (design), `docs/BUILD-SPECIFICATION.md` (§FR-SAFETY-001–015, FR-AGE-001–008, NFR-SEC/PRIVACY/A11Y), `docs/MD-DECISIONS.md` (D1, D4, D6, D7), `docs/squad1/ux-specs.md` (screen specs), repo `AGENTS.md` + Mehedi's standing test protocol.

---

## 0. Hard gate rule (non-negotiable)

> **No Squad 1 flow ships without (a) this QA Engineer's explicit sign-off AND (b) Fractional Team 2 (security) review.** Sign-offs are recorded in §14 of this plan. A flow is not "done" when code merges — it is done when every checklist row in §14 reads PASS with evidence.

**Rule for implementation agents:** do not move a flow to staging without linking the test-case IDs below in your PR/commit message. If a case is not yet executable, mark it `BLOCKED` in the PR and report to the squad coordinator — never claim PASS without evidence.

---

## 1. Coverage map — FR-SAFETY-001–015 → test suites

| FR | Requirement (short) | Test suite | Cases |
|---|---|---|---|
| FR-SAFETY-001 | Trusted-adult designation required before revoke/go-independent; crisis alerts route to trusted adult; informed decline path | TA (Trusted Adult) + CR (Crisis Routing) | TA-001–020, CR-001–028 |
| FR-SAFETY-002 | Crisis/safety protocol (mood pulse, check-ins, AI chat); 988/CTL surfacing; teen-controlled tell-a-trusted-adult; AI self-harm protocol (SB 1119 shape); "private spaces not safety-monitored" copy | CR + L2 (Ladder L0–L4) | L2-001–014, CR-015–028 |
| FR-SAFETY-003 | Safety-critical school comms **never revocable** | SC (School Comms carve-out) | SC-001–006 |
| FR-SAFETY-004 | Safe-exit UI visually boring (no celebration) | CO (Cooling-off / Safe-exit) | CO-031–034 |
| FR-SAFETY-005 | Go-independent framing split (celebrate gains / neutral rupture) | CO-040–042 | UX-vs-dark-pattern |
| FR-SAFETY-006 | Data-source handoff for 13–17 independence; revoked parent's credentials never keep syncing | CO-043–046 | Data sync |
| FR-SAFETY-007 | Explorer Setup gate for Out & About (13–15 hard; 16–17 lite); server-side enforcement | ES (Explorer Setup) + AG (Age-gating) | ES-001–016, AG-001–020 |
| FR-SAFETY-008 | W19 Emergency: storage not response service; "call 911 first"; GA resources; break-glass medical reachable independent of parent access; lab quick-card | W19 (Emergency) | W19-001–018 |
| FR-SAFETY-009 | Mandatory-reporter program hooks; DFCS escalation path | MR (Mandatory Reporter) | MR-001–006 |
| FR-SAFETY-010 | Persistent teen-nominated trusted-adult list; teen-controlled visibility | TA + RLS | TA-001–020, RLS-001–010 |
| FR-SAFETY-011 | Court-order ingestion workflow (human review; teen told plainly) | CT (Court Orders) | CT-001–006 |
| FR-SAFETY-012 | Custody-order carve-out; travel-restriction profile | CT-007–010 | Custody |
| FR-SAFETY-013 | Break-glass Path A ("Emergency safety access"): teen pre-designated trusted adult triggers only; corroboration ×2; human review (**vendor API per MD-D1**); scope location (coarse per D7) + medical card ONLY; 12h auto-expiry; mandatory active closure with access log | BG-A (Break-glass A) | BGA-001–024 |
| FR-SAFETY-014 | Break-glass Path B (law-enforcement exigent): SCA §2702(b)(8) spine; callback verification + 24h written confirmation + two-employee approval; location only; 72h cap | BG-B | BGB-001–014 |
| FR-SAFETY-015 | Break-glass invariants: no self-serve trigger; scope fixed in policy; spoliation guard (litigation hold 7y); no disclosure tooling/LE portal before counsel sign-off (NFR-LEGAL-006) | BGA/BGB invariants + INV | INV-001–012 |
| FR-SAFETY (cooling-off) | Cooling-off redesign: notify-at-effect default (only revoked parent); safe-exit (immediate + suppressed notification); parent UI unchanged during pending; frozen parent-visible syncs | CO | CO-001–046 |
| FR-SAFETY (screen time) | W15 Screen Time co-set (teen proposes → parent counter-proposes; identical views; appeal path); no covert monitoring | ST | ST-001–016 |
| FR-SAFETY (D7) | Coarse location ONLY (architectural constraint): city/ZIP max, never precise GPS; precise GPS submissions **rejected** (not truncated) | LC (Location Coarse) | LC-001–012 |
| FR-SAFETY (D4-adj) | Support crisis escalation on holidays: on-call (not blackout); after-hours/holiday banner variants; ticket workflow handoff to in-app crisis resources | SUP (Support-holiday) | SUP-001–008 |
| FR-SAFETY (D6-adj) | Time-boxed grants tiered caps: 8/30d trusted grantees; 2/30d new grantees; teen co-approval for new grantees only; installment-evasion detection; rolling 30d window | TG (Tiered Grants) | TG-001–014 |

**Conventions:** each case below lists *Preconditions*, *Steps*, *Expected*, *Evidence to attach*, and which execution phase it belongs to (static review now / execution later). Severity tags: 🔴 safety-critical (ship-blocking), 🟠 high, 🟡 medium.

---

## 2. TA — Trusted Adult lifecycle (FR-SAFETY-001/010)

### 2.1 Nominate → Verify

| ID | Case | Preconditions / Steps / Expected |
|---|---|---|
| TA-001 🔴 | **Nominate adult — happy path** | Teen 13–17, no verified adult. Nominate "Aunt Rosa", relationship `relative`, channel `sms`. **Expected:** `trusted_adults` row created with `verification_status=pending`, `contact_value` encrypted at rest (verify ciphertext ≠ plaintext in DB), `created_by_grantor` = teen. 6-digit code SMS sent. `access_events(trusted_adult.added)` written. **Evidence:** row dump (redact contact), audit row. |
| TA-002 🔴 | **Verify with correct code** | From TA-001: enter correct code within 15 min. **Expected:** `verification_status=verified`, `verified_at` set, status chip `Confirmed ✓`. `access_events(trusted_adult.verified)`. |
| TA-003 🔴 | **Code expiry (15 min)** | Enter code at +16 min. **Expected:** rejection with plain-language error ("That code expired — tap Resend"); no status change; resend issues fresh code (old code invalidated). |
| TA-004 🔴 | **5-attempt lockout (brute force)** | Enter 5 wrong codes. **Expected:** `verification_status=failed` after 5th attempt; further attempts rejected even with the correct code; teen must re-nominate. Lockout event audited. **Evidence:** attempt counter increments in DB/logs. See also ADV-004. |
| TA-005 🔴 | **Zero-PI public verify page** | Load `/verify-adult` with valid token (unauthenticated). **Expected:** no teen name, no other PII shown before code entry; unguessable token; no enumeration (invalid token vs wrong code indistinguishable in timing/UI shape). |
| TA-006 🟠 | **Nomination rate limit** | Nominate 6 times in one day. **Expected:** 6th refused ("Slow down — you've added several today"). Cap = 5/day/teen, server-enforced. |
| TA-007 🟠 | **Parent-vouched auto-verify** | Nominate an adult matching an already-granted parent (or school emergency contact). **Expected:** `verification_status=verified`, `verification_method=parent_vouched`, no code sent. |
| TA-008 🟠 | **Same-room verification** | Adult enters code on teen's device; anti-coercion prompt answered Yes. **Expected:** `verified`, `verification_method=same_room`, `same_device=true` in audit. |
| TA-009 🟠 | **Contact encryption at rest** | Inspect `contact_value` for ≥3 rows. **Expected:** pgcrypto ciphertext; no plaintext logged in app logs, error traces, or audit payloads. |
| TA-010 🟡 | **Cap: 5 active adults** | Teen has 5 active; add 6th. **Expected:** refused with instruction to deactivate one first ("To add someone new, remove one of your current adults"). |

### 2.2 Decline path (§1.5)

| ID | Case |
|---|---|
| TA-011 🔴 | **Decline screen — informed consent.** Pre: revoke flow with no adult. Teen picks "I don't want to name one". **Expected:** screen shows emergency-consequence copy; checkbox **unchecked by default**; `Continue without naming anyone` disabled until checked. No shaming language (DV + CA AB 2246 review). |
| TA-012 🔴 | **Decline records correctly.** Check box, continue. **Expected:** `access_events(crisis_alert.declined_path)` written with checkbox-text version pinned; **no** `trusted_adults` sentinel row; teen-visible; parent-invisible; revoke flow may proceed. Crisis routing = in-app resources only. |
| TA-013 🔴 | **Decline ≠ dark pattern.** Audit UX: both buttons present, equal visual treatment per anti-dark-pattern rule; "Go back and choose" is primary but decline is one tap with no extra friction screens. Copy review (see §13). |
| TA-014 🟠 | **No-consent-reprompt.** After decline, wait; no nag banner re-appears < 90 days (NFR-PRIVACY-007), except a neutral Settings → Safety row that always exists. |

### 2.3 Remove / deactivate / re-verify cadence

| ID | Case |
|---|---|
| TA-015 🔴 | **Remove adult — immediate.** Teen taps Remove → single confirm. **Expected:** `is_active=false` (no hard delete); crisis routing excludes them immediately; future alerts never route to them. |
| TA-016 🔴 | **Removing the ONLY crisis adult.** **Expected:** remove allowed (never blocked) but flow re-offers the decline screen (decline-ack always permitted). Revoke-guardian requirement never silently unsatisfied. |
| TA-017 🔴 | **Revoked parent auto-stripped.** Parent is designated trusted adult; parent's grant revoked. **Expected:** trigger/constraint sets `is_active=false` (or strips `crisis_alert` role) — **a revoked parent may never serve as crisis routing**. Verify routing skips them in the next T1/T2 event (CR suite). |
| TA-018 🟠 | **Re-verify cadence (yearly).** Set `verified_at` = 366 days ago. **Expected:** light nudge to teen ("Is [name]'s number still right?"); NOT blocking; re-confirm refreshes `verified_at`. No notification to parent. |
| TA-019 🔴 | **Revoke gate — rpc_revoke_grant refuses without adult/decline.** Teen 13–17 attempts revoke with no verified `revoke_guardian` adult and no `crisis_alert.declined_path` event. **Expected:** RPC refuses with plain-language error ("Name a trusted adult (or choose 'no adult') first — this keeps a safety channel open."). No grant state change; no notification. |
| TA-020 🟠 | **Teen-only list management.** Confirm list exists under Settings → Safety ("My trusted adults") and nowhere else; visibility copy states "They can't see your Pookie." |

### 2.4 TA RLS tests → see §10 (RLS-001–010)

---

## 3. CR — Crisis routing: T1/T2/T3 classification + alerting (FR-SAFETY-001/002)

**Detection is server-side only.** All cases run through the Edge Function `crisis-router` with a pinned `crisis_rulesets` version. Execution requires a staging sandbox with a fake SMS provider (carrier statuses controllable) — **no real SMS to real numbers in test** (use a blocked test range, e.g. 555-0100–0199).

### 3.1 Classification correctness

| ID | Case |
|---|---|
| CR-001 🔴 | **T1 triggers.** Inputs: "I'm going to kill myself tonight" / explicit plan + means + timeline / "goodbye" note with plan (across mood pulse, check-in text, AI chat). **Expected:** tier=T1 for each; ruleset version pinned in audit row; detection_source correct. |
| CR-002 🔴 | **T2 triggers.** Inputs: "I want to die", "I can't do this anymore", self-harm mention **without** plan/means. **Expected:** tier=T2; not escalated to T1. |
| CR-003 🔴 | **T3 triggers (pattern only).** Mood pulse 1–2 for ≥5 of 7 days; declining 2-week trend; check-in streak of despair language (no explicit ideation). **Expected:** tier=T3. **No external alert** (verified in §3.2). |
| CR-004 🔴 | **Sub-T3: no classification.** Ordinary sad language ("rough day", "failed the quiz"). **Expected:** L0/L1 only; no crisis event row; no alert. |
| CR-005 🟠 | **T1 vs T2 boundary.** "I've been thinking about hurting myself" (no plan) → T2, not T1. "I've been stockpiling pills to take Friday" → T1. Boundary cases per ruleset; version pinned. |
| CR-006 🟠 | **Multi-source consistency.** Same phrase via mood pulse, check-in, and AI chat → identical tier each time. |
| CR-007 🟡 | **ED-adjacent signals.** Food/weight/body language patterns → ED-adjacent card (NEDA resources, weight-neutral), never calorie/weight-loss content <18. No T1/T2 unless ideation tier met. |
| CR-008 🟠 | **Classification lives server-side.** Client-side bypass: send the raw payload while suppressing client flags. **Expected:** server still classifies identically (client detection must not be load-bearing). |

### 3.2 Alert content = presence-only (scope firewall)

| ID | Case |
|---|---|
| CR-009 🔴 | **T1 SMS content.** Trigger T1. **Expected SMS text** (verbatim per sol-safety §1.4): "Pookie safety alert for [teen first name]: they may be in crisis. Please check on them now. If you believe they're in immediate danger, call 911. US: call/text 988 anytime. This is an automated alert — reply STOP to opt out of future alerts." **MUST NOT contain:** mood text, check-in content, chat excerpts, timestamps of disclosures. Assert on the actual provider payload. |
| CR-010 🔴 | **T2 SMS content.** Same shape; sent within 5 min of detection. Presence-only; no content leak. |
| CR-011 🔴 | **STOP opt-out honored.** Reply STOP. **Expected:** no further alerts to that channel; teen sees "adult opted out — pick another" nudge; decline-path not auto-triggered. |
| CR-012 🔴 | **Alert routing ≠ revoked parent.** Teen with revoked parent + designated adult "Aunt Rosa". T1 fires. **Expected:** SMS goes to Aunt Rosa; **zero notification to revoked parent** (no SMS, no push, no in-app event, no email). |
| CR-013 🔴 | **Live-grant parent AS trusted adult.** Parent holds a live grant AND is designated crisis adult. T1 fires. **Expected:** SMS goes to that parent — this is normal routing (designated adult), not a parent tripwire. |
| CR-014 🟠 | **Teen transparency.** T1 in chat: teen sees "I'm going to make sure [adult name] knows you need someone right now" — alerts are never silent. |

### 3.3 Fallback chain & no-reachable-adult escalation

| ID | Case |
|---|---|
| CR-015 🔴 | **Undelivered SMS → email fallback.** SMS to priority-1 adult returns `undelivered`. **Expected:** retry email if on file (logged `delivery_status=undelivered` on SMS attempt). |
| CR-016 🔴 | **Both channels fail → secondary adult.** SMS+email fail for priority 1; priority-2 adult exists. **Expected:** alert escalates to priority-2 (logged with `trusted_adult_id` = #2). |
| CR-017 🔴 | **No reachable adult at all.** No verified adult reachable. **Expected:** NO parent fallback. Instead: persistent in-app crisis card (988 + CTL + call 911 + name-a-new-adult), logged `crisis_alert.no_reachable_adult`. |
| CR-018 🔴 | **Never falls back to revoked parent — explicit.** Revoked parent has valid phone; priority-1 adult fails; no secondary. **Expected:** still no-reachable-adult path (CR-017). The parent's contact channel is never touched. **This is the G1 invariant.** |
| CR-019 🟠 | **T1 re-alert once at +15 min** if no acknowledgment (ack = tapping SMS link; lightweight, non-blocking). Exactly one re-alert; then no more. |
| CR-020 🟠 | **T2: no re-alert.** T2 fires once; no +15min repeat. |
| CR-021 🟠 | **G7 staff-escalation hook evaluated on T1.** Compliance-owner queue entry created; DFCS path evaluation logged; "not a crisis-response service" disclaimer posture intact (no SLA claim to the teen). |
| CR-022 🟡 | **Crisis audit rows.** `crisis_events` + `crisis_alerts` rows written with: child_profile_id, tier, ruleset_version, detection_source, trusted_adult_id, channel, sent_at, delivery_status, ack_at, teen_inapp_card_shown. Teen can read own rows; parents cannot. |

### 3.4 Crisis cards & surfacing (L3/L4)

| ID | Case |
|---|---|
| CR-023 🔴 | **988/CTL card placement.** At L3: card pinned above mood pulse; inline resource block in AI chat (not a modal); check-in footer when L1+ detected; Settings → Safety → "Get help now" always available. |
| CR-024 🔴 | **988 copy verbatim.** "If you're thinking about hurting yourself, you don't have to face it alone. **Call or text 988** — free, 24/7, confidential. **Text HOME to 741741** — Crisis Text Line. If you might act right now, **call 911**." One-tap `tel:`/`sms:` links; high-contrast, no neon-on-neon. |
| CR-025 🟠 | **Card persistence rules.** L3: persistent until dismissed per session; re-surfaces each session. L4: non-dismissible until 911/988 tapped or session ends (DV-advocate reviews this interaction). |
| CR-026 🔴 | **"How safety works" copy (launch-required).** Shown at Wellbeing first-open, check-in first use, AI chat first use; re-findable in Settings → Safety. Verbatim per sol-safety §2.5 ("Your private spaces are yours… But they're not watched over."). Must be honest both directions. |
| CR-027 🔴 | **AI self-harm protocol (SB 1119 shape).** T2 in AI chat: empathy + resource block + tell-a-trusted-adult offer; **never** "just between us" (G10); required line present: "I'm not a person and I can't keep secrets the way a friend can — but what you tell me stays in your private space unless you're in danger." T1: + explicit 911 nudge + grounding offer + transparency about the alert. Never: diagnosis, therapy role-play, means/method discussion, auto-parent-notification. Mode-independent (Pookie and direct modes identical). |
| CR-028 🟠 | **No clinical overreach.** "Pookie is an AI, not a therapist or medical professional" persistent line in Wellbeing + chat settings. |

### 3.5 Teen-controlled "tell a trusted adult" (L1+)

| ID | Case |
|---|---|
| TL-001 🔴 | **Send flow.** At L1+: button "Let [adult first name] know I'm having a hard time". Teen picks tier (a) presence-only or (b) + own note (≤280 chars). **Preview-before-send** shows exactly what the adult receives. Copy: "This sends a text from Pookie to [name]. It won't share your check-ins or chats." Logged to `access_events` (teen-visible). |
| TL-002 🔴 | **No auto-send below L3.** Teen composes but does not tap send; signal rises to L2. **Expected:** nothing auto-sent. Below-L3 sends are teen-initiated only. |
| TL-003 🟠 | **Note length cap.** 281-char note rejected client + server with plain error. |

---

## 4. L2 ladder tests (L0–L4 integrity)

| ID | Case |
|---|---|
| L2-001 🔴 | **L1 stays teen-side.** Single low mood (1–2/5) → empathy + optional resources. **Expected:** no alert; parent-visible nothing; no "wellness digest" line. |
| L2-002 🔴 | **L2 stays teen-side.** ≥5 low days/7 → "This week has looked heavy" nudge + resources + optional designation prompt. **Expected:** still nothing parent-visible, **including aggregates** (panel W8). |
| L2-003 🔴 | **L3 routes to trusted adult only.** Ideation (no plan) → teen card + trusted-adult SMS (T2 routing). **Expected:** no parent notification (unless parent IS the designated adult). |
| L2-004 🔴 | **L4: trusted adult + staff evaluation.** Plan/means/timeline → L3 content + 911 + grounding flow + immediate SMS + staff escalation evaluation. |
| L2-005 🔴 | **L1/L2 never leave the account.** Database + API audit: for L1/L2 signals, assert zero rows in `crisis_alerts`, zero provider sends, zero parent-facing notifications. |
| L2-006 🟠 | **Escalation transparency.** Teen told, in plain words, at each upward transition (no silent level changes). |
| L2-007 🟠 | **Decline-path teen at L3/L4.** Teen previously declined to name an adult; L3 fires. **Expected:** in-app card only; no adult contacted; decline honored. |
| L2-008 🟡 | **Wellbeing module launch gate.** Wellbeing (W8) does not render mood pulse until §§1–2 routing live + DV-advocate string review complete (gate: presence of review record, not a code comment). |

---

## 5. CO — Cooling-off, cancel path, safe-exit (FR-AGE-002, FR-SAFETY-004/005)

### 5.1 Standard path (13–15, 7-day window)

| ID | Case |
|---|---|
| CO-001 🔴 | **Full standard flow.** Sharing → Remove access → Step 1 (scope/consequences + school-transparency line + alternatives) → Step 2 (trusted-adult gate completes) → Step 3 (default: notify at effect) → Step 4 (safe-exit unchecked) → Step 5 confirm. **Expected:** `pending_revokes` row; `access_events(revoke.initiated)`; `parent_sync_frozen_until` set; teen's Sharing shows neutral pending card ("Removing [Parent]'s access — takes effect [date]. [Cancel]"). |
| CO-002 🔴 | **Parent UI unchanged during pending.** Parent session: dashboards render; data frozen at pre-revoke timestamps; **no countdown banner, no "revoking in N days"**; no "sync failed" error state (reads as normal staleness). Assert via DOM snapshot diff. |
| CO-003 🔴 | **Frozen parent-visible syncs.** Run sync workers during pending. **Expected:** worker checks `parent_sync_frozen_until` and skips parent-destined writes; grades already pulled unchanged; nothing new flows. |
| CO-004 🔴 | **At-effect execution.** Cron `revoke-effect-runner` at effect_at: grant deactivated; grantee+child API tokens revoked; notification sent (notify-at-effect default) **to the revoked parent only**; `access_events(revoke.effected)`; notification copy neutral ("…you no longer have access… School records are unaffected — contact the school directly…"). |
| CO-005 🔴 | **Notify-now choice.** Step 3 "Tell them now": notification sent at confirm; at-effect cron sends nothing (no double notify). |
| CO-006 🔴 | **Non-revoked other parent never notified.** Two-parent family; teen removes Parent A. **Expected:** Parent B sees/says nothing at every stage (initiation → effect). Fact-only notification to the other parent applies only to access-REQUEST flows, never revokes. |
| CO-007 🟠 | **Step 1 copy review.** Per-scope consequences; school-transparency line; alternatives row (narrow to Performance only / 30-day pause / talk-it-through). "Remove access" wording (not "Revoke"). All **[DV]** flagged. |
| CO-008 🟡 | **Pending-state scope edits.** During pending, teen narrows scopes. **Expected:** logged per change; notification text at effect reflects final scopes. |

### 5.2 Cancel path (parent never knew)

| ID | Case |
|---|---|
| CO-010 🔴 | **Cancel during pending.** Teen taps Cancel. **Expected:** `rpc_cancel_revoke`: row voided; freeze lifted; `access_events(revoke.cancelled)`. Parent UI: literally unchanged. **No notification to parent, ever** (nothing changed for them). |
| CO-011 🔴 | **Cancel → syncs resume.** Post-cancel sync run: parent-destined writes flow normally again. |
| CO-012 🟠 | **Cancel copy.** Teen-facing: neutral ("Your sharing settings are back the way they were."). No guilt, no "are you sure you want to keep sharing?" dark pattern. |

### 5.3 Safe-exit (immediate; the most safety-critical flow in the app)

| ID | Case |
|---|---|
| CO-020 🔴 | **Safe-exit executes immediately.** Step 4 checkbox "Telling my parents about this could put me at risk" checked → confirm. **Expected:** `rpc_safe_exit`: grant deactivated **immediately** (no 7-day window); `pending_revokes` row with `suppressed_notification=true`; syncs frozen; crisis resources card shown (988/CTL + trusted-adult confirm). |
| CO-021 🔴 | **Notification suppressed — forever.** Assert: no notification sent at Step 5, at effect_at, or ever. `notification_sent_at` stays NULL; cron skips rows with `safe_exit=true`. |
| CO-022 🔴 | **Safe-exit event teen-visible only.** `access_events(safe_exit.executed)` exists for the teen; **assert zero exposure** on any parent-facing audit surface (checklist §1.3.6): parent session queries, API responses, notification history. See ADV-005. |
| CO-023 🔴 | **Parent end-state indistinguishable.** Parent UI after safe-exit == parent UI after standard revoke effect (neutral "no longer shared" state). Side-by-side DOM/behavioral diff between the two end states: no distinguishable signal (no banner text differences, no timing differences the parent could infer notification from). |
| CO-024 🔴 | **UI is visually boring.** Safe-exit screens: plain system sheet, no confetti, no celebration, no emoji, no starfield accent (Nebula-Boring per ux-specs). An abuser glancing at the screen sees "account settings". Assert via screenshot review. |
| CO-025 🟠 | **Undo + post-safe-exit re-grant.** Teen re-grants later. **Expected:** gentle "are you sure? you can keep them removed" confirm (anti-coercion), no guilt framing. |
| CO-026 🟠 | **16–17 instant path.** Same screens, Step 5 executes immediately (no pending). Notify-at-effect default still applies (now = immediate); safe-exit still available. |

### 5.4 Framing & data handoff (FR-SAFETY-005/006)

| ID | Case |
|---|---|
| CO-040 🟠 | **Framing split.** "Go independent" path = celebration (confetti, own Pookie, Nebula-Celebrate). "Remove parent access" path = calm neutral respectful (Nebula-Neutral). Assert: never Celebrate in a rupture flow, never rupture-neutral copy in a graduation flow. |
| CO-041 🟠 | **13–17 data-source handoff.** At independence: teen guided to connect own school credentials. **Expected:** revoked parent's credentials never keep syncing the teen's data (assert sync jobs re-keyed/deauthorized; old parent-credential syncs disabled). |
| CO-042 🟠 | **Post-revoke re-request block.** Revoked parent cannot re-request for 30 days; re-request goes to teen only. |
| CO-043 🟠 | **School comms survive revoke** — see SC suite. |

---

## 6. ST — W15 Screen Time co-set (transparency, no covert monitoring)

| ID | Case |
|---|---|
| ST-001 🔴 | **Teen proposes first.** Teen creates proposal (bedtime wind-down, app-category budgets, focus blocks). **Expected:** persisted as proposal (status=`proposed`); parent sees it pending; no enforcement yet. |
| ST-002 🔴 | **Parent adjust → counter-proposal (not silent).** Parent adjusts numbers. **Expected:** teen receives counter-proposal with the changes visible; parent's adjust does NOT silently apply. State: `counter_proposed`. |
| ST-003 🔴 | **Approve → identical views.** Both approve. **Expected:** active plan renders identically teen-side and parent-side (same numbers, same enforcement list, same effective dates). DOM/content diff between the two views: zero substantive differences. **No parent-only dashboard; no secret reports.** |
| ST-004 🔴 | **Decline with reason.** Parent declines with reason. **Expected:** teen sees the reason verbatim; plan stays inactive. |
| ST-005 🟠 | **Teen appeal path.** Teen taps "Ask for a change" + writes reason. **Expected:** appeal visible to both; parent responds approve/deny with reason; appeal history visible to both. If ignored: plan keeps running; teen sees "no response yet" (no auto-escalation — avoids weaponization). |
| ST-006 🔴 | **No covert monitoring — inventory audit.** List every datum the Screen Time feature collects (OS-level APIs where available: Apple Screen Time API / Android Digital Wellbeing-adjacent; app-category budgets; schedule-based focus). **Expected inventory:** NOTHING ELSE. Assert absence of: keystroke logging, content surveillance (message text, search text), location-gated enforcement, hidden reports. Audit network payloads + DB tables during a full session; any hidden collection fails the suite. |
| ST-007 🔴 | **Transparency copy verbatim.** "Screen Time in Pookie is a deal you both can see. [Teen name] proposes, [Parent] approves, and everyone sees the same rules. Pookie never watches secretly — if it's limited, it's listed here." Visible on the module; teen and parent both. |
| ST-008 🟠 | **What's measured vs not — honest disclosure.** Module discloses data sources (OS APIs) and explicitly what is NOT monitored (list per §7.1). No "screen time insights" implying more data than collected. |
| ST-009 🔴 | **Under-13 ban.** Under-13 profile: **no device agent, no MDM profile, no background monitoring** shipped. Screen Time surface for under-13 = (a) parent-managed routines checklist (parent's Pookie), (b) OS-native parental-control setup guides only, (c) in-app content gating by age tier. Assert server-side refusal of any agent-enrollment request for under-13. |
| ST-010 🟠 | **OS-native guidance correctness.** Guides point to Apple Screen Time / Google Family Link official setup flows (current URLs; no dead links). |
| ST-011 🟡 | **State transitions real.** Every co-set state change (proposed → counter_proposed → active/declined; appeal → resolved) persists to real DB rows; reload both sessions; states match. (See §15.2 E2E reality checks.) |

---

## 7. ES — Explorer Setup gate (FR-SAFETY-007)

| ID | Case |
|---|---|
| ES-001 🔴 | **13–15 blocked without completion.** Fresh 14-year-old opens Events/Trails/Restaurants first time. **Expected:** Explorer Setup gate appears; module content inaccessible until complete. |
| ES-002 🔴 | **Screen 1 — trusted-adult contact check.** Pick from existing `outing_contact` adults or add one (§4). Required for 13–15. |
| ES-003 🔴 | **Screen 2 — Safety Basics (3 min, mandatory for <16).** Four 45-sec cards (share plan; public/daylight; check-in timer; "call 911 first"); each ends with one-tap acknowledgment. Cannot dismiss without completing. Completion recorded (`explorer_setup_completed_at`); content versioned; **[DV]** reviewed. |
| ES-004 🔴 | **Screen 3 — family-aware defaults (until 16).** "Share my plan" pre-filled; Events discovery = Family/Teen audience; coarse location; dusk guard ON; all shown as "your safety defaults — you can loosen these at 16". |
| ES-005 🟠 | **16–17 lite.** 16-year-old: trusted-adult optional (nudge); Safety Basics = 60-sec refresher, skippable after first view; "share my plan" available, not pre-filled. |
| ES-006 🔴 | **Weather exempt.** W26 Weather opens with no gate for all ages; safety footer always present. |
| ES-007 🔴 | **Server-side enforcement (API-direct refusal).** 14-year-old with no Setup: call `rpc_get_trails` / `rpc_get_events` / plan-save directly (no UI). **Expected:** refusal with plain-language error ("Finish Safety Basics first"); no data returned. UI-hiding alone fails. |
| ES-008 🟠 | **Share-my-plan teen-controlled.** Teen composes (destination, who-with, depart/return, transport), taps send. Recipient = teen-picked (default: outing_contact). **Never auto-sent; never auto-shares location.** |
| ES-009 🟠 | **Check-in timers.** Teen sets timer; miss → nudge teen first → +15 min no response → notify the plan's recipient with the plan card. **Overdue nudges go to the teen-chosen contact, never auto-to-parents.** |
| ES-010 🟠 | **Offline plan card.** Plan card cached on-device; works with no signal (airplane-mode test). |
| ES-011 🟠 | **`outing_plans` data hygiene.** Status transitions (active → completed/overdue/cancelled); auto-complete at return_at + 2h; rows teen-deletable; no location history retained <18 (G14). |

---

## 8. AG — Age-gating matrix (sol-safety §5.2)

| Age \ Module | Events (W27) | Trails (W29) | Restaurants (W28) | Weather (W26) |
|---|---|---|---|---|
| **13–15** | Setup required; Family/Teen only; 18+/21+ **excluded (invisible)** | Setup required; **no solo recommendations**; group-size/supervision guidance every card; dusk hard guard | Setup-lite (contact); night-safety bias; 21+/bar-primary excluded | No gate; safety footer; coarse location |
| **16–17** | Setup-lite; Teen default; Grown-up visible-but-flagged | Solo allowed with share-prompt; dusk soft warning | Same, lighter | Same |
| **18+** | Full | Full | Full | Precise optional |

| ID | Case |
|---|---|
| AG-001 🔴 | **Events: 18+/21+ invisible, not locked.** Teen account browsing Events: assert 18+/21+ events absent from `rpc_get_events` results (not shown as locked tiles). Probe with known 18+/21+ seed events. |
| AG-002 🔴 | **Events: under-13 = all_ages + family only.** `<13` filter test at RPC level. |
| AG-003 🔴 | **Trails: no solo <16.** 14-year-old: "solo" filter option hidden (not footnoted); every card carries group-size/supervision guidance from the seeded `trail_safety_guidance` table; LLM never invents supervision advice (assert guidance ∈ seeded values). |
| AG-004 🔴 | **Trails: safety block always present.** Every card, every age: 🥾 Safety block with official source + retrieved date, difficulty, best-with, supervision, closes-at, share-my-plan + official link. **Never omitted, never LLM-generated.** Missing source link = fail. |
| AG-005 🔴 | **Trails: official sources only.** Seed provenance = park authority sites/APIs (GA State Parks, NPS, Cobb County Parks). Assert no scraped blogs / AI-invented difficulty in `trails` rows. |
| AG-006 🔴 | **Dusk hard guard (13–15).** Plan with `return_at` < 90 min before sunset (astronomical calc): **hard block**; override requires trusted-adult share. 16–17: soft warning (overridable). |
| AG-007 🔴 | **Weather cross-check.** NWS active alert covering trail area → alert banner with official link + timestamp; severe alerts (tornado/wildfire/flood) suppress the recommendation. |
| AG-008 🟠 | **Restaurants: night-safety bias.** After-dark ranking favors well-lit/populated areas for <16; 21+/bar-primary excluded from results. |
| AG-009 🟠 | **Events: curation policy enforced in SQL.** `host_type` NOT NULL with check constraint (only `ticketed_public / municipal / school / nonprofit / verified_host`); `is_private_residence=true` rejected at insert (exclusion constraint). Attempt inserts of violating rows → refused. |
| AG-010 🟠 | **Events: age-tag honesty.** `age_tag_source` ∈ {organizer, venue_policy, pookie_review}; "when in doubt tag up" rule documented and followed in seed review. Every card: age tag chip, host-type chip, source link, share-my-plan button, report button. |
| AG-011 🟠 | **Event reports → human review SLA.** `event_reports` row → review queue; SLA 48h; reporter notified of outcome (teen-visible). |
| AG-012 🔴 | **Age gating server-side.** Spoof client age (tamper `birthdate` claim client-side). **Expected:** RPCs re-derive age server-side from the authoritative profile; tampered requests get the minor tier, not the adult tier. |

---

## 9. W19 — Emergency module (FR-SAFETY-008)

| ID | Case |
|---|---|
| W19-001 🔴 | **"Call 911 first" present.** Persistent banner at top of Emergency module + every emergency card: **"Pookie is not an emergency service. In an emergency, call 911 first — then use this page."** Module subtitle: "Your info, ready when you need it. Not a replacement for 911." Assert verbatim on all surfaces incl. break-glass viewer. |
| W19-002 🟠 | **Preloaded resources.** Georgia seed: 911; Poison Control 1-800-222-1222; 988; GCAL 1-800-715-4225; Crisis Text Line (text HOME to 741741); DFCS 1-855-422-4453 ("If a child is being hurt or is unsafe"); Cobb County non-emergency (verify number at seed). Copy: "Numbers verified [date]. If one doesn't work, call 911." |
| W19-003 🔴 | **Break-glass QR works without login.** Teen generates time-boxed QR + 6-digit code (valid 24h, single-viewer). **Unauthenticated device** scans → read-only medical card renders. **Expected:** no login prompt; no Pookie account needed; single-viewer enforced (second scan refuses or shows expired). |
| W19-004 🔴 | **Break-glass audit logged.** Every break-glass view → `access_events(emergency.break_glass_viewed)`, teen-visible. |
| W19-005 🔴 | **Independent-teen rule.** Break-glass works regardless of parent access state: revoked-parent teen's medical record still reachable via their own QR. Parent grants irrelevant to break-glass read path. |
| W19-006 🟠 | **Lock-screen/QR card teen-controlled.** "Add to lock screen" card: teen checks which fields appear (name, emergency contact, blood type, top-3 allergies). Unchecked fields absent from card AND QR payload. |
| W19-007 🟠 | **Lab emergency quick-card.** Per lab class: teacher name, room, school nurse/front-office number, universal lab rules. Present in Emergency module + linked from class page. |
| W19-008 🟠 | **Action-plan templates.** Allergy/asthma/seizure templates: teen-fillable ("my signs → my meds → who to call → what to tell 911"), encrypted, printable, shareable via break-glass at teen's discretion. No diagnostic language; FDA wellness boundary. |
| W19-009 🟠 | **Emergency medical encryption.** `emergency_medical` rows: insurance card photo vault-standard encrypted; GIPA extract-then-mask on display. |
| W19-010 🟠 | **18+ transition re-confirm.** Break-glass record explicitly re-confirmed at 18+ (decoupled from access grants). |

---

## 10. RLS — Row-Level Security verification (NFR-SEC-001)

**Method:** for each table, run auth-bypass attempts as: (a) unauthenticated anon key, (b) wrong teen (different `child_profile_id`), (c) parent with NO grant, (d) parent with live grant (non-trusted-adult scope), (e) revoked parent, (f) trusted adult who is not the teen. Assert SELECT/INSERT/UPDATE/DELETE against RLS expectations via direct PostgREST calls (service_role only where the design allows it).

| ID | Table | Expected access |
|---|---|---|
| RLS-001 🔴 | `trusted_adults` | Teen: full CRUD own rows. **Parents/grantees: NO SELECT** — even a parent who IS a designated trusted adult sees only their own contact row (via separate view/RPC), never the list. Revoked parent: nothing. Teen-initiated RPCs only. |
| RLS-002 🔴 | `crisis_events` / `crisis_alerts` | Teen: read own. Parents: none. service_role: write (Edge Function). |
| RLS-003 🔴 | `pending_revokes` | Teen: own. Parents: none (parent must never discover pending state). service_role: execute. |
| RLS-004 🔴 | `access_events` | Teen: own rows. Parents: only rows for events visible to them (scope-filtered; **never** `safe_exit.*`, `crisis_alert.declined_path`, teen-side crisis rows). |
| RLS-005 🔴 | `emergency_medical` | Teen: own. Parents: **none** (break-glass reads the teen's own record; parent grants irrelevant). service_role: break-glass viewer path only. |
| RLS-006 🔴 | `outing_plans` | Teen: own CRUD. Parents: none. |
| RLS-007 🟠 | `crisis_rulesets` | Read: service_role only (ruleset version disclosed in audit, not rules_json to clients). |
| RLS-008 🟠 | `trails` / `events` (public curation) | Read: authenticated. Write: service_role/curator only. Age/audience filtering enforced in RPC, not RLS alone (defense in depth). |
| RLS-009 🟠 | Screen Time plans | Teen + the specific approving parent: read/write per co-set flow states. Other parents: none. |
| RLS-010 🟠 | Storage buckets (`class-files`, medical/insurance images, break-glass cards) | Private buckets; signed URLs scoped; auth-bypass attempts refused. |

---

## 11. SC — Safety-critical school comms never revocable (FR-SAFETY-003)

| ID | Case |
|---|---|
| SC-001 🔴 | **Non-toggleable row.** Sharing screen: safety-comms row (permission slips, lab/field-trip notices, incident reports, emergency notifications) has **no toggle**. Attempt to disable via API → refused. |
| SC-002 🔴 | **`revokeAccess` never touches safety scope.** Revoke every scope; call the safety-comms read path. **Expected:** safety comms still flow to the parent. |
| SC-003 🔴 | **Separate safety channel.** Safety comms travel a dedicated API channel, not the scope-filtered feed (assert at the handler level: channel unaffected by `scopes_removed`). |
| SC-004 🟠 | **Copy honesty.** Teen-facing copy explains which school communications parents always receive (no "fully private" overclaim). |
| SC-005 🟠 | **Under-13 stewardship intact.** Safety comms flow to the legal steward for under-13. |
| SC-006 🟡 | **GA Parents' Bill of Rights.** Design satisfies "timely safety information" — counsel confirms (NFR-COMPLIANCE-003 gate). |

---

## 12. BG — Break-glass Paths A/B (FR-SAFETY-013/014/015) + MD-D1 vendor contract

> **MD-D1 decision (2026-10-12):** Path A human review is a **contracted crisis-response vendor API**, not in-house review. Implementation must contain **no in-house reviewer UI and no staffing assumptions**.

### 12.1 Path A — "Emergency safety access" (teen pre-designated trusted adult trigger)

| ID | Case |
|---|---|
| BGA-001 🔴 | **Trigger ONLY by the teen's pre-designated trusted adult.** Adult designated in the teen's own session requests access. **Expected:** request accepted for review. Requests from anyone else (parent not designated, stranger, second adult not on the list) → refused. |
| BGA-002 🔴 | **Hard invariant: revoked adult can never be the break-glass contact.** Adult was designated, then revoked → later requests. **Expected:** refused; no review opened. |
| BGA-003 🔴 | **Two independent corroborations required.** One confirmation → still pending. Two independent confirmations → eligible for review. |
| BGA-004 🔴 | **No civilian self-serve trigger, ever.** No button/API path lets the requester grant themselves access; review is mandatory. |
| BGA-005 🔴 | **Scope fixed in policy (requester never chooses).** Disclosure = **coarse location + W19 emergency medical card ONLY** (per MD-D7). Assert: NEVER reflections, check-ins, mood, journals, AI chats, H2/H3, messages, grades — server-side invariant, tested by requesting each forbidden scope (all refused) and by inspecting the disclosure payload for forbidden fields. |
| BGA-006 🔴 | **12-hour auto-expiry.** Grant expires at +12h regardless of state. |
| BGA-007 🔴 | **Mandatory active closure with access log.** After expiry/use: closure record with what was viewed; teen notified via **silent in-app card on next login** (never push/SMS). LE-requested deferral ≤14 days max, then automatic. |
| BGA-008 🔴 | **Spoliation guard.** Auto-expiry kills access grants only; records go on litigation hold (7-year retention of request/verification/disclosure package). |
| BGA-009 🔴 | **Audit.** `access_events` rows with `reason_code='emergency'`, teen-visible only. |
| BGA-010 🔴 | **Teen config at onboarding (13+).** Teen configures eligible scopes: location ON, emergency info ON, everything else OFF. Product name "Emergency safety access" (never "break-glass") user-facing. |
| BGA-011 🟠 | **Post-use repair flow.** "What happened" card (per-scope receipts) → one-tap re-lock → false-alarm track with plain apology → human support option. |
| BGA-012 🔴 | **Disclosure timing.** Onboarding one-liner (13+) → full version at revoke/go-independent decision moment → persistent Sharing-screen row + FAQ. |

### 12.2 D1 vendor-contract tests (no in-house review)

| ID | Case |
|---|---|
| D1-001 🔴 | **Vendor approve → 12h grant fires.** Mock vendor returns approval. **Expected:** 12-hour grant activates with fixed scope (coarse location + medical card); closure/audit trail created. |
| D1-002 🔴 | **Vendor deny → nothing fires.** Mock vendor returns denial. **Expected:** no grant; requester told plainly ("not approved"); teen notified via silent in-app card; audit records denial. |
| D1-003 🔴 | **Vendor timeout → fallback resources.** Vendor API times out. **Expected:** no silent failure; requester sees fallback resources (911, trusted-adult contact prompt); incident logged; retry path exists. Never a hung request. |
| D1-004 🔴 | **No in-house reviewer UI exists.** Codebase audit: no reviewer dashboard, no review queue UI, no "staffing rota" assumptions, no internal approval buttons for Path A. Any such surface fails. |
| D1-005 🔴 | **No in-house staffing assumptions.** Search implementation for on-call rota logic, shift schedules, or internal-review SLAs tied to Pookie employees → must be absent; the only review actor is the vendor API contract. |
| D1-006 🔴 | **Webhook security.** Vendor callback endpoint: reject unsigned callbacks; reject replayed callbacks (nonce/timestamp window); verify signature with the vendor's published key. Pen-test the callback with forged signatures, missing signatures, and replayed valid bodies. |

### 12.3 Path B — Law-enforcement exigent (FR-SAFETY-014)

| ID | Case |
|---|---|
| BGB-001 🔴 | **Legal spine present.** Every Path B flow cites SCA §2702(b)(8) good-faith emergency; the attestation text is in the request record. |
| BGB-002 🔴 | **Verification bar.** Callback to independently-sourced agency number + written official-channel confirmation within 24h + two-employee approval. **Expected:** disclosure blocked until all three present; time pressure never lowers the bar (assert via forced-timeout test). |
| BGB-003 🔴 | **Scope: location only (coarse, per D7), read-only, one-time pull.** Requesting anything beyond → refused. |
| BGB-004 🔴 | **72-hour incident-bounded cap.** Access terminates at 72h or case closure, whichever first; renewal requires fresh attestation. |
| BGB-005 🟠 | **Court orders use the front door.** Court orders/warrants route via FR-SAFETY-011/012 (human review), never Path B. |
| BGB-006 🔴 | **Teen notification.** Silent in-app card on next login (never push/SMS); LE deferral ≤14 days, then automatic. |
| BGB-007 🔴 | **No LE portal / disclosure tooling before counsel sign-off (NFR-LEGAL-006).** Codebase audit: no law-enforcement portal, no self-serve approval UI. |

### 12.4 Invariants (FR-SAFETY-015)

| ID | Case |
|---|---|
| INV-001 🔴 | **Spoliation guard verified end-to-end** (see BGA-008): post-expiry, grant rows gone; records on 7-year litigation hold. |
| INV-002 🔴 | **"Pookie is not an emergency response service — call 911"** posture present in ToS + Path A/B requester-facing copy. |
| INV-003 🟠 | **Disclosure-tooling gate.** Any new disclosure/approval UI surfaces in code review flagged against NFR-LEGAL-006; counsel sign-off record required before merge. |

---

## 13. CT — Court orders & custody (FR-SAFETY-011/012)

| ID | Case |
|---|---|
| CT-001 🟠 | **Verified orders supersede via human review.** Present a (test) court order → human review case; on verification: `court_order_restriction` flag set; access overridden accordingly. |
| CT-002 🟠 | **Teen told plainly.** Teen sees plain-language explanation of what changed and why ("A court order requires…"), never silent access changes. |
| CT-003 🟠 | **No auto-enforce until counsel signs off.** Automated order-parsing/enforcement code must be absent or hard-disabled pending NFR-LEGAL-008. |
| CT-004 🟡 | **Custody-order carve-out in revoke matrix.** Revoke flow detects `court_order_restriction` → custody-aware path; travel-restriction profile applied where flagged. |
| CT-005 🟡 | **Disputes → human review case-by-case** (per MD-D5 custody STAY OUT for v1). |

---

## 14. MR — Mandatory-reporter hooks (FR-SAFETY-009)

| ID | Case |
|---|---|
| MR-001 🟠 | **Compliance owner designated.** Record exists (name/role) before any human reads check-in content. |
| MR-002 🟠 | **DFCS escalation path wired.** T1 evaluation creates the compliance review entry; DFCS 1-855-422-4453 present in the reviewer's action set. |
| MR-003 🔴 | **R12 tripwire.** The moment any human (or non-safety AI read) touches check-in content: flag fires; G7 mandatory-reporter analysis must be re-run before continuing (gate, not advisory). Test: enable a human-review feature flag in staging → assert the tripwire blocks content reads until the analysis record is updated. |
| MR-004 🟠 | **No human reads at launch.** Assert: no production path (UI, RPC, cron, export) exposes check-in/mood/chat content to any human role at launch. |

---

## 15. Cross-cutting: adversarial tests (ADV)

These simulate a hostile teen, a hostile revoked parent, and network attackers. Run after functional suites; all are 🔴 ship-blocking.

| ID | Attack | Expected defense |
|---|---|---|
| ADV-001 🔴 | **Teen tampers with client to bypass trusted-adult gate.** Strip the gate screen from the client; call `rpc_revoke_grant` directly. | Server refuses (TA-019): no verified adult / no decline-ack → no state change. Client UI is never load-bearing. |
| ADV-002 🔴 | **Revoked parent queries `trusted_adults`.** Direct PostgREST SELECT with revoked parent's JWT. | Zero rows (RLS-001). Attempt also logged as a policy-denied read. |
| ADV-003 🔴 | **Direct RPC calls without session.** Call `rpc_nominate_trusted_adult`, `rpc_initiate_revoke`, `rpc_safe_exit` with anon key / no token. | All refused; no rows written; no notifications fired. |
| ADV-004 🔴 | **Brute-force link codes.** 6 rapid wrong codes on `/verify-adult` (TA-004) and on trusted-adult verification. | 5-attempt lockout; IP + token throttling; no timing oracle distinguishing "wrong code" from "expired token". |
| ADV-005 🔴 | **Safe-exit event visibility from parent session.** As the revoked parent: query `access_events`, notification history, audit exports, support-ticket context. | `safe_exit.executed` never appears; no inference channel (no "notification failed" entries, no gaps with suspicious timestamps). |
| ADV-006 🔴 | **Age spoof.** Tamper client-side birthdate/age claim; call age-gated RPCs. | Server re-derives age from authoritative profile (AG-012). |
| ADV-007 🔴 | **Scope smuggling in break-glass.** Path A request asks for mood/check-in/grades fields in the disclosure payload. | Server-side invariant refuses; payload contains only coarse location + medical card (BGA-005). |
| ADV-008 🔴 | **Forged vendor webhook.** Unsigned / wrong-signature / replayed vendor callbacks to the Path A callback endpoint. | All rejected (D1-006). |
| ADV-009 🔴 | **Notification suppression bypass.** Revoked parent tries to re-enable notifications or query the suppressed queue during a pending/safe-exit window. | No queue rows visible; no re-enable path. |
| ADV-010 🟠 | **Pending-window discovery.** Parent attempts to detect the pending state (polling timestamps, diffing "last updated"). | Frozen timestamps show normal staleness (CO-002); no `revoke.*` events leak. |
| ADV-011 🔴 | **Screen Time covert probe.** Parent-side request for per-app usage, message content, or location via Screen Time APIs. | Refused (ST-006): only the co-set plan's agreed aggregates are visible. |
| ADV-012 🔴 | **Break-glass QR replay.** Reuse an expired or already-viewed QR/code. | Refused (single-viewer + 24h expiry, W19-003). |
| ADV-013 🔴 | **Precise-GPS injection (MD-D7).** Submit lat/lng to 6 decimals to every location-accepting RPC (outing plans, weather locator, trail search, event search, break-glass request). | **Rejected — not silently truncated.** API returns a validation error; nothing persisted. See LC suite. |

---

## 16. LC — Location: COARSE ONLY (MD-D7 architectural constraint)

> Pookie holds city/ZIP-level location ONLY. Never precise GPS. Any future precise need triggers a separate privacy review.

| ID | Case |
|---|---|
| LC-001 🔴 | **Precise GPS rejected at every location-accepting RPC.** Submit `{"lat": 33.954412, "lng": -84.549872}` (6 decimals) to: outing-plan create, weather locator, trail search, event search, break-glass request. **Expected:** 4xx validation error, plain-language message; row NOT created. Rejection — not silent truncation to coarse. |
| LC-002 🔴 | **City/ZIP accepted.** Submit `{"city": "Marietta", "zip": "30064"}` to the same RPCs. **Expected:** accepted; stored as city/ZIP only. |
| LC-003 🔴 | **Zero precise coordinates persisted.** After running TA/CR/CO/ES/W19 flows end-to-end: query ALL location columns across `outing_plans`, weather cache, trails search logs, events search logs, break-glass audit. **Expected:** zero rows containing lat/lng with precision beyond city level; no `latitude`/`longitude` float columns populated with precise values. |
| LC-004 🔴 | **Break-glass disclosure payload = coarse + medical card ONLY.** Trigger Path A (mock vendor approve). Inspect the actual disclosure payload. **Expected:** city/ZIP-level location + W19 medical card. **No precise fields present even if requested** (ADV-007). |
| LC-005 🟠 | **Weather coarse resolution.** Weather requests resolve to ZIP/city; precise coordinates rejected server-side for <18 outside an active outing plan (and per D7, "active outing plan" precise use is disallowed too — coarse applies). Copy "Pookie uses your general area for weather — never your exact location" present. |
| LC-006 🟠 | **Schema audit.** No migration adds `latitude`/`longitude`/`coordinates`/`geopoint` columns to teen-associated tables without a privacy-review record. Add a CI check (see §17 placeholder/command block). |
| LC-007 🔴 | **Dusk calc without precise GPS.** Trails dusk check uses city-level sunset calc (astronomical calc per city). Assert correct sunset for the city, not a device coordinate. |

---

## 17. TG — Time-boxed grants: tiered caps (MD-D6)

> Frequency caps: **8/grantee/30d** trusted grantees (previously approved, no blocks); **2/30d** new grantees. Teen co-approval (13–15): required for **new grantees only**, not renewals within cap. Rolling 30-day window (not calendar month). Installment detection stays active regardless.

| ID | Case |
|---|---|
| TG-001 🔴 | **Trusted-grantee cap enforced.** Grantee with clean history requests grant #9 within 30 days. **Expected:** refused with plain-language cap-hit copy. |
| TG-002 🔴 | **New-grantee cap enforced.** First-time grantee requests grant #3 within 30 days. **Expected:** refused (2/30d). |
| TG-003 🔴 | **Teen co-approval fires for new grantees only.** New grantee request → teen (13–15) co-approval required. Renewal of a trusted grantee within cap → no co-approval ping. |
| TG-004 🔴 | **Cap-evading installment patterns flagged.** Sequence of sub-cap grants that together exceed the spirit (e.g., 2 grants/month re-issued as 1-day grants weekly) → installment detection flags; teen notified; grants paused pending review. |
| TG-005 🔴 | **Cap-hit error copy correct.** Copy states the cap, the tier, and when the window resets — plain language, no blame. |
| TG-006 🔴 | **Rolling 30d window (not calendar month).** Grants on Oct 12 and Oct 31 count against a Nov 5 request; Oct 1 grants do not (31 days out). Assert with date-controlled fixtures. |
| TG-007 🟠 | **Tier classification.** "Trusted" = previously approved AND no blocks/reports. A grantee with a past block → new-grantee tier (2/30d). |
| TG-008 🟠 | **Cap resets on revoke.** Revoked grantee re-invited: counts fresh under new-grantee tier (safety > convenience). |

---

## 18. SUP — Support holiday crisis escalation (MD-D4)

> Rotating holiday on-call (2 agents alternate; AI handles L1; on-call takes escalations). $50 in-ticket financial authority (billing out of Squad 1 scope — but the **crisis-escalation path** through tickets is Squad 1's concern).

| ID | Case |
|---|---|
| SUP-001 🔴 | **Holiday crisis escalation routes correctly.** On a holiday (simulated date), teen opens a support ticket with crisis language. **Expected:** routes to the on-call agent (not a blackout, not a dead queue); AI L1 surfaces crisis resources immediately (988/CTL) while routing. |
| SUP-002 🔴 | **After-hours/holiday banner copy.** Banner variants render: after-hours ("Our team is away — if this is urgent, call/text 988"), holiday ("Holiday schedule — on-call agent responding"). Assert both variants; never a bare "closed" with no crisis path. |
| SUP-003 🟠 | **No crisis ticket sits unowned.** Every crisis-flagged ticket has an owner (AI L1 or on-call) at all times; queue-depth monitor alerts if unowned > threshold. |
| SUP-004 🟠 | **$50 authority boundary (handoff cleanliness).** In-ticket resolution ≤$50 proceeds; >$50 → Managing Director approval path. Squad 1 asserts only: the handoff UI never blocks a crisis ticket on a billing decision; crisis routing is independent of the financial workflow. |
| SUP-005 🟡 | **Agent scoped RBAC respected.** Support agent viewing a crisis ticket sees only ticket context; never health/grades without consent (per Mehedi's support decision); all agent access audited. |

---

## 19. Non-functional tests (Mehedi's standing protocol)

### 19.1 Performance / load
- **PF-001:** Crisis-routing p95 latency: T1 SMS dispatch ≤ 60s from detection event (staging with fake provider); T2 ≤ 5 min. Measure end-to-end (detection → provider handoff).
- **PF-002:** `revoke-effect-runner` cron completes within 5 min for 10k pending rows (synthetic).
- **PF-003:** Age-gated RPCs (`rpc_get_events`, `rpc_get_trails`) p95 ≤ 400ms at 100 concurrent teens (staging).

### 19.2 Chaos engineering (targeted at safety invariants)
- **CH-001:** Kill Supabase mid-`rpc_safe_exit`. **Expected:** fail-closed — grant NOT partially revoked; no silent success; retry is idempotent.
- **CH-002:** Drop network mid-crisis-router (T1). **Expected:** alert queued with retry; `no_reachable_adult` escalation fires if the alert truly cannot send; in-app card still shown to the teen (local-first).
- **CH-003:** Vendor API down during Path A. **Expected:** D1-003 fallback (no hung request).
- **CH-004:** SMS provider down during T1. **Expected:** email fallback → secondary adult → no-reachable-adult card; each step logged (CR-015–017).

### 19.3 Accessibility (NFR-A11Y-001/002)
- **AX-001:** All safety flows keyboard-navigable (no mouse-only paths); focus order logical; modals trap focus.
- **AX-002:** Contrast: crisis cards high-contrast (no neon-on-neon); safe-exit plain sheet meets WCAG AA.
- **AX-003:** `prefers-reduced-motion`: starfield/confetti disabled; safe-exit/decline screens motionless by design.
- **AX-004:** Screen-reader: trusted-adult flow, decline checkbox, safe-exit confirm all announce correctly; SMS-code entry labeled.
- **AX-005:** One-tap `tel:`/`sms:` links on 988/911 cards (touch target ≥ 44px).

### 19.4 Copy review (≤8th-grade, no dark patterns) — per flow, launch-blocking
Copy checklist (apply to every screen/string in §§2–9):
1. Reading level ≤ 8th grade (Flesch-Kincaid check; no legalese; no em dashes in teen copy).
2. Shame-free, agency-first language; never punitive framing.
3. No dark patterns (CA AB 2246 shape): equal visual weight where required (decline path); no shaming; no confirm-shaming; no roach-motel (remove flows as easy as add flows).
4. Honesty bars: "We confirmed this number belongs to [name]" (NOT "verified this person"); "private spaces are not safety-monitored" (no overclaim either direction); never-revocable safety comms disclosed to the teen (no "fully private" overclaim).
5. **DV-advocate review gate:** all **[DV]**-flagged strings (revoke/notify/safe-exit, crisis protocol, Safety Basics, retaliation matrix) reviewed before launch — gate record in §14, not a comment.

### 19.5 Security (Fractional Team 2 owns execution; QA records the gate)
- SAST/DAST on safety routes; fuzz `rpc_verify_trusted_adult` code input; property-based: "revoked parent never receives any notification" across generated revoke/alert sequences; red-team the webhook + verify-adult endpoints. Results feed §14 sign-off.

---

## 20. Placeholder audit + E2E reality checks (MD directive 2026-10-12 — NO PLACEHOLDERS)

### 20.1 Placeholder audit (runs before ANY sign-off)

**Rule:** zero hits required. Any hit fails the audit and blocks sign-off for the affected flow.

Repeatable command (run from repo root, scoped to Squad 1–owned paths):

```bash
grep -rInE 'TODO|FIXME|XXX|HACK|mock|stub|placeholder|coming soon|lorem|console\.log' \
  src/app/\(safety\|sharing\|emergency\|wellbeing\|screen-time\|out-about\) \
  src/components/safety src/components/sharing \
  src/lib/crisis supabase/migrations/02[2-9]*.sql \
  supabase/functions/crisis-router 2>/dev/null \
  | grep -viE 'mock-vendor-test|test-fixture' || echo "PLACEHOLDER AUDIT: 0 hits"
```

- Paths are adjusted to the actual implementation tree when it lands; the pattern list is fixed.
- Allowed exceptions: vendor-contract **test mocks** named `mock-vendor-test` under `__tests__/` (D1-001–003) — these must be clearly test-scoped and must never be importable by production code (assert via import-graph check).
- Record the command output hash + date in §14 per flow.

### 20.2 End-to-end reality checks (per flow)

Every test executes against **real Supabase data** (migrations 022–029 applied, RLS active). No fixtures that bypass the database.

| Flow | Reality check |
|---|---|
| Trusted adult | Nominate → **real SMS/email code sent** (staging provider sandbox) or provider error surfaced — never silently skipped; verify against provider logs, not the app's word. |
| Crisis routing | Fire T1/T2 → **real alert path executed** (provider handoff logged) or provider-missing error — never mock success. Verify the actual provider payload content (CR-009/010). |
| Revoke / safe-exit | **Real grant rows deactivated** in DB; real `access_events` rows written; verify via service_role read-back. |
| Screen Time co-set | **Real proposal/approval state transitions persisted**; reload both sessions from DB; states match. |
| Explorer Setup | `explorer_setup_completed_at` persisted; age-gate refusals come from the RPC, not the client. |
| Break-glass QR | Unauthenticated scan hits the **real** break-glass endpoint; 24h/single-viewer enforced by real rows. |
| **Anti-rule** | **No test passes because a stub returned canned success.** If a dependency is missing, the code must fail loudly (see §20.3). |

### 20.3 Integration-point verification

For each marked integration point (other teams' unbuilt work — vendor API, SMS provider, NWS feed, DFCS/compliance queue, OS Screen Time APIs):

1. List the integration point in the flow's test record (§14).
2. With the dependency **absent/mocked-down** in staging, run the flow.
3. **Expected:** the code fails loudly and clearly (explicit error surface, logged, user-facing plain-language message where applicable) — **never silently degrades to mock behavior**.
4. Document the failure mode per integration in the PR; QA re-runs the audit when the dependency lands.

---

## 21. Static review findings (this pass — design docs, 2026-10-12)

Recorded now; implementation agents must resolve before execution.

| # | Finding | Severity | Owner |
|---|---|---|---|
| SR-01 | §20/§14 not yet executable — implementation not landed. Static review of design only. | info | QA |
| SR-02 | Dusk-guard sunset calc source: sol-safety §8.2 says "astronomical calc, no LLM" — verify implementation uses a vetted library, not hand-rolled math, and city-level coords (D7) not device GPS. | 🟠 | Backend |
| SR-003 | "Frozen timestamps read as normal staleness" (CO-002) is a UX judgment — needs an explicit UX/QA screenshot review at implementation; note residual risk that a tech-savvy parent notices. | 🟡 | UX/QA |
| SR-04 | T1/T2 classification ruleset contents are not in the design docs — QA needs the versioned `crisis_tripwire_rules` ruleset published for review before CR-001–006 can be signed off. | 🔴 | Backend + DV |
| SR-05 | Vendor API contract (D1) not yet selected — D1-001–003, D1-006 test doubles can't be finalized until the contract lands. Blocked on MD. | 🔴 | MD |
| SR-06 | Cobb County non-emergency police number must be verified at seed time (W19-002) — flag as a launch checklist item with an owner and date. | 🟡 | Content |
| SR-07 | NWS feed is another team's dependency (§20.3 integration point) — AG-007 execution blocked until the weather integration lands; failure mode must be loud. | 🟠 | Squad 5 |
| SR-08 | FR-SAFETY-013/014/015 disclosure tooling gate (NFR-LEGAL-006): counsel sign-off record must exist before ANY LE-portal/disclosure UI merges — CI or CODEOWNERS rule recommended. | 🔴 | Fractional 2 |

**Blockers reported to the squad coordinator:** SR-04, SR-05, SR-08 (launch-critical); SR-02, SR-07 (execution-critical).

---

## 22. Sign-off checklist (per flow)

**Every flow needs four PASS rows + the placeholder-audit line before it ships.** Sign-off requires evidence links (test run ID, DB read-back, screenshot, review record).

Template (copy per flow; flows: TA, CR, L2-ladder, TL, CO, ST, ES, AG, W19, BGA, BGB, CT, MR, SC, LC, TG, SUP):

```
Flow: ________
- [ ] Functional ✅ — all 🔴 cases PASS (evidence: run IDs ______)
- [ ] RLS / security ✅ — RLS suite PASS + Fractional Team 2 review (reviewer: ______ date: ______)
- [ ] Accessibility ✅ — AX suite PASS (run: ______)
- [ ] Copy review ✅ — ≤8th-grade, no dark patterns, [DV] strings reviewed (reviewer: ______ date: ______)
- [ ] Placeholder audit: 0 hits ✅ (command output hash: ______ date: ______)
- [ ] E2E reality checks ✅ — real Supabase data, real provider paths (§20.2)
- [ ] Integration points ✅ — missing deps fail loudly, no mock degradation (§20.3)
Sign-off: QA Engineer __________ Date ______ | Fractional Team 2 __________ Date ______
Status: NOT STARTED
```

### Sign-off register

| Flow | Functional | RLS/Sec | A11y | Copy | Placeholder 0-hits | E2E real | Integr. | QA sign | Frac-2 sign | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| TA Trusted Adult | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| CR Crisis routing | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| L2 Ladder | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| TL Tell-a-trusted-adult | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| CO Cooling-off/safe-exit | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| ST Screen Time | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| ES Explorer Setup | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| AG Age-gating | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| W19 Emergency | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| BGA Break-glass A | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| BGB Break-glass B | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| CT Court/custody | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| MR Mandatory reporter | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| SC Safety comms | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| LC Coarse location (D7) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| TG Tiered grants (D6) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |
| SUP Support-holiday (D4) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — | — | NOT STARTED |

---

## 23. Test environment & fixtures

- **Staging Supabase project** with migrations 021–029 applied, RLS enabled (never disabled for tests).
- **Fake SMS/email provider** in sandbox mode: carrier statuses controllable (delivered/undelivered); test number range 555-0100–0199 only. Provider logs are the source of truth for CR-009/010.
- **Mock vendor API** (`mock-vendor-test`, test-scoped only) for D1-001–003 until the real vendor contract lands.
- **Age fixtures:** 13, 14, 15, 16, 17, 18+ teens; under-13 profile; two-parent family; revoked-parent teen; independent teen.
- **Time control:** fixtures support date overrides for cap windows (TG-006), code expiry (TA-003), re-verify cadence (TA-018).

---

*End of test plan. QA Engineer (Squad 1) — static review complete 2026-10-12. Execution begins when implementation lands. No sign-offs issued.*
