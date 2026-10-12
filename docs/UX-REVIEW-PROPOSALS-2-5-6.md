# UX Design Review — Proposals 2, 5, 6

**Reviewer role:** UX designer (consumer apps, trust & safety, teen users)
**Date:** 2026-10-12
**Context:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked) + `ACCESS-MODEL-REVIEW-CHECKLIST.md` (round-1 findings)
**Design language:** Nebula theme (dark cosmos, subtle neon, warm) · plain-English navigation · teen copy at ≤8th-grade reading level · trust first, efficiency second

**Non-negotiable constraints this review designs inside:**
- Child is the access authority; `granted_by` enforced server-side; a parent can never revoke a child-made grant; teen may revoke *any* grant on their own record (checklist §1.3.2 fix).
- Age tiers: <13 stewardship (no child login/session) · 13–15 shared agency · 16–17 full agency · 18+ continuity.
- Sharing screen is per-person × per-scope (Performance / Communications / Reflection / Wellness + health tiers H0–H3); safety-critical school comms are never revocable; break-glass emergency info is independent of access grants.
- Cooling-off redesign pending: safe-exit path required; notify-at-effect default (only the revoked party); no celebration UI on rupture; no "just between us" promises from AI (G10); trusted-adult designation required before revoke/go-independent (G1).
- Under-16 non-parent grants need parent co-approval; 30-day re-request lockout after a revoke/deny (checklist §1.3.4/§1.3.5).

---

## PROPOSAL 2 — Time-boxed access grants

### 1. Critique of the initial solution

1. **Duration-first, not occasion-first.** Parents think in occasions ("Saturday night sitter"), not durations. "One-time (4 hrs) / 1 day / 1 week / custom / indefinite" reads like a legal form and invites the wrong default.
2. **"Indefinite" as a peer option kills the feature.** Presented side-by-side, busy parents will pick indefinite out of laziness — recreating the permanent-access problem the feature exists to solve. Ongoing access must be a deliberate, reviewed choice, never a preset.
3. **No granter/approver model.** Who can create a time-boxed grant — parent, teen, or both? Does a 13+ teen see or approve a parent's sitter grant? What `granted_by` gets written? The initial solution is silent, and silence here becomes a trust incident later.
4. **All-or-nothing scope.** A sitter who can see everything (grades, check-ins, mood) is a privacy violation the per-scope model was built to prevent. Duration without scope is half a feature.
5. **Hard expiry = the named panic.** "Auto-revoke on expiry with notifications" is exactly the "locked out mid-emergency" scenario. There is no grace, no wrap-up, no one-tap re-request path. Expiry must be a slope, not a cliff.
6. **No recurring-need answer.** Weekly sitters re-doing a 5-step flow every Friday will either churn or pick "indefinite." The initial solution punts on this.

### 2. Revised flow (screen-by-screen)

**Frame the whole flow around the occasion, not the permission.** Title the flow "Share for a bit" — never "Grant time-boxed access."

**Screen 1 — Who's this for?**
- Field: first name. Relationship chips: Sitter · Grandparent · Tutor · Family friend · Other.
- Microcopy: "Only the people you choose, only what they need, only for as long as you say."
- *Why:* purpose-first makes scope and duration choices obvious downstream.

**Screen 2 — What can they see?** (scope picker, safe defaults)
- Preset card selected by default: **"Sitter basics (recommended)"** → Emergency contacts + medical break-glass (always on, locked toggle, "always available in an emergency — this never expires with the grant") + Today's schedule & tonight's plan.
- Expandable "Choose exactly": Schoolwork due tonight · Messages from school · Grades (off by default, with a nudge: "Sitters rarely need grades") · Location during the booking (off by default, <16 requires teen awareness).
- Reflection / Wellness / check-in text / mood: not offered for sitter-type grants at all — no toggle, no temptation.
- Copy rule: plain nouns, never scope jargon ("tonight's plan" not "Communications scope").

**Screen 3 — How long?** (occasion presets, concrete end times)
- Options as occasions with computed end times in the granter's local timezone:
  - "This evening — ends tonight at 11:00 PM" (default)
  - "This weekend — ends Sun, 9:00 PM"
  - "One week — ends Oct 19, 9:00 PM"
  - "Pick a date & time…"
- No "indefinite" preset. A quiet link below: "Need ongoing access?" → confirmation screen: "Sitters usually don't need ongoing access — it stays until someone removes it. Make it ongoing anyway?" [Keep it time-boxed] [Make it ongoing]. Ongoing grants get an automatic 90-day review nudge ("Still need this?").
- Default = "This evening." Defaults are the design.

**Screen 4 — Teen awareness (13+, automatic, not a separate screen for the parent)**
- The parent never fills anything here; the system notifies the teen the moment the grant is created:
  - **13–15:** "Heads up — Mom gave Alex (sitter) access to *tonight's plan + emergency info* until 11:00 PM tonight. Not okay? You can change it." [It's fine] [Change it]. "Change it" opens the Sharing screen with the grant highlighted; teen may narrow scope or revoke instantly (safety action — no cooling-off on revoking a third-party grant; see open questions).
  - **16–17:** same notification, one-tap revoke, no extra steps.
  - Under 13: no teen surface exists; the steward parent's decision stands, and the grant appears in Settings → Family → "Who can see [Child]'s stuff."
- If the *teen* initiates the grant (13+): under-16 non-parent grantee needs parent co-approval (checklist §1.3.4) — parent gets an approve/deny push with the same scope summary; 16–17 teen grants directly, parent gets a "told, not asked" note.

**Screen 5 — Confirmation**
- "Done. Alex can see *tonight's plan + emergency info* until 11:00 PM tonight. We'll remind you both before it ends." [View in Sharing] [Done].
- `granted_by` is written as `'parent'` or `'child'` per who initiated; `expires_at` stored in UTC; an `access_events` row is appended; a reusable **grant template** (person + scope + typical duration) is silently saved for re-grant.

**Expiry — the slope, not the cliff (all three parties):**
- **T-24h:** parent gets one quiet nudge: "Alex's access ends tomorrow at 11:00 PM. Extend it?" [Extend] [Let it end]. No action = ends.
- **T-1h and T-15m:** sitter sees a warm banner inside the app: "Your access ends at 11:00 PM — wrap up what you need." Nothing alarming, no countdown timer theatrics.
- **At expiry:**
  - *Sitter* lands on: "All done. Your access to [Child]'s info ended at 11:00 PM." Below it, two honest buttons: [Request more time] (one-tap push to the parent: "Alex is asking for 1 more hour — [Approve] [Decline]") and [Text Mom] (deep link to SMS). Already-open screens degrade to **10-minute read-only grace** with a visible "read-only — access ended" banner so nobody loses a half-read page mid-sentence.
  - *Parent* gets: "Alex's access ended at 11:00 PM. Nothing to do." + if the template was used before: "Same again next Saturday, 6–10 PM?" [One-tap re-grant].
  - *Teen (13+):* a quiet line in activity: "Alex's access ended." No action, no noise.
- **The mid-emergency guarantee (the panic killer):** emergency contacts, medical break-glass info, and the home address are *never* gated by the grant — the sitter's app keeps a persistent "Emergency" card regardless of access state (per checklist W19: break-glass independent of parental access). Expiry can never block calling 911, calling the parents, or reading an allergy list. Say this explicitly on Screen 2 so the parent trusts the expiry: "Emergency info stays available to Alex no matter what — even after access ends."

**Recurring need — recommendation: saved templates + one-tap re-grant, NOT auto-recurring grants.**
- Do not build scheduled auto-renewing grants. A standing grant the parent forgets about is a surveillance leak, it robs the teen of a periodic check-in point, and it muddies the audit trail ("who approved *this* Saturday?").
- Instead: every completed grant becomes a template. At expiry (and Friday afternoon for weekly patterns the system detects), the parent gets "Same as last time? [Grant again — Sat 6–10 PM]". One tap, fresh `expires_at`, fresh teen heads-up, fresh audit row. The friction is ~3 seconds; the accountability is total.

### 3. Open questions for Mehedi

1. **Teen revoking a parent-made sitter grant (13–15):** instant, or does the 7-day cooling-off apply? Recommendation: instant — revoking a *third party's* access is a safety action, and cooling-off exists to prevent impulsive *parent-relationship* rupture, not to keep a sitter's access alive. Confirm.
2. **Should a parent be able to grant a sitter access to a 13–15-year-old's data with only teen *notification* (not approval)?** The spec matrix says parents can grant; the teen is the access authority. Recommendation: parent-grants + mandatory teen visibility + teen one-tap revoke = the right balance. Confirm, or require teen co-approval?
3. **Sitter directory (W12) interplay:** should "Share for a bit" be offered from a vetted-sitter profile? If yes, the directory's "parent-vetted, not background-checked by Pookie" label must travel with the grant flow.
4. **Expiry timezone:** use the granter's home timezone always (not the sitter's device tz)? Recommendation: yes — "ends at 11 PM" must mean the parent's 11 PM.

### 4. Implementation notes

- **Schema:** `child_access.expires_at TIMESTAMPTZ NULL`; partial index `WHERE status='active' AND expires_at IS NOT NULL` for the sweeper. New `grant_templates` table (owner_user_id, child_id, label, grantee_name, relationship, scopes JSONB, typical_duration, use_count, last_used_at). `access_events` append-only row on create/expire/extend/revoke with reason codes (`expiry`, `manual_revoke`, `extension`).
- **Sweeper:** idempotent worker (every 5 min) flips `status` to `'revoked'` with `revoked_by='system'`, `revoke_reason='expiry'`; sends the three notifications; writes `access_events`. Guard: never expire `granted_by='system'` safety rows; safety-comms scope untouched by construction.
- **Grace state:** client-side `grace_until = expires_at + 10 min` read-only mode; server enforces read-only by rejecting writes when `now() > expires_at` (defense in depth — client never derives roles).
- **Re-request:** `requestAccess`-style lightweight path — one-tap push to the original granter; auto-declines after 30 min; 30-day lockout does *not* apply to expiry re-grants (only to revokes/denies).
- **Edge cases:** overlapping grants to the same person (show both rows; expiry of one doesn't touch the other); teen ages across a band boundary mid-grant (rules evaluated at action time, not grant time); push delivery failure → in-app banner fallback on next open; sitter opens app *after* expiry → straight to the "All done" screen, never a spinner or error; parent deletes child profile → cascade-expire all grants + notify grantees once.
- **Components:** `OccasionPicker` (computed end-times), `ScopePicker` (locked emergency row), `TeenHeadsUp` (notification template per band), `ExpiryBanner` (sitter), `GraceScreen`, `ExtendPrompt` (parent), `ReGrantSuggestion` (template-based), `EmergencyCard` (persistent, grant-independent).

---

## PROPOSAL 5 — Second-parent onboarding

### 1. Critique of the initial solution

1. **The first-run branch is a confusion trap.** "I'm the parent of a child already in Pookie" will be tapped by solo parents who misread it ("my child will be in Pookie after I add them"), by grandparents, and by curious teens. Branching must be unmistakable, with the *default* path being the common one.
2. **Name + DOB as a probe feels like a privacy interrogation** and creates an enumeration oracle: if "match" and "no match" produce visibly different next screens, anyone can probe whether a child exists in Pookie. The checklist (§1.2.3) already requires dedupe to fire only after verified login, never as a standalone lookup — the UX must honor that in its bones.
3. **The waiting state is a dead end.** "Request sent, pending" with nothing to do = churn. Parent B did the work of signing up; they must get a working Pookie immediately, with the family link as a side quest, not the whole game.
4. **Rejection has no humane design.** A denied request sitting in the app as a permanent artifact ("DENIED" badge) becomes a screenshot in a custody fight. The initial solution doesn't say what Parent B sees, for how long, or how to de-escalate.
5. **Missing entirely:** identity attestation (how do we know the requester is actually a parent?), duplicate-profile prevention (Parent B must never be able to mint a second profile for the same child), approver routing (<13 → Parent A; 13+ → teen), approver non-response (nudge? expiry?), and the teen-as-approver experience (a 14-year-old being asked to adjudicate their parents' access is a developmental landmine).

### 2. Revised flow (screen-by-screen)

**Screen 1 — First-run branch (inside onboarding, Step 2 position).**
One question, three big plain-English cards — the common path first:
1. **"Just me"** — "Use Pookie as your own personal assistant." *(default-highlighted)*
2. **"Add my child"** — "Track a child in Pookie. You'll create their profile."
3. **"Connect to my family"** — "Your child's other parent or guardian already uses Pookie. Link to their profile instead of starting over."
- Sub-copy under card 3: "Grandparent, step-parent, or caregiver? This path works for you too — the child's family approves the connection."
- *Why this works:* a solo parent reading card 2 ("*You'll create* their profile") will not mistake card 3 for themselves. The word "already" does the disambiguation.

**Screen 2 — Find the profile (identification without the interrogation).**
- Title: "Find your child's profile." Fields: child's first + last name, birthday (date picker, not a typed riddle).
- Microcopy above the fields: "Type it exactly like the other parent did — spelling counts." 
- Privacy microcopy below, *before* submit — this is load-bearing: "We check this privately. You'll see the same message whether or not we find a match — we never reveal what's in Pookie."
- **Result screens are layout-identical** (same illustration, same headline shape) to kill the oracle:
  - *Match:* "We found a profile that could be [First name]'s." Show first name + last initial + birth month/year only — enough for the requester to confirm, not enough to harvest. [Yes, that's my child] [No, let me fix the details].
  - *No match:* "We couldn't find a matching profile." Same illustration. Options: [Check the details and try again] · [Add my child as new] · [Talk to support]. 
  - "Add my child as new" requires the guardian attestation checkbox ("I am this child's parent or legal guardian" — checklist §1.1.2) and creates a parent-managed profile flagged `possible_duplicate=true` for later dedupe review — it never silently forks a second live profile.
- Rate-limit attempts (5/hour); never reveal *which* field was wrong ("name or birthday didn't match" — never "we have that name but the birthday is off").

**Screen 3 — Ask to connect (the request).**
- Auto-routed approver line, stated plainly:
  - Child under 13: "We'll ask **[Parent A first name]** — they manage [Child]'s profile."
  - Child 13+: "We'll ask **[Teen first name]** — they're in charge of who sees their stuff."
- Optional note field: "Add a note (optional) — e.g. 'It's Dad, got a new phone.'"
- Required attestation checkbox: "I am [Child]'s parent or legal guardian." (unchecked by default; the button stays disabled until checked — no dark pattern, just a gate.)
- [Send request]. What happens next, stated up front: "They'll get a notification today. You'll hear back here either way — usually within a few days."

**Screen 4 — Waiting (a working Pookie, not a waiting room).**
- Parent B lands in a **fully working "just me" Pookie** — mail, tasks, today plan, all of it. The family link is one card in the More/Family section, not the whole app:
  - Card: "Waiting to connect with [First name] — requested Oct 12. We'll tell you the moment they answer." [Cancel request].
- Approver gets one notification on day 0, one gentle re-nudge on day 7 ("Still thinking it over? [Review request] [Snooze a week]"), request auto-expires at day 14 → Parent B sees "The request expired — you can send a fresh one anytime," approver-side row disappears. No nag loop.
- **If the approver is the teen (13–15):** the request arrives as a calm card, never a demand: "[Name] says they're your parent and wants to connect. Here's what they'd see: [scope summary]." Buttons: [Approve] [Not now] [I don't know this person → block + report]. "Not now" snoozes 7 days, twice max, then auto-expires — the teen is never forced to adjudicate on the spot. If the teen taps "I don't know this person," the requester is blocked from re-requesting and the event is audit-logged (invite-harassment protection, checklist §1.3.5).

**Screen 5 — Rejection (no argument artifact).**
- Parent B sees, once, as a dismissible card (not a permanent badge): "Not connected — [Child]'s family didn't approve this time." Body: "This happens for lots of reasons, and the app won't say why. If you think it's a mistake, the best next step is a conversation outside Pookie — or our support team can talk through options with you." [Talk to support] [Dismiss].
- No reason displayed. No "appeal" button (30-day re-request lockout, checklist §1.3.4). Dismissing removes it from the UI permanently; the `denied` row stays in the DB/audit log only. The design goal: nothing in the app that screenshots well in a fight.

### 3. Open questions for Mehedi

1. **How do we verify Parent B is really a parent?** Attestation checkbox is a legal fig leaf, not verification. Options: (a) accept attestation + approver judgment (recommended for v1 — the *approver* is the real check); (b) ID verification for the requester (heavy, slow, expensive). Confirm (a).
2. **Teen as approver for a parent's request (13–15):** the current design routes to the teen alone. Should Parent A also be notified ("told, not asked") when a 13–15-year-old approves a new parent's access? Recommendation: yes — fact-only notification to Parent A, no veto (child is the authority), so nobody is blindsided.
3. **What if Parent A is unreachable or unresponsive (<13 child)?** 14-day expiry then what — does Parent B get any path forward besides "talk to them directly"? This is really a custody-support question; recommend the support team's human path, not a self-serve override. Confirm.
4. **Should grandparents / step-parents get their own first-run card, or ride the "Connect to my family" path?** Recommendation: same path, relationship chip on Screen 3 ("I'm the: parent / step-parent / grandparent / other caregiver") — shown to the approver for context.

### 4. Implementation notes

- **Enumeration hardening:** match/no-match responses must be timing-similar and layout-identical; lookup fires only for authenticated users; `possible_duplicate` flag + manual-review threshold for near-misses (never auto-merge, never auto-merge health records — checklist §1.2.3). All lookups audit-logged (hashed query, result class only — never the typed name/DOB in plaintext logs).
- **Schema:** `access_requests` gains `requester_note`, `requester_relationship`, `attestation_at`, `expires_at` (14d), `nudge_sent_at`. `children` gains `possible_duplicate` bool. Block list: `blocked_requesters` (child_id, blocked_user_id, blocked_until) enforcing the 30-day household re-invite ban.
- **Routing logic:** `routeAccessRequest(child_id)` → under-13: notify creating parent (steward); 13+: notify teen; also fact-only notify the *other* existing parent ("[Requester] asked [Teen] for access — [Teen] decides") without veto power.
- **States:** `pending → approved / denied / expired / blocked / cancelled`. Parent B's Family card subscribes to transitions; on `approved`, run the standard link flow (scopes default per §1.3.3: Performance+Communications visible, Reflection+Wellness teen-private; 18+ health rules apply).
- **Edge cases:** duplicate pending request (guard: one pending per requester+child); requester already has access (redirect to Sharing, don't create a request); teen turns 13 mid-request (re-route to teen, notify Parent A); Parent A denies then teen turns 13 and requester re-requests (allowed — new authority); approver deletes the app (day-7 nudge becomes email/push; day-14 expiry still fires server-side).
- **Components:** `RoleBranchCards`, `PrivateMatchLookup` (identical-result layouts), `AttestationGate`, `ApproverCard` (band-specific copy + "not now" snooze), `WaitingFamilyCard`, `GentleDecline`, `ReNudge` (day-7, approver side).

---

## PROPOSAL 6 — Support staffing: AI-first, human 9–5

### 1. Critique of the initial solution

1. **"4 business hours" is a nonsense SLA for a 7-day operation.** Mehedi locked 9–5 *every day* ET — so the clock is "4 hours within 9 AM–5 PM ET, 7 days a week." Say that. "Business hours" makes users do calendar math and hides the weekend reality.
2. **"AI can't resolve" is not an observable trigger.** Escalation needs concrete, UX-visible tripwires: two failed AI attempts, explicit "I want a person," keyword classes (lawyer, court, billing, cancel), crisis language, teen-privacy topics. Otherwise escalation is a vibe.
3. **"Agent will respond at 9 AM" overpromises.** A ticket filed at 11 PM with a 4-hour-from-9-AM clock gets a reply *by 1 PM*, not *at 9 AM*. Promise the window, not the moment.
4. **In-app tracking without honest queue data backfires.** A fake "you're #3 in line" destroys more trust than no number at all. With two agents, position numbers are volatile — design tracking around *status and SLA*, not queue rank.
5. **The teen-privacy hole.** Nothing in the initial solution says whether parents are told about a teen's ticket. For a 15-year-old reporting a privacy concern, parental notification isn't a feature — it's a betrayal vector. This must be explicit in the UI, not in a policy doc.
6. **After-hours "AI-only" risks feeling like a wall.** The AI must stay genuinely useful (troubleshooting, workarounds, "here's what to try until morning") — not a holding message with a chatbot attached.

### 2. Revised flow (screen-by-screen)

**The handoff — "no repeat" as a visible contract:**
1. Trigger fires (list below). The AI pauses and says: "I think a person should take this one. Here's what I'll hand them so you don't repeat anything:" followed by a **3–5 bullet summary card** (what you asked, what I tried, what didn't work) with [Looks right] [Add something] (free-text append).
2. On confirm: "Ticket **#4821** is open. A support agent will reply **right here, in this chat**, within **4 hours** — we're staffed 9 AM–5 PM Eastern, every day including weekends." Then: "Want to keep trying things with me meanwhile, or should I let you go?" [Keep trying] [I'm good — just notify me].
   - *Why this works:* the summary card makes "no repeat" *provable*, not promised. The user watched the handoff packet being built.
3. **What carries over (shown to the user as "Included automatically"):** full transcript · app version + device · account type · prior tickets · what the AI already tried · topic tags (billing / legal / safety / privacy) · teen-privacy flag if set. Explicitly *not* included without fresh consent: health data, grades, check-in content (agent asks in-thread — see teen section).
4. **Human reply arrives in the same thread**, introduced once: "Hi, I'm **[First name]** from Pookie support — I read everything above, no need to start over." Agent first name only; with a two-person team, continuity ("the same small team every time") is the positioning — small is a feature, not an apology.

**Escalation triggers (observable, documented in the AI's system prompt):**
- User asks for a human, in any words ("real person," "someone who works there").
- Two AI attempts on the same issue without resolution (AI says so itself: "I've tried two things and we're stuck — want me to bring in a person?").
- Keyword classes: legal/court/lawyer, billing dispute/chargeback, account deletion, safety/crisis language, teen privacy/sharing disputes.
- AI confidence below threshold on a how-to with account consequences (deleting data, changing access).

**After-hours (5:01 PM–8:59 AM ET) — honest and still useful:**
- Banner at thread top, warm Nebula styling, no red alert: "Our support team is offline until **9 AM ET**. I've opened ticket **#4821** — they'll reply here by **1 PM ET** at the latest."
- The AI *keeps working*: troubleshooting, workarounds, and a "Notes for the agent" scratchpad the user can add to ("Anything you figure out overnight, I'll attach"). The ticket is filed immediately — nothing waits for morning except the human.
- Copy never blames staffing: "Two specialists, seven days a week" is the frame if staffing ever comes up — never "we're a small team, sorry."

**Crisis — the pattern interrupt (any hour, including 2 AM):**
- The AI *stops troubleshooting immediately*. No ticket-queue framing first. The thread switches to a calm, visually distinct crisis card:
  - "If someone might get hurt, reach a person right now — you don't have to wait for us."
  - Big tappable buttons: **[Call 988]** **[Text 741741]** **[GA Crisis Line: 1-800-715-4225]** (preloaded per checklist W19; locale-aware as the product expands).
  - Below: "I'm still here if you want to talk. And if there's a trusted adult in your life, I can help you figure out what to say to them." [Help me tell someone] [Just stay with me].
- Then, and only then: a ticket is quietly created and flagged crisis-priority for the 9 AM team — the user is told ("I've also let our team know — they'll check in tomorrow"), but the resources are the headline, not the ticket.
- **The honesty line** (G10 — never "just between us"): "I can't keep this just between us if someone's safety is at stake — but I won't tell your parents unless someone could get seriously hurt right now." ≤8th-grade, no legalese. No auto-parent-notification absent imminent risk (checklist Category 2 self-harm protocol shape).

**In-app ticket tracking:**
- Support tab → "My tickets": each ticket a row with a status pill — **Open** (with us) → **With [First name]** (being read/worked) → **Answered** (reply waiting on you) → **Closed**. Timestamps on every transition ("Maya started on this at 10:42 AM").
- SLA line under each open ticket: "We reply within 4 hours, 9 AM–5 PM ET, every day." No queue numbers, no fake ETAs. If an agent is actively typing/working, show "Maya is looking at this now" — real presence, not a number.
- Closed tickets stay readable (full thread) — "your history with us."

**The teen user's view — 15-year-old filing a privacy ticket:**
- At ticket creation, when the topic is privacy/sharing *or* the user is 13–17, an explicit banner — this is the whole ballgame: "**This stays between you and Pookie support.** We won't tell your parents you wrote to us, or what you asked. The only exception: if someone's safety is at stake."
- Agent-side RBAC, made visible to the teen: before an agent opens grades, health, or check-ins, they ask *in the thread*: "Can I look at your Sharing screen to help with this? [Yes, just this once] [No]." Every access is audit-logged, and the teen can see it in Settings → Privacy → "Who's looked at my stuff" ("Support looked at your Sharing screen on Oct 12 — with your permission").
- Under-13: support happens via the parent — the app says so plainly ("Since you're under 13, we'll work through your parent on this").
- If the ticket is *about* a parent misusing access (G4 territory): the flow offers the safe-exit path, not a mediation session. Support never becomes a family-court chatroom.

### 3. Open questions for Mehedi

1. **SLA clock on federal holidays** — 9–5 ET is locked 7 days/week; does that include Thanksgiving/Christmas, or holiday coverage with adjusted SLA copy? Recommendation: keep the 7-day promise year-round (it's the differentiator) and pay holiday rates; if not, the SLA line must say so *before* someone files on Christmas morning.
2. **The two agents' scope:** are they empowered to resolve billing/refunds and make access-model exceptions (e.g., court-order intake), or triage-and-escalate to you? The UI promises "a person who can help" — define what "help" includes so the handoff copy doesn't overpromise.
3. **Crisis keyword sensitivity:** false positives (a teen writing "this homework is killing me") vs. misses. Recommendation: tiered — soft language gets a gentle inline resource link, explicit self-harm language gets the full pattern interrupt; log both for review. Confirm the bar.
4. **Teen support age floor:** 13–17 get direct confidential support per this design. Confirm no parent-notification for *any* teen ticket topic except imminent-safety — including billing questions on a parent's card.

### 4. Implementation notes

- **Schema:** `support_tickets` (id, user_id, child_id NULL, topic tags, priority `standard|urgent|crisis`, status `open|with_agent|answered|closed`, sla_due_at, agent_id NULL, teen_privacy bool, transcript JSONB, handoff_summary JSONB, created_at). `ticket_events` append-only (status transitions, agent reads of teen data with consent refs). Agent identity: `support_agents` (first_name only client-visible).
- **SLA engine:** `sla_due_at` computed as created_at + 4h *within* the 9–5 ET window (ticket at 11 PM → due 1 PM next day; ticket at 3 PM → due 5 PM same day... note: 4h from 3 PM = 7 PM > 5 PM close → due 11 AM next day; implement window-aware arithmetic, not naive +4h). After-hours tickets show "by 1 PM ET" style copy derived from the same function. Holiday table if Q1 answer is "adjusted."
- **AI escalation:** system-prompt trigger list + `escalate(reason, summary bullets)` tool call; the summary card is rendered from the tool payload and user-confirmed before ticket creation (the "watched handoff").
- **Crisis path:** separate classifier tier; crisis card is a distinct UI state that suppresses all troubleshooting affordances; 988/741741/GA-line buttons use `tel:`/`sms:` links; "Help me tell someone" pulls the teen's trusted-adult list (G15) or helps draft a message; the quiet crisis-priority ticket is created server-side with `priority='crisis'`.
- **Teen privacy enforcement:** `teen_privacy=true` tickets are invisible to parent accounts at the API layer (not just hidden in UI); agent console requires the in-thread consent grant before fetching `grades`/`health`/`checkins` scopes, each fetch writing a `ticket_events` row the teen can see. Under-13 users get the parent-mediated message; the ticket is linked to the parent's account instead.
- **Edge cases:** user files a second ticket on the same issue (link as related, don't double-queue); agent shift change mid-ticket (re-intro: "Maya's handing you to Jordan — he's read everything"); user deletes account with open tickets (retain per retention schedule, anonymize); crisis ticket + teen revokes parent access same night (safe-exit copy takes precedence; support does not notify the parent); push notification for human reply must not leak content on lock screen for teen-privacy tickets ("New reply from Pookie support" — no preview text).
- **Components:** `HandoffSummaryCard`, `AfterHoursBanner`, `CrisisResourceSheet`, `TicketThread` (unified AI+human), `TicketList` + `StatusPill`, `AgentPresence` ("Maya is looking at this now"), `TeenPrivacyBanner`, `ConsentToView` (in-thread scope grant), `NotesForAgent` (after-hours scratchpad).

---

## Cross-proposal notes

- **The teen notification pattern is shared:** P2's grant heads-up, P5's approver card, and P6's privacy banner all use the same voice — plain nouns, named people, ≤8th-grade, consequences stated, "you're in charge" framing. Build one `TeenNotice` component with per-context copy.
- **"Told, not asked" is a first-class notification class** across P2 (parent grants → teen told), P5 (requester → other parent told), and P6 (never — support tells no one). Name it in the notification taxonomy so engineers implement it once.
- **Audit visibility for the teen** (`access_events`, "who looked at my stuff") is the trust backbone of all three proposals — a teen who can *see* the machinery trusts it.
- **Safe exits are visually boring by design** (checklist §1.5.1): P2's expiry screens, P5's decline card, and P6's crisis-adjacent safe-exit path all use calm neutral styling — no confetti, no red alerts, no badges that screenshot well.

## Suggested build order

1. P6 ticket schema + handoff card + SLA engine (support exists from day one; crisis path is launch-blocking per G2).
2. P2 `expires_at` + sweeper + grace states (small schema change, high trust value).
3. P5 request flow + enumeration hardening (needed before any second parent hits the dead end in the wild).
