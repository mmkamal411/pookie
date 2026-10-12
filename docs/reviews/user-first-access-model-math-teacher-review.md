# Expert Review — User-First Access Model
## Reviewer: High-school math teacher lens (classroom realities)
**Spec reviewed:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12)
**Date:** 2026-10-12

---

## 1. Verdicts per spec section

| Spec section | Verdict | One-line reason |
|---|---|---|
| §1 Product principles | Classroom-workable | Child-as-authority matches how student-led conferences already work; nothing here fights classroom reality. |
| §3 Access authority matrix | Needs change | Matrix is clean for *app* access but silent on the FERPA asymmetry: revoking a parent in Pookie does **not** revoke the school's right to share grades with that parent. Teens will believe otherwise. |
| §4 13–15 cooling-off | Needs change | Confirmation copy is honest but incomplete; revoked parents see a frozen grade feed that will mislead them at conference time. |
| §4 16–17 instant revoke | Classroom-workable | Matches how teens actually manage information; school disclosure still flows normally. |
| §4 18+ continuity | Classroom-workable | Correctly mirrors FERPA transfer. |
| §6 "Go independent" | Classroom-workable | Graduation framing is right; add the data-source handoff warning for grades (§4 already has it — extend to §6). |
| §10 UI — Sharing screen | Needs change | Must include a "what this does NOT hide" panel (school, report cards, conferences). Without it the screen teaches a false mental model. |
| §11 Risks & mitigations | Needs change | Missing two classroom-critical risks (see §2 below). |
| Teacher comms access (not in spec) | Gap — creates friction | The app has teacher message threads; the spec says nothing about who sees them when access is split. This is the section most likely to cause a real-world incident. |

---

## 2. Concrete spec changes (quote + replacement)

### Change A — §4, 13–15 cooling-off confirmation copy

**Current:**
> Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today."

**Replacement:**
> Confirmation lists consequences, including the FERPA limit: "Your grades will stop updating **in Pookie**. Mom and Dad will be notified today. **Your school can still share your grades with them directly — this only pauses Pookie updates, it does not stop report cards, conferences, or school emails.**"

*Why:* In my classroom, the single most common manipulation pattern is a student telling one parent "the teacher hasn't graded it yet" while the gradebook says otherwise. If the app implies revocation = privacy, teens will rely on it, parents will discover the real grade at the conference table, and the teacher becomes the accidental revealer of a family secret. The betrayal lands on the teacher-student relationship, not just the parent-teen one.

### Change B — §10, Sharing screen: add "What this does NOT hide" panel (new bullet)

**Current:** Sharing screen lists "per-person toggles, what's-visible list."

**Replacement — add:**
> - A permanent, non-dismissible panel: "Pookie sharing does NOT change what your school shares. Report cards, parent-teacher conferences, and school emails to Mom/Dad continue normally. Teachers follow school policy, not Pookie settings."

### Change C — §11, add Risk #9 (FERPA asymmetry)

| # | Risk | Mitigation |
|---|---|---|
| 9 | Teen treats app revocation as school privacy; parent blindsided at conference or by report card | Change A copy + Change B panel; revoked viewers see an explicit "updates paused" banner, never a stale last-known grade |

### Change D — §11, add Risk #10 (stale-grade display for revoked viewers)

| # | Risk | Mitigation |
|---|---|---|
| 10 | Revoked parent sees frozen old grade, anchors on it, argues with teacher at conference ("the app said 84") | Revoked views show **"Grade updates paused [date]"** — no numbers. If numbers must show for legal reasons, watermark with the exact date and "may be out of date" |

### Change E — §4 13–15: notify wording during cooling-off

**Current:**
> both parents notified immediately (told, not asked).

**Add:**
> The notification to the *non-revoked* parent is factual only ("[Teen] has scheduled changes to grade sharing") and does not name which parent was revoked, to avoid the notification being used as leverage between parents.

### Change F — new §4.x: Teacher communication threads access rules (spec gap)

**Add a new subsection (§4.5 or §12):**
> **Teacher threads.** Teacher message threads follow their own visibility rules, separate from the grade-sharing grant:
> 1. A teen may mark any message they send to a teacher as **"private to teacher"** — hidden from all parents in-app. Rationale: students must be able to ask a teacher for help ("I'm overwhelmed in this class") without a parent reading over their shoulder; otherwise the feature goes unused.
> 2. **FERPA caveat is shown once** when the flag is first used: "Teachers follow school policy and may still share with your parents through official channels. This hides the message in Pookie only."
> 3. Parents with active access see thread *existence* (that a thread with a teacher exists, subject line) but not bodies the teen flagged private.
> 4. Teachers can always initiate contact with any parent through official school channels regardless of Pookie grants; the app must not create the impression that a Pookie revoke blocks school communication.
> 5. Where district policy prohibits teacher-student messaging inside third-party apps (verify per district — Cobb County staff communicate with students via official channels), teacher threads in Pookie MUST be read-only mirrors of official school email, not a new outbound channel. Legal/district-policy review is a launch gate, not a post-launch task.

---

## 3. Feature improvements (grade-sharing that is productive, not surveillance)

These come from what actually works in classrooms:

1. **"Share my progress" moments (teen-initiated snapshots).** Student-led conferences are the highest-leverage parent-engagement format I know. Mirror it: once a week the teen can compose a 2–3 sentence narrative ("Geometry is still my gap — I redid the Unit 3 corrections and my quiz Friday decides the retake"), optionally attach one grade or artifact, and send it to the parent as a *message*, not a dashboard. The parent reacts with guided prompts, not raw numbers. This converts surveillance into student ownership — which is the entire point of the user-first model.

2. **Time-boxed sharing for conferences.** "Share my grades for the next 48 hours" — a teen-initiated, expiring window timed around parent-teacher conferences. Gives the parent what they need for the meeting without permanent surveillance, and the teen controls the on-ramp. Default suggestion text: "Sharing for conferences — expires Sunday night."

3. **Parent-side coaching prompts on grade views.** When a parent opens a class page, the top of the view should carry one rotating coaching line ("Ask what helped most this week" / "Lead with the plan, not the number"). Parents interrogate deltas ("you dropped from 84 to 81.2 overnight?") because the UI presents deltas as the headline. Change the headline, change the conversation.

4. **No grade-drop push notifications to parents, ever.** Push alerts on falling grades are the single most surveillance-flavored feature possible and will train teens to revoke preemptively. Replace with a weekly digest the teen co-authors (see #1).

5. **Conference-prep export (teen co-authored).** One page per class: current grade, gap to goal, teen's own words on the plan. The teen approves it before a parent can print or forward it to a teacher. This is the artifact teachers actually want parents to bring.

6. **Path-to-90 "plan mode" vs "scoreboard mode."** Path-to-90 helps when it frames the next action ("2 corrections + Friday quiz = +4.1 pts"). It harms when it's a live scoreboard someone else watches. When a teen has revoked a parent, the parent's last view should freeze the *plan the teen wrote*, not the live number — plans age gracefully, numbers ambush.

---

## 4. Gaps (things the spec doesn't address that classroom reality will surface)

1. **Playing parents against teachers.** The matrix lets a teen grant Parent A and revoke Parent B. At a conference with both parents, the teacher now has two adults with different information levels and a teen who has learned to exploit the gap. The spec's blended-family mitigation (row 3) covers gatekeeping between parents but not the teen-arbitrage pattern. Mitigation: teachers must never be shown, or asked about, Pookie access states. Add an explicit line: "No teacher-facing surface ever exposes who has access."

2. **Report-card timing vs. revocation spikes.** Teens will revoke access the week grades post. The 13–15 cooling-off blunts this, but 16–17 instant revoke does not. This isn't necessarily bad (it's their data), but the product should expect a support load pattern: parent calls school, school says "we sent the report card," parent is confused about the dark app. A one-line FAQ for school offices would defuse most of it: "Pookie is a family tool; it doesn't change what the school sends you."

3. **The grounded-teen scenario.** A parent who has revoked... no — a parent who has *been* revoked still has full parental authority offline (consequences, grounding, taking the phone). The app's in-app authority model and the family's real authority model will diverge, and the teen will be caught between them. The spec should not try to resolve this (it can't), but the Sharing screen copy should acknowledge the boundary: "This controls Pookie. It doesn't change your family's rules."

4. **Sibling/peer comparison.** If one sibling shares grades and another doesn't, parents will compare. Nothing in the spec prevents it; a small design note in the parent dashboard ("each child's sharing is their own choice") would help.

5. **Teacher-initiated threads to teens.** Many districts forbid it; some states' educator codes of ethics restrict private digital communication with students. Change F.5 covers it, but this needs named ownership: someone must verify district policy before teacher messaging ships in each district.

---

## 5. Reassessment flags (measure after launch, revisit the spec)

1. **Parent-surprise-at-conference rate.** If parents report being blindsided by grades at conferences more than baseline, the FERPA-asymmetry copy (Changes A/B) is failing. Survey after first report-card cycle.
2. **Preemptive revocation spikes.** Watch for revoke-rate spikes in the 7 days before grading periods close. A spike means teens experience sharing as surveillance — the fix is product (improvements #1–#4), not tighter locks.
3. **Teen app avoidance after grade drops.** If session data shows teens stop opening Pookie within 48h of a grade decline, path-to-90 is functioning as a shame instrument. Reassess the scoreboard-vs-plan balance (improvement #6).
4. **Teacher-thread usage with parent access on vs. off.** If teens only message teachers when parents can't see the thread, the "private to teacher" flag (Change F.1) is load-bearing — do not remove it.
5. **District-policy incident count.** Any single incident of a teacher-communication policy violation triggers a re-review of Change F.5 before further rollout.
6. **Cooling-off cancellation rate (13–15).** If most cooling-offs are cancelled, the feature is working as a reflection tool. If almost none are, teens have learned to wait it out — consider whether the notification itself is the deterrent and the delay is dead weight.

---

## Bottom line

The access model is sound and, frankly, more honest than the "parent sees everything forever" default — it matches how I already work with students who own their learning. The danger isn't the philosophy; it's the **false mental model**: teens believing app privacy equals school privacy, and parents reading frozen numbers as live truth. Fix the copy (Changes A–E), write the teacher-thread rules (Change F), ship the teen-initiated sharing moments (improvements #1–#2), and never push a grade-drop alert to a parent. Do that and this becomes the rare ed-tech product that increases student agency without making teachers the collateral.
