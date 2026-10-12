# Support Solutions — Pookie 7th Menu Category (S1/S2/S3)

**Status:** DESIGN ONLY — no code, no deploys · **Author:** support-systems solution designer · **Date:** 2026-10-12
**Source:** Mehedi-locked principles 2026-10-12 (user-first Pookie; child 13+ is access authority; age tiers; server-side enforcement); `USER-FIRST-ACCESS-MODEL-SPEC.md`; `sol-safety.md` (crisis protocol, §§1.4–2.6); `sol-legal.md` (COPPA 2025 G6, retention §6, GIPA §10-1-912, vendor terms); `sol-ux.md` (Nebula theme, ≤8th-grade copy, shame-free); `modules.ts` (S1/S2/S3 committed); Mehedi 2026-10-12 FAQ content standard (comprehensive coverage + expandable plain-language legal explanations + law-required-vs-our-choice honesty).
**Migrations:** 028–030 (proposed; apply after 021 `access_events`).

> **NOT LEGAL ADVICE.** Section C is a design scaffold for structuring legal work. Every legal accordion, retention period, and sign-off gate below requires a licensed attorney before anything ships. Nothing in this document is legal advice.

> **Panel status note:** this doc is the support-domain redesign. It does not work around any blocked gate. Support ships only with the gates in §E cleared.

---

## 0. Conflicts with other domains (resolved here, flagged for owners)

| # | Conflict | Resolution (this doc) | Owner to confirm |
|---|---|---|---|
| C1 | `support_grants` (scoped agent access) vs health carve-out (§C1 of sol-health: H3 never parent-visible; W8 never parent-visible incl. aggregates) | **Health is never grantable.** Scopes are allowlisted; `health.*`, `wellbeing.*`, `mood.*`, `checkin.*` are not valid scopes and the grant RPC rejects them server-side. A ticket "about" a health module is answered from FAQ + user-described symptoms only, never by viewing records. | Health designer |
| C2 | Break-glass consent counterparty vs parent expectations (parent opens ticket about teen's grades) | **The account holder who owns the data consents.** If the ticket subject is the teen's data and the teen is 13+, the consent card goes to the *teen*, not the parent — the child is the access authority (USER-FIRST spec §3). Parents are told this plainly in the ticket UI. | Access-model owner |
| C3 | Crisis language in S2 vs ticket SLA (a crisis conversation must not sit in a 24h queue) | **Safety protocol supersedes support.** Crisis detection freezes the support flow, routes per `sol-safety.md` §2 (988 inline card + trusted-adult routing + `crisis_events` audit). No ticket is auto-created from crisis language; a follow-up ticket is created only at explicit user request. S2 SLA timers do not apply to crisis-flagged conversations. | Safety designer |
| C4 | Support audit events vs `access_events` (021) schema | Support extends `access_events` with new event types (§B.3); no schema change needed beyond the event-type enum/value list. 028–030 apply **after** 021. | — |
| C5 | Under-13 support counterparty vs "child can't have login" (legal §1.1.4) | Under-13 tickets/AI chat run in the **parent's session only**; `tickets.child_id` marks on-behalf-of. The AI system prompt pins the counterparty as the parent. No child free-text is collected. | Legal designer |

---

## A. UX DESIGN

Design system: Nebula theme (dark cosmos `#050510`, subtle neon, pink `#f472b6` accent, plain English, shame-free, ≤8th-grade copy). Mobile-first. Shared components referenced: `CollapseRow`, `GlowCard`, `InfoLine`, `Sheet`, `FullPageFlow`, `StatusPill`, `AuditLine`.

### A.1 FAQ information architecture (S1)

**Top-level tree (9 sections):** the 7 menu categories + **Account & Privacy** + **Legal & Your Rights**.

| Section | Covers (module/topic leaves) |
|---|---|
| Health | W2 Health, W8 Wellbeing, W13 Meals, W22 Activity, W23 Nutrition |
| Home | W21 Mail, W20 Shopping List, W11 Spending, W7 Money & Documents, W24 Credit, W14 Co-parenting |
| School | W1 School, W16 School Calendar, W5 College & Future, W4 Activities, W18 Summer |
| Safety | W3 Safety, W19 Emergency, W15 Screen Time |
| Travel | W25 Fuel & Charging, W30 Flights, W31 Rental Cars, W27 Events, W28 Restaurants, W29 Trails & Parks, W26 Weather |
| Marketplace | W12 Babysitters, W6 Driving School |
| Support | S1 Help Center, S2 AI Support Chat, S3 Support Tickets |
| Account & Privacy | Signup/onboarding, sign-in & sessions, "just me" mode, notifications, devices, data retention, account deletion, exporting your data |
| Legal & Your Rights | Access model (child-as-authority), age tiers, linking methods, Sharing screen, go-independent, 18+ transition, trusted adults, why-we-do-it-this-way legal index |

**Coverage rule (Mehedi 2026-10-12):** every one of the 31 modules gets ≥1 "How do I use X?" article and ≥1 troubleshooting article; every account/legal topic above gets an article. Launch corpus floor: ~90 articles. No module ships without its FAQ leaves live (Milestone-1 gate check).

**Article template** (every article, no exceptions):
1. **Problem line** — one sentence, user-voiced ("My grades stopped updating.").
2. **Steps** — numbered, ≤6 steps, each one action. ≤8th-grade reading level (editorial pipeline enforces Flesch-Kincaid ≤ 8.0; build fails the article to draft if it scores higher).
3. **"Still stuck?"** — escalation block: primary button opens S2 chat with article slug pre-attached as context; secondary link opens S3 with category pre-filled. Copy: "Still stuck? Talk to us — we'll pick up where this article left off. You won't have to repeat yourself."
4. **Legal accordion** — only where the article has a legal dimension (see A.5 contract).
5. **Related answers** — 2–4 links, editorially curated (`related_slugs`).

**Search behavior:**
- **Exact/keyword first:** Postgres full-text (`tsvector` over title + keywords + body). Typo-tolerant (`pg_trgm`), ranked by `ts_rank`.
- **Semantic fallback:** only when keyword returns <3 results or top score < threshold — `pgvector` cosine similarity over article embeddings. Results labeled quietly: "Related answers" section header (no AI hype copy).
- **Age-band filtering:** every article carries `age_band` (`all` | `teen` | `parent`). Search filters to the viewer's band server-side — a teen never sees parent-only legal-process articles and vice versa, but the *count* of hidden results is never disclosed.
- **Empty state:** "We didn't find that — ask Pookie (AI chat) or open a ticket." with both actions one tap away.

**Contextual surfacing ("?" affordance):** a small "?" button on complex screens deep-links to the relevant article, never to the FAQ home:
- Sharing screen → *"Who can see my child's stuff — and who decides?"* (access model, legal accordion on child-as-authority).
- Grade sync / "SYNC NOW" → *"Why did my grades stop updating?"* (W1 troubleshooting).
- Settings → Safety → *"How safety works — private spaces and when we step in"* (sol-safety §2.5 copy).
- Ticket form → *"What can support see? (Almost nothing — by design)"* (links §B).
- Every "?" opens a bottom `Sheet` with the article inline (no navigation away from the task).

### A.2 S2 AI Support Chat — escalation UX

S2 is scoped to **support intents only**: how-to, troubleshooting, account questions, billing questions. It is served by the existing `pookie-tutor` Worker (Llama 3.3 70B) with a support-scoped system prompt, FAQ-corpus retrieval, and the safety middleware from `sol-safety.md` §1.4.

**Persistent AI disclosure (always visible, never dismissible):**
> Header chip: `🤖 AI assistant — not a person`
> First-run `InfoLine`: "I'm Pookie's support assistant — an AI. I can walk you through features and fix common problems. I **can't** see your private data (grades, health, check-ins), delete or export your account, or make promises about the law. **A human is one tap away anytime** — just say 'human.'"

**Escalation triggers (any one fires):**

| # | Trigger | What happens |
|---|---|---|
| 1 | **Confidence below threshold** | Intent classifier + retrieval confidence < 0.60 after FAQ lookup → "I'm not sure I have this right — want me to bring in a human?" with [Yes, get a human] [Let me rephrase]. Never bluff an answer. |
| 2 | **User asks for a human** | Exact-intent match ("human", "real person", "talk to someone", "agent") → immediate handoff, no persuasion, no "are you sure?". |
| 3 | **3 failed attempts** | Same intent unresolved across 3 AI turns (tracked per conversation) → proactive: "I've tried three ways and we're still stuck — let me get you a person. I'll send them our whole chat so you don't repeat anything." |
| 4 | **Crisis language** | → **SAFETY PROTOCOL, never the ticket queue alone** (see red box below). |
| 5 | **Account deletion / data export requests** | AI gives the plain-language info (what deletion does, the retention schedule summary, the 30-day SLA) AND opens a human ticket immediately — identity verification + legal holds require a human. Copy: "Deleting your account is a big step — a person on our team will handle this with you to make sure it's done right." |

> ### 🚨 CRISIS LANGUAGE IN S2 — THE UNMISSABLE RULE
> **Crisis language NEVER goes into a ticket queue alone.** On detection (server-side safety middleware, T1/T2 per sol-safety §2.1):
> 1. **Freeze the support flow.** The troubleshooting conversation pauses — no ticket, no SLA timer, no "we'll get back to you in 24 hours."
> 2. **Inline resource block** (inside the chat, not a modal — sol-safety §2.2): 988 / Crisis Text Line / 911 copy, one-tap `tel:`/`sms:` links, persistent for the session.
> 3. **Trusted-adult path:** T2 → offer "tell a trusted adult"; T1 → route alert per sol-safety §1.4 (transparent, never silent — the AI says it's doing it).
> 4. **Record:** `crisis_events` audit row; conversation flagged crisis — **no human support agent reads it at launch** (sol-safety §2.4.4; re-run the mandatory-reporter analysis the day any human read of chat content begins).
> 5. **After the crisis moment:** the AI may offer — once, gently — "When you're ready, I can connect you with a human on our support team for anything else." The user must opt in. A support ticket is created **only** at explicit user request.

**The handoff UX (triggers 1, 2, 3, 5):**
1. User sees a handoff card **inside the chat** (the conversation doesn't navigate away):
   > "✨ Handing you to a human
   > I've attached our whole chat — **you don't have to retype anything.**
   > 🎫 Ticket **#PK-2026-0042** is open.
   > ⏱️ Current wait: **about 2 hours** (from the live queue).
   > We'll notify you here and by push when someone replies."
2. **Ticket number is issued immediately** (synchronously at handoff — the user never waits for a number).
3. **Wait-time estimate** is computed from live queue depth per priority (p50 of last-7-days handle time × position); if the queue is empty the card says "usually replies within minutes right now" — never a fake precise number.
4. Context preserved: full transcript attached as the ticket's first `ticket_messages` row (`author_type='ai'`, body = transcript, not user-visible as a "message" but shown in thread as "📎 Chat transcript attached").
5. The S2 conversation stays open and read-only ("This chat is now attached to ticket #PK-2026-0042 — continue there") with a deep link to S3.

**"AI was wrong" correction path:**
- Every AI answer carries quiet 👍 / 👎 affordances.
- 👎 → `Sheet`: "What went wrong?" → quick chips: *Wrong answer* · *Out of date* · *Too confusing* · *Didn't answer my question* → optional one-line note.
- *Wrong/Out of date* → offered the corrected path: re-answer from a different article OR escalate. The feedback writes to `faq_feedback` + a training queue; articles with helpful-rate < 60% over 30 days are auto-flagged for editorial review.
- Copy honesty: "Thanks — that helps us fix it. Want a human to take it from here?"

### A.3 S3 ticket thread UI

**User-facing thread** (`/support/tickets/[id]`, mobile-first, Nebula):
- **Header:** subject, `StatusPill` (Open → In progress → Resolved — confirm → Closed), **SLA indicator** ("Replies within ~24h · 6h left" — green/amber/red; red adds "We're late — sorry. A lead has been notified.").
- **Message bubbles:** user right-aligned (soft pink glow), agent left-aligned (teal glass), system center (small caps: "Ticket opened", "Agent Maya joined", "Waiting on your confirmation"). AI transcript attachment renders as a collapsed "📎 Chat transcript" row.
- **"Resolved? Confirm" step:** when an agent marks resolved, the thread shows a confirm card — **the ticket cannot close without it**:
  > "Maya thinks this is resolved. Is it fixed for you?
  > [Yes, all good ✅] [No, still broken]"
  > "No reply in 5 business days? We'll close it automatically — you can reopen anytime within 30 days."
- **Composer:** text + attachment (images/PDFs; ≤10 MB; scanned by the redaction filter on send — §C.3).
- **"What can support see?"** link in the header → bottom sheet with the §B visibility matrix in plain language + link to Settings → "Support access" audit view.

**Agent-facing queue** (desktop-first internal console, separate auth surface — §B.4):
- **Filters:** status, priority, topic/category, SLA risk (breaching < 2h), unassigned, "mine", sensitive-flagged.
- **Assignment:** [Claim] button (round-robin suggestion: "Next up: Maya (3 open)"), lead-only [Assign to…]. **Self-assign is blocked** on sensitive tickets (P1, child-authored, crisis-flagged) — the button renders disabled with "Lead assignment required."
- **Internal notes:** visually separated — amber left border, "🔒 Internal — the user can't see this" banner, separate composer tab. `internal=true` rows are excluded from the user thread by RLS, not by client filtering.
- **Canned responses:** library (greeting, need-more-info, resolved-confirm, escalation-to-lead), each stamped with version; agents must personalize the bracketed fields.
- **Grant request button:** "Request data access" → scope picker (allowlisted scopes only) + purpose field → sends the §B.2 consent card.

---

### A.5 FAQ content architecture — Mehedi's comprehensive + legally-transparent standard (2026-10-12)

**The standard:** the FAQ covers **every feature** and is **legally transparent**: every article with a legal dimension carries a collapsed, plain-language legal explanation that cites the specific law and says honestly whether the rule is *required by law* or *Pookie's choice*.

#### A.5.1 Topic tree (9 sections; 31 modules + account + legal)

Sections 1–7 mirror the menu categories in `modules.ts`; sections 8–9 cover account and rights. Every leaf lists its required articles (`H` = how-to, `T` = troubleshooting, `L` = legal-dimension → gets a `LegalAccordion`).

**1. Health** — W2 Health (`H`: connecting Apple Health/Google Fit; `T`: sync stopped); W8 Wellbeing (`H`: the daily pulse; `L`: why mood data is never parent-visible); W13 Meals; W22 Activity; W23 Nutrition (`L`: why under-18s never see calorie/weight-loss content).
**2. Home** — W21 Mail; W20 Shopping List; W11 Spending; W7 Money & Documents (`L`: how financial docs are masked); W24 Credit (`L`: **why Credit is 18+ only — FCRA**); W14 Co-parenting.
**3. School** — W1 School (`T`: grades stopped updating; `L`: **why parents can still get school records after a teen revokes — FERPA**); W16 School Calendar; W5 College & Future; W4 Activities; W18 Summer.
**4. Safety** — W3 Safety; W19 Emergency (`H`: the emergency plan); W15 Screen Time.
**5. Travel** — W25 Fuel & Charging; W30 Flights; W31 Rental Cars; W27 Events; W28 Restaurants; W29 Trails & Parks; W26 Weather.
**6. Marketplace** — W12 Babysitters (`L`: sitter background-check limits); W6 Driving School.
**7. Support** — S1 Help Center (`H`: this article); S2 AI Support Chat (`H` + `L`: AI disclosure, what it can/can't do); S3 Support Tickets (`H`: opening/tracking; `L`: **why support agents can't see health/grades without permission**).
**8. Account & Privacy** — Signup & onboarding; Sign-in & sessions; "Just me" mode; Notifications; Devices; **Data retention** (`L`: **why we keep what we keep and delete the rest — COPPA 2025 data minimization**); **Account deletion** (`L`: **what happens to data when you delete — schedule + legal holds**); Exporting your data.
**9. Legal & Your Rights** — The access model: child-as-authority (`L`: **why a parent can't veto a teen's grant — and the court-order exception**); Age tiers (`L`: **why under-13s can't have their own login — COPPA**); Linking methods; The Sharing screen; Go-independent (`L`: **why we ask for a trusted adult first — duty of care**); The 18+ transition (`L`: **why health needs re-consent at 18 — FERPA transfer + health privacy**); Trusted adults; Safety school comms (`L`: **why permission slips/emergency notices can't be revoked — GA Parents' Bill of Rights O.C.G.A. § 20-2-786**); AI guardrails for under-18s (`L`); Your privacy rights (access/correct/delete); Legal-explanation index (all `LegalAccordion`s in one browsable list).

All 11 Mehedi-mandated legal topics are marked `L` above and each gets a `LegalAccordion` (§A.5.2).

#### A.5.2 The `LegalAccordion` component contract

Collapsed by default. Renders at the end of the article body, before "Related answers."

```
┌─────────────────────────────────────────────────────────┐
│ ⚖️ Why does Pookie do it this way? (Legal)   [Required  │
│  by law ▾]  /  [Our choice ▾]  /  [Law + our choice ▾]  │
├─────────────────────────────────────────────────────────┤ (expanded)
│ <plain-language explanation, ≤8th-grade reading level>  │
│                                                         │
│ The law: <name + citation, e.g. "COPPA — Children's     │
│ Online Privacy Protection Act; FTC Rule, 2025 update">  │
│ What it means for you: 2–3 bullets                      │
│ <if our_choice: "The law doesn't require this — we do   │
│  it because …" (honesty line, required)>                │
│ ─────────────────────────────────────────────────────── │
│ Reviewed {reviewed_at} · Next review {review_due_at} ·  │
│ v{version} · <if overdue: amber banner "This explanation│
│ is being re-reviewed — the policy hasn't changed.">     │
└─────────────────────────────────────────────────────────┘
```

**Contract rules:**
- `basis` ∈ `law_required` | `our_choice` | `both` — badge copy is fixed; writers cannot invent a fourth.
- The honesty line is **mandatory** for `our_choice`: "The law doesn't require this, but we do it because…". Writers may never write "for legal reasons" without naming the law.
- Reading level: the accordion body is readability-gated separately (FK ≤ 8.0) — legal text is where jargon sneaks in, so it gets its own gate.
- Stale policy: if `review_due_at` passes, the accordion stays visible with the amber banner — **we never silently hide a legal explanation**.
- Data: `faq_articles.legal_note_md`, `legal_citation`, `legal_basis`, `legal_reviewed_at`, `legal_review_due_at`, `legal_version`; prior versions retained in `faq_article_versions` (audit).

#### A.5.3 Editorial workflow — keeping legal explanations current

| Step | Owner | Cadence / trigger |
|---|---|---|
| Draft plain answer | Content team | Per feature launch (FAQ leaves are a launch gate) |
| Readability gate (FK ≤ 8.0, article + accordion separately) | Automated in CMS | Every save |
| Legal review of accordion | **Licensed attorney** | Before go-live; then **every 6 months** per accordion |
| Law-change watch | Legal | Watchlist: COPPA/FTC, FERPA, FCRA, O.C.G.A. § 20-2-786 (GA Parents' Bill of Rights), GIPA § 10-1-912 → re-review affected accordions **within 30 days** of a relevant change |
| Version pin | CMS | Every legal edit bumps `legal_version`; prior versions kept |
| Stale escalation | Automated | `review_due_at` − 14d → nudge legal; past due → amber banner + weekly digest to legal |

**⚠️ SIGN-OFF GATE:** no `LegalAccordion` goes live without licensed-attorney approval of its text. This is not legal advice.

#### A.5.4 Example Q&As (tone demonstration)

**Example 1 — COPPA (`law_required`)**
> **Q: Why can't my 11-year-old have their own Pookie login?**
> **A:** Because kids under 13 get a parent-managed profile instead — you run it from your account, and there's no login, no password, and no chat for them. It's less fun for them, we know. Here's why it has to be this way:
> ⚖️ *Why does Pookie do it this way? (Legal)* **[Required by law]**
> A federal law called **COPPA — the Children's Online Privacy Protection Act (FTC Rule, updated 2025)** — says apps can't collect personal information from kids under 13 without verified parent consent, and can't keep kids' data longer than needed. Breaking it means FTC fines and court orders — companies have paid millions. So we made a design choice the law forces: under-13s don't get logins at all. That way we never collect anything *from* your child directly, and the rule is enforced by the software itself, not by a promise.

**Example 2 — FERPA (`law_required` + honest scope limit)**
> **Q: My teen removed my access in Pookie. Why can I still see their report card from the school?**
> **A:** Because those are two different doors. Pookie's Sharing screen controls what *Pookie* shares. Your child's school gives you records directly — Pookie can't close that door, and it can't open it either.
> ⚖️ *Why does Pookie do it this way? (Legal)* **[Required by law]**
> **FERPA — the Family Educational Rights and Privacy Act (20 U.S.C. § 1232g)** — gives *parents* the right to their child's school records until the child turns 18 (then the right moves to the student). Your school follows FERPA, not Pookie's settings. What Pookie *can* do is stop sharing the copy of grades inside the app the moment your teen revokes — and it does, immediately. But the school's own parent portal is between you and the school.

**Example 3 — "Our choice" (honesty rule)**
> **Q: Why does a support agent need my permission to look at my grades?**
> **A:** Because we decided support should work with almost nothing. When you open a ticket about grades, the agent sees your ticket and your messages — not your gradebook. If they need to see the actual grades to fix it, they have to ask, you tap approve in the app, and their access expires automatically after 24 hours. Every look is logged, and you can see the log in Settings.
> ⚖️ *Why does Pookie do it this way? (Legal)* **[Our choice]**
> **The law doesn't require this — we do it because it's the right shape for a family app.** Privacy laws set a floor (don't leak people's data); they don't tell companies exactly how little their own staff should see. We chose the strictest workable version: support agents are the least-privileged people in our system who can still fix your problem. If we ever loosen this, we'll tell you first.

**Example 4 — Duty of care (`both`)**
> **Q: Why does Pookie ask me to name a trusted adult before I go independent?**
> **A:** Going independent is a big step — your own Pookie, fully yours. Before it happens, we ask you to name one adult you trust (or to check a box saying you'd rather not). It takes a minute, and you can change it anytime.
> ⚖️ *Why does Pookie do it this way? (Legal)* **[Law + our choice]**
> The law part: companies that serve teens have a **duty of care** — if a young person is in crisis, we need *some* way to get help to them. That's the legal reason behind the trusted-adult step. Our choice on top of it: we let *you* pick the adult (it doesn't have to be a parent), and we let you decline — but only after you check a box showing you understand what "no adult will be told" means. No dark patterns, no guilt screens.

---

## B. SUPPORT-AGENT RBAC

**Design principle:** a support agent is the *least-privileged actor that can still do the job*. The agent sees the ticket — not the person.

### B.1 Visibility matrix

**A support agent CAN see by default:**
- Ticket metadata: ticket number, subject, category, priority, status, SLA state, timestamps.
- The user's own words: ticket description, ticket messages (`internal=false`), AI-chat transcript attached at escalation, attachments the user uploaded *to the ticket*.
- Contact info the user provided *in the ticket channel*: display name, email (needed to reply). Phone only if the user typed it into the ticket.
- FAQ corpus, canned responses, internal notes on tickets they can access.

**A support agent can NEVER see by default:**
- Health records — **all tiers** (H0–H3), including aggregates.
- School records — grades, assignments, attendance, teacher comms.
- Check-in content and mood data (W8) — including "private spaces."
- Any other child's data; any other family member's tickets.
- Credentials vault, payment instruments (beyond last-4 already masked), full card/bank numbers.

**Break-glass with user consent** — when the ticket is *about* a module (e.g., "my grades won't sync"):
1. Agent clicks **Request data access** → picks an allowlisted scope (`school.grades.read`, `billing.read`, `sync.status.read` — allowlist in code, §D) + writes a purpose (≤280 chars, user-visible).
2. The account holder who owns the data gets an in-app consent card (+ push): who is asking, what scope, why (the purpose text), **expires in 24 hours**, [Approve once] [Deny]. Per C2: if the data is the teen's (13+), the card goes to the **teen**, not the parent.
3. On approve → `support_grants` row (`consented_at`, `expires_at = now + 24h` default; lead may extend to 72h max). `access_events(support.grant.approved)`.
4. Agent reads **only** through `rpc_support_scoped_read(ticket_id, scope)` → server checks grant validity → returns scoped payload → writes `access_events(support.grant.data_accessed)` **per call**.
5. Expiry is automatic (cron `rpc_expire_support_grants` every 15 min); post-expiry reads are denied server-side. The user can revoke early in Settings → Support access. Denied requests are logged too (`support.grant.denied`) — a pattern of denied requests flags the agent for lead review.

### B.2 Enforcement — RLS sketches + grant schema

**`support_grants`** (migration 030):
```sql
support_grants(
  id uuid PK,
  ticket_id uuid FK → tickets NOT NULL,
  agent_id uuid FK → support_agents NOT NULL,
  scope text NOT NULL,                       -- allowlisted; CHECK (scope IN (...))
  purpose text NOT NULL,                     -- user-visible, ≤280 chars
  requested_by uuid FK → support_agents,     -- may differ from agent_id
  granted_by_user_id uuid FK → auth.users,   -- the consenter (teen or adult)
  consented_at timestamptz,
  expires_at timestamptz NOT NULL,           -- consented_at + 24h default, ≤72h
  revoked_at timestamptz,
  status enum('pending','active','expired','revoked','denied')
)
```

**RLS sketches:**
- `tickets`: user → `SELECT` own (`user_id = auth.uid()`); agent → `SELECT` where `assigned_agent_id = agent.id` OR (`assigned_agent_id IS NULL` AND status='open' — the unassigned queue); lead/admin → all. `INSERT`: authenticated users only (own `user_id`); status transitions via RPC only (no direct `UPDATE` on status).
- `ticket_messages`: user → non-internal rows on own tickets; agent → all rows on accessible tickets **except** `internal=true` is additionally restricted to `support_agents` role (never the ticket owner, even if the owner is somehow an agent — separation, §B.4).
- `support_grants`: user → rows on own tickets; agent → rows where `agent_id = self`.
- `faq_articles`/`faq_feedback`: public read (live only); write = content team role only.

**Server-side functions (names; signatures in build spec):**
- `rpc_open_ticket(p_subject, p_category, p_body, p_child_id?)` → creates ticket + first message; returns ticket number.
- `rpc_claim_ticket(p_ticket_id)` → refuses if sensitive-flagged and caller isn't lead; refuses on conflict of interest (§B.4); writes `support.ticket.assigned`.
- `rpc_request_support_grant(p_ticket_id, p_scope, p_purpose)` → validates scope allowlist; creates `pending` grant; pushes consent card.
- `rpc_decide_support_grant(p_grant_id, p_approve bool)` → **caller must be the data owner** (the ticket's `user_id`, or the teen for teen-owned data); sets active/denied; writes audit.
- `rpc_support_scoped_read(p_ticket_id, p_scope)` → checks active grant; returns scoped payload; writes `support.grant.data_accessed`.
- `rpc_expire_support_grants()` → cron/15min; flips expired; writes `support.grant.expired`.
- Status RPCs: `rpc_agent_set_in_progress`, `rpc_agent_mark_resolved`, `rpc_user_confirm_resolution`, `rpc_user_reopen`, `rpc_auto_close_resolved` (cron) — §D transition rules enforced here, not in RLS.

### B.3 Audit — every agent view is logged

`access_events` (021) gains support event types:
`sUpport.ticket.viewed` · `support.ticket.assigned` · `support.grant.requested` / `.approved` / `.denied` / `.expired` / `.revoked` · `support.grant.data_accessed` · `support.internal_note.created` · `support.consent_card.sent`

**Rule:** opening a ticket in the agent console writes `support.ticket.viewed` (agent_id, ticket_id, timestamp) — there is no "just browsing" without a trail. Scoped reads write `support.grant.data_accessed` with the scope. The user sees all of it in **Settings → Privacy → "Support access"**: "Maya (support) viewed ticket #PK-0042 · Oct 12, 3:40 PM" / "Maya viewed your grades (ticket #PK-0042, you approved) · 3:42 PM · access expired 3:42 PM next day." Teen-visible, never parent-visible for teen-owned tickets.

### B.4 Abuse resistance

- **No self-assign on sensitive tickets:** P1, child-authored (13–17), or crisis-flagged tickets disable [Claim]; assignment requires a lead. Enforced in `rpc_claim_ticket`, not just UI.
- **Conflict of interest:** `rpc_claim_ticket`/`rpc_assign_ticket` refuse when the agent's `user_id` has any family relationship to the ticket's user (checks `child_access`, `children`, `profiles` linkage) — **an agent is never also a parent/relative in the same ticket**. Refusal is logged.
- **Separate principals:** agent capabilities come from `support_agents.active=true` + `role_tier`, checked server-side per call. An agent cannot open user-side tickets from the agent console (agent support goes through a separate admin channel). Deactivating the row instantly revokes all agent access (checked per request, not cached).
- **Rate/pattern guards:** ≤3 grant requests/day/agent; >2 denied grants/week → lead review; bulk ticket views without messages → flagged.

---

## C. LEGAL / COMPLIANCE — OUTLINES (NOT legal advice — requires licensed attorney)

> **NOT LEGAL ADVICE.** This section is a design scaffold. Every retention period, redaction rule, and disclosure below needs a licensed attorney's sign-off before it ships. The sign-off gates in §E are launch-blocking.

### C.1 Retention policy for support data

Binds to the sol-legal §1a schedule structure (`source | data class | legal basis | retention | deletion method | backup handling | purge cadence | owner`). Proposed periods (attorney to confirm):

| Data class | Retention | Rationale (design) |
|---|---|---|
| Open tickets + messages | While open | Operational necessity |
| Closed tickets + messages + internal notes | **2 years after close** | Dispute/chargeback window + support-quality analysis; bounded, never indefinite |
| S2 AI-chat transcripts | **13 months after last message**; teen 13+ may delete own transcript anytime | Bounded per panel "no indefinite retention of minor transcripts" (sol-legal §6); continuity for repeat issues |
| Ticket attachments | **90 days after close** | Debugging window; then purge |
| `support_grants` rows | **3 years** (survives ticket purge as audit evidence) | Accountability trail; legal-hold eligible |
| `faq_feedback` | 13 months, aggregated | Product improvement; no PII by design |

- **Deletion method:** hard `DELETE` + a `retention_log` row (counts, dates, job id) as purge evidence; failure alerts to the compliance owner.
- **Backups:** purged ≤30 days after source deletion (sol-legal §1a.5).
- **Litigation holds:** a valid hold **suspends** scheduled purges for in-scope data only; holds are time-bounded and re-authorized (never "until further notice"); the user is told plainly (age-appropriate) that deletion is paused for legal reasons, without privileged detail. COPPA 312.10's ban on indefinite retention is not waived by a hold (sol-legal §6.4).
- **Composes with the main schedule:** support data is one more source row in the §1a table; the same purge job framework runs it.

### C.2 COPPA implications — under-13 support

- **The child is never the counterparty.** Under-13s cannot open AI chat or tickets — technically enforced: S2/S3 session creation rejects under-13 principals server-side (mirrors legal §1.1.4: no session tokens for under-13 principals); `tickets.child_id` marks on-behalf-of and the ticket owner is the parent.
- **The flow:** parent opens the ticket from the child's managed profile → ticket shows "On behalf of [child first name]" → agent knows the counterparty is the parent → AI system prompt pins: "You are speaking with the parent/guardian, never the child. Do not address the child. Do not ask for information *from* the child."
- **No persistent child identifiers in support tooling:** ticket tags use anonymized topic codes (`sync.grades`, `login.sso`) — never child names, birthdates, or student IDs in tags/search indexes. The `child_id` FK exists for routing; it is not exposed in agent search or notifications.
- **What the AI may/may not say:** may explain parent-facing how-tos; may not request, and must refuse to collect, any information directly from a child; must not personalize to the child ("I see you're in 6th grade" is forbidden — it implies child data in the support context).

### C.3 GA privacy / GIPA — PII in support conversations

- Support conversations **contain PII** (name + email + account identifiers, sometimes more). Under O.C.G.A. § 10-1-912, name combined with SSN/account/password triggers breach notification — so support stores are in the breach runbook's scope (sol-legal §16), and mis-scoping (panic-notifying vs unlawful silence) is a legal decision, not an engineering one.
- **Logged vs redacted (server-side, on ingest — before storage):**
  - **Never stored:** full card PANs, full SSNs, passwords/secrets pasted by users, full bank account numbers. Pattern redaction replaces with `[redacted]` and sets `ticket_messages.redacted=true`; the original bytes are never persisted.
  - **Stored masked:** card last-4 only (if the user needs a payment identified); emails stored as-is (needed to reply) but excluded from push-notification bodies.
  - **Health details in tickets:** users will paste them ("my son's medication is…"). The redaction filter flags health-pattern content for the agent ("⚠️ this message may contain health details — don't repeat it in notes") and health content is **never copied into internal notes**.
- **Staff rule:** agents never ask for passwords, full card numbers, or SSNs in chat. Payments happen via the payment-provider link, never in the ticket thread. (Training + canned-response guardrails.)

### C.4 AI disclosure + vendor terms for the tutor worker in support

- **Disclosure:** persistent `🤖 AI assistant — not a person` chip (§A.2) + first-run `InfoLine` stating what S2 can/can't do + the escalation promise ("A human is one tap away anytime — just say 'human'"). The disclosure is mode-independent (Pookie/Muse) and age-band aware (teen band gets the "private spaces" cross-link).
- **Vendor terms (pookie-tutor Worker as support AI):** the sol-legal §1a vendor template applies — written data-processing terms: **no training models on Pookie inputs**, no advertising use, deletion on request with certification, breach-notification SLA, annual re-assessment. Support prompts carry **only** the FAQ corpus + ticket metadata the user typed — health/check-in/school records are never in the prompt context (this is also what makes the §A.2 "I can't see your private data" line true).
- **"Not an emergency service"** language (W19 shape, sol-legal §2): S2 states it is not for emergencies and routes crisis language per the red box in §A.2.

---

## D. TECHNICAL DATA MODEL

**Migrations (apply after 021):**
- `028_support_tickets.sql` — `tickets`, `ticket_messages`, `support_agents` + RLS + status-transition RPCs.
- `029_faq.sql` — `faq_articles`, `faq_feedback`, `faq_article_versions` + search indexes (GIN trgm, tsvector, pgvector).
- `030_support_grants.sql` — `support_grants` + scope allowlist CHECK + grant RPCs + expiry cron.

```sql
tickets(
  id uuid PK,
  ticket_number text UNIQUE NOT NULL,        -- 'PK-2026-0042' (sequence-backed)
  user_id uuid FK → auth.users NOT NULL,     -- the counterparty (parent for <13)
  child_id uuid FK → children,               -- on-behalf-of; NULL for adult's own ticket
  category text NOT NULL,                    -- module/topic code, e.g. 'school.sync'
  subject text NOT NULL,
  status enum('open','in_progress','resolved','closed') DEFAULT 'open',
  priority enum('P1','P2','P3') NOT NULL,
  sensitive bool DEFAULT false,              -- P1 / child-authored / crisis-flagged
  assigned_agent_id uuid FK → support_agents,
  sla_due_at timestamptz NOT NULL,
  sla_breached bool DEFAULT false,
  source enum('s2_escalation','manual','faq') DEFAULT 'manual',
  reopened_count int DEFAULT 0,
  created_at, updated_at, closed_at timestamptz
)
ticket_messages(
  id uuid PK, ticket_id uuid FK → tickets NOT NULL,
  author_type enum('user','agent','ai','system') NOT NULL,
  author_id uuid,                             -- user or agent id
  body text NOT NULL,
  internal bool DEFAULT false,               -- agent-only; RLS-enforced
  redacted bool DEFAULT false,               -- auto-redaction fired (§C.3)
  attachments jsonb DEFAULT '[]',
  created_at timestamptz
)
support_agents(
  id uuid PK, user_id uuid UNIQUE FK → auth.users NOT NULL,
  display_name text NOT NULL,
  role_tier enum('agent','lead','admin') DEFAULT 'agent',
  active bool DEFAULT true, created_at timestamptz
)
support_grants( ... per §B.2 ... )
faq_articles(
  id uuid PK, slug text UNIQUE NOT NULL, title text NOT NULL,
  body_md text NOT NULL, category text NOT NULL,   -- 9 sections (§A.5.1)
  keywords text[] DEFAULT '{}', age_band enum('all','teen','parent') DEFAULT 'all',
  search_vector tsvector GENERATED, embedding vector(1536),
  related_slugs text[] DEFAULT '{}',
  legal_note_md text, legal_citation text,
  legal_basis enum('law_required','our_choice','both'),
  legal_reviewed_at date, legal_review_due_at date, legal_version int DEFAULT 1,
  status enum('draft','live') DEFAULT 'draft', updated_at timestamptz
)
faq_feedback(id uuid PK, article_id uuid FK, helpful bool NOT NULL, created_at)
```

### D.1 SLA timers (proposed — justify)

| Priority | Target | Clock | Justification |
|---|---|---|---|
| **P1** | **4 hours** | 24/7 | Account lockout, deletion/export requests, suspected breach, safety-adjacent (non-crisis — crisis bypasses tickets entirely). Harm compounds hourly; 4h is the longest defensible window. |
| **P2** | **24 hours** | Calendar | Broken feature blocking normal use ("grades won't sync"). One-day tolerance matches a family's daily rhythm (the 4pm briefing cadence). |
| **P3** | **72 hours** | Calendar | How-to / general questions. Async is fine; FAQ + S2 absorb most of these. |

`sla_due_at` is set at open/escalation from priority. **Breach escalation:** on breach → `sla_breached=true`, auto-notify the support lead, bump priority one level (P3→P2; P1 pages the on-call lead), and show the user the §A.3 red SLA copy ("We're late — sorry. A lead has been notified."). Breaches are reported weekly (count, p50/p95 handle time per priority).

### D.2 Status-workflow transition rules

```
open ──claim/auto-assign──▶ in_progress ──agent resolves──▶ resolved ──user confirms──▶ closed
   ▲                            │                              │                           │
   │ agent/lead                  │ user replies "still broken"  │ 5 business days silence   │ reopen ≤30d
   └────── reopen ◀──────────────┘                              │ (auto-close, system)      │ (user)
                                                                ▼                           ▼
                                                             closed ◀──────────────── in_progress
```

- **Who moves what:** user: open (create), confirm (resolved→closed), reopen (resolved/closed→in_progress). Agent: claim (open→in_progress), mark resolved (in_progress→resolved). Lead: assign/reassign, extend SLA once with reason. System: auto-close, breach-escalate. All transitions via RPC — no direct `UPDATE` on `status`.
- **"Resolved" requires user confirmation before "closed"** — the agent's "resolved" only arms the confirm card (§A.3). If the user is silent for **5 business days**, the system auto-closes with a notice ("Closed automatically — reopen within 30 days if it's not fixed") and the reopen path stays one tap. `reopened_count` > 2 auto-flags the ticket for lead review (churn signal).

### D.3 Notification triggers (scope-filtered, per user prefs)

- On **agent reply**: push + email per the user's notification prefs (default: push on, email on for P1). **Bodies contain no PII** — "New reply on ticket #PK-0042: *Grades not syncing*" (subject only, no message excerpt, no names beyond the ticket subject).
- On **status changes** (assigned, resolved-confirm-request, closed): in-app + push (quiet, no email except close).
- On **grant consent card**: push (high priority) + in-app card; expiry at 24h sends "access expired" in-app note.
- Agents get queue notifications only (counts, SLA-risk) — never user PII in agent push bodies.
- Teens (13+) get notifications on their own tickets directly; parents are **not** CC'd on teen-owned tickets (access-authority consistency, C2).

---

## E. SIGN-OFF GATES (launch-blocking)

1. **Legal:** licensed-attorney approval of every live `LegalAccordion`, the §C.1 retention periods, the §C.3 redaction rules, and the GIPA breach-runbook scoping for support stores. (Not legal advice — this gate is the legal advice.)
2. **Safety:** DV-advocate + safety-designer review of the S2 crisis handoff copy and the "freeze support flow" behavior (§A.2 red box); re-run mandatory-reporter analysis before any human read of chat content begins.
3. **Privacy/access:** access-model owner confirms the grant-scope allowlist excludes health/wellbeing/mood/check-in scopes and that teen-as-consenter (C2) is wired.
4. **Editorial:** FAQ launch corpus ≥90 articles, all FK ≤ 8.0, all 11 mandated legal topics live with accordions.
5. **Security:** RLS policies tested per-role (user / agent / lead / anon); `rpc_claim_ticket` conflict-of-interest tests; redaction filter tested against PAN/SSN/password fixtures.

---

*End of sol-support.md — Support category (S1/S2/S3) solution design.*
