# Pookie Complete Feature List — For Expert Panel Review

**Grouped by category. Georgia state law is the starting jurisdiction.**
**Access model spec:** `docs/USER-FIRST-ACCESS-MODEL-SPEC.md` (child-as-access-authority, age tiers)

---

## 1. CORE PLATFORM
- Google OAuth sign-in + email magic link (no passwords)
- Session management via Supabase Auth, middleware refresh on every request
- Onboarding flow (planned): welcome → display name → optional "add children" → personal dashboard
- 5-tab navigation: Home · Today · Pookie · Progress · More (plain English, per Mehedi)
- Child switcher (multi-child households), active-child persistence
- Nebula theme: dark cosmos, animated starfield, subtle neon glows, divine-light aesthetic
- `/verify-invite` public landing (no login required to view)

## 2. POOKIE AI ASSISTANT
- Pookie AI chat tab (warm tutor persona) + Muse toggle (direct, unfiltered mode)
- Cloudflare Worker `pookie-tutor` (Llama 3.3 70B) backend; graceful fallback if unreachable
- Instant-respond routing (bare greetings local, everything else to AI)
- Weekly open-ended teacher discussion threads (Muse drafts, parent approves)
- Proactive nudges

## 3. TODAY (Daily Ritual)
- Morning ritual view: attention items, quote, weather, due-next, schedule
- "Tonight's plan" assembly
- Check-in cross-check (child's self-report vs synced data, curious non-accusatory tone)

## 4. THE 31 LIFE MODULES (6 groves)

### Grove: Body & Heart 💚
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W2 | Health | Vitals, trends, glanceables; health-app connections | Teen health privacy tiers per Guidance framework |
| W8 | Wellbeing | Daily mood pulse — "how the day actually felt" | **teenPrivate** |
| W13 | Meals | Meal planning — "what's for dinner, planned not panicked" | |
| W22 | Activity | Steps, workouts, streaks; fitness tracker connections | |
| W23 | Nutrition | Food logging — protein, balance | Wired to Restaurants (W28) taste profile |

### Grove: Home & Family 🏡
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W21 | Mail | Physical mail intake — snap a photo → logged with action items, amounts, due dates | |
| W20 | Shopping List | Shared household shopping list | Live route: /household/shopping |
| W11 | Spending | Bank-statement categorization, spending patterns, credit-limit tracking | |
| W7 | Money & Documents | Ledger + document vault (bills, subscriptions, properties) | Bills: 7-day + 2-day reminders; subscriptions tracker; real-estate investor hub |
| W24 | Credit | 3-bureau monitoring, balances/APRs/utilization, score coaching, business expenses/tax deductibles | |
| W14 | Co-parenting | Two-household coordination | Directly intersects access-authority model |
| W12 | Babysitters | Trusted sitter directory | |
| W10 | Fairness | "Fairness lens" — resource/attention equity across children | |

### Grove: School Days 🌿
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W1 | School | **LIVE.** Grades, assignments, path-to-90, class pages, teacher inbox, daily check-ins, file uploads, minutiae calendar | 13-source intelligence model; StudentVUE sync |
| W16 | School Calendar | Holidays, early releases | Lives inside School |
| W5 | College & Future | 50-college simulator (GA in-state + Southeast + national pre-med), HOPE/Zell Miller, essays, aid, visit log, 12-yr anesthesiologist pathway | |
| W4 | Activities | Sports/practice/rehearsal web | |
| W18 | Summer | Camps, plans, summer-break handling | |

### Grove: Safe & Sound 🛡️
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W3 | Safety | Insurance policies, coverage organization | |
| W19 | Emergency | Emergency plan, numbers, document vault | |

### Grove: Growing Up 🌱
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W6 | Driving & Life Skills | Driving progress, life-skills checklist, independence steps | Teen-relevant; licensing age varies by state |
| W15 | Screen Time | Screen limits that stick | |
| W17 | Friends | Social world tracking | **teenPrivate** |

### Grove: Out & About 🌍
| ID | Module | What it does | Notes |
|----|--------|--------------|-------|
| W25 | Fuel & Charging | Cheapest gas / nearest EV chargers, Tesla Superchargers, vehicle-aware | |
| W26 | Weather | Hyperlocal forecast, severe alerts, decision translation | |
| W27 | Events | AI-curated local events, family-fit, date-night | |
| W28 | Restaurants | AI discovery by craving/budget/dietary, taste-learned; wired to nutrition | |
| W29 | Trails & Parks | Nearby outdoors, difficulty, kid-friendliness, weather-synthesized conditions | |
| W30 | Flights | AI fare prediction, family-trip coordination, trip assembly | Minor-traveler rules apply |
| W31 | Rental Cars | Total-cost ranking, loyalty optimization, insurance-trap flags | Driver-age rules apply |

## 5. SCHOOL INTELLIGENCE (W1 detail — the live module)
- 13 data sources: grades, assignments, emails, policies, check-ins, trends, etc., each with named owner (Muse/parent/child)
- Per-class pages: gap-to-90 hero (mission framing, not judgment), color-coded sections, top-3 ranked actions with checkboxes, collapsed-by-default expandable cards
- Path-to-90 checkboxes persisted to Supabase (cross-device)
- Daily check-in per class + handout uploads below the grade hero
- Teacher inbox per class (teacher + counselor + Outlook 365 + Synergy mail merge)
- AI practice quizzes from uploaded unit material; unit auto-alignment
- Peer tips pipeline: 600 fresh unit-tagged tips/week, 4-week expiry
- SAT prep (words, formulas), 3 scheduled blocks
- Lunch/dinner, power-up, notes, news, horoscope daily pulls
- Windows + MacBook sync workers (StudentVUE gradebook via Playwright, queue-based SYNC NOW)
- ParentVUE/CTLS Parent/teacher Gmail pulls feeding briefings

## 6. FAMILY & ACCESS MANAGEMENT (the access-model feature set)
- Parent invites child by email → 7-day expiring token → child verifies with matching login
- 6-digit link codes (15-min expiry) for same-room linking
- Child access authority: child's grants cannot be vetoed/revoked by parents (`granted_by` enforcement)
- Age tiers: <13 stewardship · 13–15 cooling-off revoke · 16–17 instant revoke · 18+ continuity + full control
- "Who can see my stuff?" Sharing screen (teen); per-person toggles; what's-visible transparency
- Access request flow (non-parent adult → child approves → other parent notified, can't veto)
- Block list (teen can permanently block an adult from requesting)
- "Go independent" graduation flow (confetti, own Pookie)
- 18th-birthday ownership prompt (continuity default)
- `graduate_child_access` RPC (data preserved, access transitions)
- Claim dedupe (fuzzy match on verify → link existing vs duplicate)

## 7. SETTINGS & DATA MANAGEMENT
- Settings → Profile, Sync console, Health connections, Credentials vault, Family
- Sync console: manual SYNC NOW, worker health, queue status
- Credentials: school portal logins (StudentVUE/ParentVUE), stored encrypted
- Notification preferences
- Data retention policies (per-source; check-ins indefinite, emails TBD)

## 8. API PLATFORM
- `GET /api/v1/me` (planned)
- `/api/v1/children/[childId]/school/*` — assignments, checkins, classes, uploads, due-next, overview, plans, teacher-messages (+approve/send), minutiae (+ingest)
- `/api/v1/children/[childId]/college/*` — deadlines, essays (+feedback)
- `/api/v1/household/*`, `/api/v1/invites/*`, `/api/v1/tutor/*`
- Notifications API (planned)

---

**Panel task:** for EVERY feature above, assess from your domain — legal compliance (GA), child-development appropriateness, and concrete improvements that stay inside the law. Mark each: ✅ clear · ⚠️ needs change · 🛑 blocked. Flag gaps the list doesn't cover.
