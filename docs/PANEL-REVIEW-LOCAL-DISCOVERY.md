# Panel Review — City Guide / Local Discovery Specialist

**Reviewer domain:** Local discovery (Restaurants W28, Events W27, Trails & Parks W29), teen safety in public spaces, Marietta / Cobb County, GA as the launch area.
**Reviewed:** `USER-FIRST-ACCESS-MODEL-SPEC.md` (locked 2026-10-12) and `FEATURE-LIST-FOR-PANEL.md` (all 8 categories).
**Legend:** ✅ clear · ⚠️ needs change · 🛑 blocked (as designed)

---

## 1. Verdicts on the access model (from the local-discovery angle)

### §4 Age tiers — ⚠️ needs change (discovery-visibility gap)
The tier mechanics (cooling-off, continuity, consent) are sound, but the spec never defines **what "discovery data" is** and **who sees it**. A teen's saved events, restaurant visits, trail plans, and shared itineraries are location/behavior data — the most sensitive category in a family app after health. Two problems:

1. **"What's visible" transparency (§4, §10.3) doesn't enumerate discovery.** The Sharing screen must name these explicitly: *"Mom can see your saved places, events you're going to, and trails you plan."* A teen consenting to "grades, check-ins, health" never consented to location history.
2. **No trusted-contact model for safety when a parent is revoked.** "Share your plans" (see §3.1 below) needs a destination the *teen* picks — a friend, a coach, the *other* parent — not an assumption that a parent is the recipient. After a 13–15 revocation completes or a 16–17 teen revokes instantly, safety features must keep working with the teen's chosen contact. They must never degrade as leverage.

**Concrete spec change — §4, add to each tier:**
> QUOTE: "May grant/revoke freely, **except** revoking a parent triggers a **7-day cooling-off**…"
> REPLACEMENT: add a new bullet under each tier:
> - **Discovery & location data:** saved events, restaurants, trails, and shared outing plans are classified as *teen-sensitive location data*. They appear in the "Who can see my stuff?" screen as a separate toggle ("Places & plans I'm saving"), defaulting to **parent-visible under 16, teen-controlled at 16+**. Revoking a parent never disables the teen's own safety features ("Share my plans", severe-weather alerts); the teen is prompted to pick a new trusted contact at revoke time.

### §6 "Go independent" — ⚠️ needs change (safety continuity)
The graduation framing is right. What's missing: the independent teen keeps safety-critical infrastructure — emergency contacts, "share my plans", trail/event alerts — pointed at *their own* contacts, not a vacuum where the parent used to be. Add: during the graduation flow, a mandatory step "Who should get your 'I'm heading out' plans?" with a default of the teen's choice (not a parent).

### §11 Risks table — ⚠️ needs change (missing discovery rows)
Add two rows:
- **Risk:** "AI recommends an 18+/21+ venue, liquor-centric event, or unsafe trail to a teen." **Mitigation:** "Audience-segmented curation (all-ages / 13+ / 18+ / 21+), venue exclusion lists for teen profiles, ground-truth event/restaurant data — no hallucinated listings."
- **Risk:** "Teen shares outing plans with a revoked adult / loses safety net after revoke." **Mitigation:** "Trusted-contact picker at revoke and graduation; safety features never degrade on revoke."

**Overall access-model verdict: ⚠️ needs change** — the authority mechanics are solid, but discovery/location data is an unclassified blind spot and the revoke flow has no safety-contact handoff.

---

## 2. Feature verdicts — the full list

### W27 Events — AI-curated local events, family-fit, date-night → ⚠️ needs change (borderline 🛑 for teen profiles)

**What's right:** AI curation of local events is a genuine differentiator for a life app, and Marietta/Cobb is rich territory (Marietta Square farmers market, Glover Park concerts, Strand Theatre, Battery Atlanta events).

**Problems:**
1. **"Family-fit, date-night" is an adult taxonomy smuggled into a teen product.** The feature list has no audience segmentation. A 14-year-old must never be served "date-night" curation (romantic venues, wine bars, couples' events), and an AI that doesn't know the difference will eventually recommend one. Conversely, parents don't need teen-only concert listings.
2. **No all-ages filtering / 18+/21+ venue exclusion.** The Battery Atlanta, Marietta Square, and downtown Atlanta venues host plenty of 21+ shows and bar-centered events. An LLM summarizing the web will surface "live music Friday night" without the "21+ after 9pm" fine print. **This is a teen-safety issue, not a preference issue.**
3. **Stranger-meetup framing.** AI curation loves "meet new people!" language. For a 13–17 account, events marketed as social mixing need safety copy, not enthusiasm.
4. **Ticket safety.** Teens buy tickets on third-party resellers, get scammed, or meet sellers in person. No mention of official-ticket-link grounding.

**Concrete spec change:**
> QUOTE: `| W27 | Events | AI-curated local events, family-fit, date-night |`
> REPLACEMENT: `| W27 | Events | AI-curated local events with audience modes: Family (all-ages), Teen (13+, school-night aware), Grown-up (date-night, 18+/21+ filtered to adult accounts only). Teen mode hard-excludes 18+/21+ venues, liquor-primary events, and singles/dating-framed events; every listing carries an age tag and an official ticket link. |`

**Improvements:** "School-night aware" — don't push a 9pm Atlanta weeknight show to a teen with an 8am class; surface drive-time/parking reality (Battery traffic, Marietta Square parking); teen-visible "who's going" should only ever show the teen's own friends, never strangers.

### W28 Restaurants — AI discovery by craving/budget/dietary, taste-learned; wired to nutrition → ⚠️ needs change

**What's right:** Taste-learning plus nutrition wiring is a strong loop. Craving/budget/dietary is the right query shape.

**Problems:**
1. **Hallucinated listings.** "AI discovery" over the web will invent restaurants, get hours wrong, and misstate prices. For a teen who drives to a place that doesn't exist — or that closed two years ago — this is a trust-killer and a real-world safety miss (wrong neighborhood, late night). **Grounding requirement: every recommendation must resolve to a verified listing (Google Places / equivalent) with live hours, or it doesn't ship.**
2. **No food-safety signal.** Georgia DPH publishes restaurant inspection scores for Cobb County. Showing the score is cheap, local, and genuinely useful — especially for teens eating out solo.
3. **Dietary without allergens is dangerous.** "Dietary" must include allergen flags. Peanut/tree-nut allergy at a Thai restaurant in Marietta is a 911 scenario; the AI must not recommend a cuisine that conflicts with a logged allergy — ever.
4. **Location data is teen-sensitive** (see §1). Saved restaurants + visit history = a movement log. Classify per the access-model change.
5. **Night/late recommendations for teens.** A 10:30pm "great late-night spot" 25 minutes away in an unfamiliar area is a different product decision for a 15-year-old than a 40-year-old. Teen mode should bias toward well-trafficked, well-lit, familiar-area spots and say why ("busy area, easy parking").

**Concrete spec change:**
> QUOTE: `| W28 | Restaurants | AI discovery by craving/budget/dietary, taste-learned; wired to nutrition |`
> REPLACEMENT: `| W28 | Restaurants | AI discovery by craving/budget/dietary/allergen, taste-learned; wired to nutrition. Every recommendation resolves to a verified live listing (hours, address); GA DPH inspection score shown where available. Allergen conflicts are hard-blocked, never suggested. Teen mode biases to well-trafficked, well-lit spots and explains why. Visit history classified as teen-sensitive location data. |`

### W29 Trails & Parks — Nearby outdoors, difficulty, kid-friendliness, weather-synthesized conditions → ⚠️ needs change

**What's right:** Weather-synthesized conditions is exactly right for Georgia (summer heat index, afternoon thunderstorms, Chattahoochee water levels).

**Problems:**
1. **"Kid-friendliness" is the wrong axis for a teen.** A 15-year-old isn't a "kid" on a playground scale — but is absolutely at risk on the wrong trail. The axis should be **solo-teen suitability**: trail traffic, cell coverage, daylight window, remoteness. The Silver Comet Trail is the canonical local example: wonderful trail, long remote stretches, real history of safety incidents on isolated segments, frequent trailhead break-ins. An AI that recommends "quiet, secluded stretch of the Silver Comet — perfect for solitude!" to a 14-year-old has failed catastrophically.
2. **No Georgia-specific hazard layer.** Kennesaw Mountain: copperheads, ticks, heat, steep grades. Chattahoochee River NRA: water levels, slippery rocks, no-swimming zones. This is knowable, public data (NPS alerts, USGS gauges) — synthesize it.
3. **Difficulty vs. teen solo hiking needs a gate, not a label.** A "difficult" tag doesn't stop anyone. For under-16 accounts, remote/low-traffic trails should require the "Share my plans" step before the app will surface turn-by-turn guidance — nudge, not nag.
4. **Trailhead parking theft** (Kennesaw Mountain, Sope Creek, Cochran Shoals lots are regular targets) deserves a one-line warning on the trail card.

**Concrete spec change:**
> QUOTE: `| W29 | Trails & Parks | Nearby outdoors, difficulty, kid-friendliness, weather-synthesized conditions |`
> REPLACEMENT: `| W29 | Trails & Parks | Nearby outdoors with solo-suitability scoring (traffic, cell coverage, daylight, remoteness) replacing kid-friendliness for 13+; difficulty gated by age for remote trails. Weather-synthesized conditions + GA hazard layer (heat index, storms, river levels, ticks, copperheads, NPS alerts, trailhead-theft notes). Under-16s get a "Share my plans" prompt before remote-trail guidance. |`

### W25 Fuel & Charging — ⚠️ needs change
Cheapest-gas routing is fine, but "nearest charger at 11pm" for a teen driver can mean an empty, unlit lot. Add a **night-safety bias for teen accounts**: prefer well-lit, staffed, 24-hour locations after dark, and say so. Same for isolated gas stations. This is a small change with real protective value.

### W26 Weather — ✅ clear
Hyperlocal forecast + severe alerts + decision translation is exactly right, and it should feed W27/W29/W30 ("storms Saturday — move the hike"). One improvement: severe-weather alerts must reach the *teen directly*, not only through a parent account — teens out at events/trails need the alert themselves.

### W30 Flights — ⚠️ needs change
AI fare prediction and trip assembly are fine, but **minor-traveler rules** need specifics: unaccompanied-minor policies vary by airline (and cost real money — $150+ each way on some carriers), and a teen flying alone needs the itinerary shared with a trusted contact by default. Add an unaccompanied-minor rules table per airline and auto-attach "share my itinerary" to any teen flight.

### W31 Rental Cars — 🛑 blocked (as designed, for teen accounts)
Rental agencies don't rent to under-21s (most require 25; some 21+ with young-driver fees; Georgia follows the national pattern). The feature list notes "Driver-age rules apply" but doesn't say the module is **hidden from teen accounts**. A 16-year-old browsing rental cars is a dead end at best and a scam/fraud vector at worst (third-party sites that "rent to 18+"). **Change: W31 is an adult-account-only module; teen accounts never see it. The driver-age rule isn't a footnote — it's a visibility gate.**

### W24 Credit — ⚠️ needs change
Three things: (1) minors have no credit file, so "3-bureau monitoring + score coaching" for a 15-year-old is meaningless — **gate the module at 18+**; (2) the genuinely valuable teen-adjacent feature is **child identity-theft detection for parents** (a frozen/minimal file with unexpected activity is the signal), which isn't listed; (3) score coaching for 18-year-olds should be basic literacy, not optimization. Rename the intent: adult credit health + child identity-theft watch.

### W6 Driving & Life Skills — ✅ clear, with a gap
Teen-relevant and well-scoped. **Gap:** no mention of **Georgia's graduated licensing (Joshua's Law)** — 30 hours classroom + 6 hours behind-the-wheel instruction required for 16-year-olds, plus the Class D restrictions (no driving midnight–6am, passenger limits in the first 6 months). This is the single most actionable driving content for a Georgia teen and it's missing. Add a GA license-milestone tracker.

### W2 Health / W8 Wellbeing / W17 Friends — ✅ clear
Teen privacy tiers and `teenPrivate` flags are the right call. One discovery intersection: **W17 (Friends) must never feed stranger visibility** — "friends going to this event" shows only mutual, confirmed friends. No "people near you also like this."

### W1 School — ✅ clear (outside my domain, no discovery conflict)
The 13-source model and path-to-90 framing are sound; nothing here collides with local discovery. One integration note: **W27's "school-night aware" curation should read W1's assignment load** — don't recommend a late Atlanta show the night before a Unit test. That's a cross-module win, not a change.

### W5 College & Future — ✅ clear
No discovery issues. A future tie-in: campus-visit trip assembly could use W30/W31/W28 — but that's roadmap, not a fix.

### W4 Activities / W18 Summer — ⚠️ needs change (W18)
Sports/practice web is fine. **W18 Summer camps: Georgia doesn't license all day camps** (many are exempt; overnight camps are DPH-licensed). "AI-curated camp picks" without a vetting/licensing signal repeats the W27/W28 grounding problem. Add: licensing status, staff background-check policy, and camper-to-staff ratio on every camp card.

### W12 Babysitters — ⚠️ needs change
A "trusted sitter directory" that an AI populates from the web is a **child-safety minefield**: no state license to check against, no background check the app can verify. As designed, this is either a parent-curated list (✅ fine) or an AI-recommended stranger list (🛑). **Change: W12 is parent-curated contacts only — no AI discovery of sitters, ever. Teens 13+ looking for sitting *jobs* get a separate, parent-visible "I'm available" card, not a directory of other people's children.**

### W15 Screen Time — ⚠️ needs change (access-model tension)
"Screen limits that stick" implies parent enforcement — but the access model says the child is the access authority and can revoke parent access. What happens to screen limits when a 16-year-old revokes? The spec needs one line: screen-time rules are a **device/household agreement**, not an access grant — revoking data access doesn't revoke household rules, and the app must say that plainly instead of silently dropping enforcement.

### W21 Mail — ✅ clear
Snap-a-photo intake is fine. Minor note: teens' mail (bank letters, school correspondence) inherits the teen's data rights — don't auto-share a teen's mail scan with a parent who has general access unless "Mail" is in their what's-visible list.

### W14 Co-parenting / W10 Fairness / W3 Safety / W19 Emergency — ✅ clear
All sound. **W19 Emergency improvement:** it should consume the "Share my plans" itinerary (see §3.1) — if a teen is overdue from a trail, the emergency card should show the planned route, trailhead, and trusted contact. That's the integration that makes both features real.

### Pookie AI chat + Muse toggle — 🛑 blocked (as designed, for teen safety advice)
Two issues:
1. **The tutor will be asked safety questions** ("is it safe to hike Kennesaw Mountain alone at night?", "this stranger at the event wants to walk me to my car"). The feature list describes the tutor as warm/direct with no safety-advice layer. **There must be a system-level safety policy in the tutor: never endorse solo night hiking, stranger meetups, or isolated locations for minors; always route to "share your plans + trusted contact."** This isn't tone — it's a guardrail.
2. **"Muse toggle (direct, unfiltered)"** — unfiltered must mean *tone* (blunt, no sugarcoating), never *safety bypass*. As written, "unfiltered" next to teen users reads as "the mode where guardrails come off." **Change: rename or respec — "Muse mode: direct tone, same safety rules." Explicitly: safety guardrails apply identically in both modes.**

### API Platform (§8) — ✅ clear
REST surface is sensible. One note: discovery endpoints (if added — saved places, shared plans) must carry the same `granted_by` enforcement as school data. Don't build a side door around the access matrix.

### Settings / Sync console / Credentials — ✅ clear (outside domain)

---

## 3. Concrete spec changes (quote + replacement)

**C1. W27 — audience-segmented curation.** (See §2 W27 above.)

**C2. W28 — grounding + allergen hard-block + inspection scores.** (See §2 W28 above.)

**C3. W29 — solo-suitability scoring + GA hazard layer + share-plans gate.** (See §2 W29 above.)

**C4. W31 — adult-only visibility gate.**
> QUOTE: `| W31 | Rental Cars | Total-cost ranking, loyalty optimization, insurance-trap flags | Driver-age rules apply |`
> REPLACEMENT: `| W31 | Rental Cars | Total-cost ranking, loyalty optimization, insurance-trap flags | **Adult accounts only — hidden from under-18 profiles.** Driver-age rules enforced as a visibility gate, not a footnote. |`

**C5. Muse toggle — safety parity.**
> QUOTE: `Pookie AI chat tab (warm tutor persona) + Muse toggle (direct, unfiltered mode)`
> REPLACEMENT: `Pookie AI chat tab (warm tutor persona) + Muse toggle (direct, no-sugarcoating tone). Safety guardrails are identical in both modes — "unfiltered" describes tone, never safety advice. The tutor carries a system-level minor-safety policy: never endorse solo night outings, stranger meetups, or isolated locations for under-18s; always route to "share your plans" + a trusted contact.`

**C6. W12 — parent-curated only.**
> QUOTE: `| W12 | Babysitters | Trusted sitter directory |`
> REPLACEMENT: `| W12 | Babysitters | Parent-curated trusted sitter contacts only — no AI discovery of sitters. Separate teen "I'm available to sit" card (parent-visible), never a directory of minors. |`

**C7. W24 — 18+ gate + identity-theft watch.**
> QUOTE: `| W24 | Credit | 3-bureau monitoring, balances/APRs/utilization, score coaching, business expenses/tax deductibles |`
> REPLACEMENT: `| W24 | Credit | 18+ only: 3-bureau monitoring, balances/APRs/utilization, score coaching, business expenses/tax deductibles. For parents: child identity-theft watch (unexpected file activity on a minor's SSN) — detection only, no score. |`

---

## 4. Feature improvements (within current designs)

1. **W27 × W1: school-night awareness** — cross-read assignment/test load before recommending late events to teens.
2. **W27: drive-time honesty** — every event card shows real drive time + parking reality from the user's home (Battery Atlanta on a Friday is not "15 minutes away").
3. **W28: "why this is safe" microcopy for teens** — well-lit, busy area, easy parking — one line, factual, not preachy.
4. **W29: USGS/NPS data** — river gauges for the Chattahoochee, NPS alerts for Kennesaw Mountain, on the trail card.
5. **W25: night-safety bias** for teen accounts (lit, staffed, 24-hr locations after dark).
6. **W30: unaccompanied-minor rule table** per airline + default itinerary sharing for teen flights.
7. **W18: camp vetting card** — license status, background-check policy, ratios.
8. **W19 × Share-my-plans: overdue integration** — planned route + trailhead + trusted contact surface in the emergency card.
9. **W26: alerts to the teen directly**, not just the parent account.

## 5. Gaps — features that don't exist but should

**G1. "Share my plans" (the keystone).** Voluntary, teen-controlled: pick an outing (event, restaurant, trail, drive), set a return time, choose a trusted contact. Contact gets the itinerary; if the teen doesn't check in by return-time + grace, the contact is nudged. Works with a friend or coach as the contact — never assumes a parent. This is the single highest-value teen-safety discovery feature and it touches W27/W28/W29/W30/W6/W19. Without it, every other safety recommendation in this review is a lecture with no tool behind it.

**G2. GA DPH restaurant inspection scores** in W28 (public data, Cobb County).

**G3. Georgia driving milestones** in W6 — Joshua's Law tracker (30 hrs class + 6 hrs BTW), Class D restrictions (midnight–6am, passenger limits).

**G4. Event age taxonomy + official ticket links** in W27 (all-ages / 13+ / 18+ / 21+, venue exclusion list for teens).

**G5. Trailhead-theft + GA hazard advisories** in W29 (copperheads/ticks/heat/river levels/NPS alerts).

**G6. "Who's going" privacy rule** — event social features show only mutual confirmed friends, never strangers or "people near you."

**G7. Late-night overlay** — a shared rule across W27/W28/W25: after dark, teen recommendations bias to well-trafficked, well-lit, staffed locations with an explanatory one-liner.

## 6. Reassessment flags (for the panel / Mehedi)

- **R1. "Unfiltered" language anywhere near teen accounts is a liability.** Even with C5's respec, consider renaming the Muse toggle — "unfiltered" will be quoted back at you the first time a teen gets blunt advice about a sensitive topic. "Direct mode" costs nothing.
- **R2. AI curation without grounding will fail publicly.** W27/W28/W18 all assume the LLM knows Marietta. It doesn't — not reliably. Budget for a verified-listings data layer (Places API or equivalent) before launch; LLM summarization sits *on top* of ground truth, not instead of it.
- **R3. The access model's "what's visible" list must be written before build**, with discovery data classified (see §1). If the Sharing screen ships with only "grades, check-ins, health," the consent is incomplete and the first revocation fight will be about location history.
- **R4. W31 and W24 as drawn will embarrass the product** the first week a 16-year-old opens them. Age-gate before the shell ships — the 31-module launch puts every module in front of every user on day one.
- **R5. "Share my plans" needs a teen co-design pass.** The line between "protective" and "patronizing" is drawn by teens, not by this panel. Test the copy with actual 13–17-year-olds in Cobb County before locking it.
- **R6. Revisit W12 after legal review.** A sitter directory — even parent-curated — adjacent to teen profiles deserves a GA-law double-check on liability for referrals.

---

## Verdict summary

| Area | Verdict |
|---|---|
| Access model (discovery angle) | ⚠️ needs change — classify discovery/location data; add trusted-contact handoff on revoke/graduation |
| W27 Events | ⚠️ needs change — audience modes, 18+/21+ exclusion, age taxonomy |
| W28 Restaurants | ⚠️ needs change — grounding, allergens, inspection scores, teen night-safety bias |
| W29 Trails & Parks | ⚠️ needs change — solo-suitability scoring, GA hazard layer, share-plans gate |
| W25 Fuel & Charging | ⚠️ — night-safety bias for teens |
| W26 Weather | ✅ clear (+ alerts to teens directly) |
| W30 Flights | ⚠️ — unaccompanied-minor rules, itinerary sharing |
| W31 Rental Cars | 🛑 blocked as designed — adult-only, hidden from teens |
| W24 Credit | ⚠️ — 18+ gate; add child identity-theft watch |
| W6 Driving | ✅ clear (+ Joshua's Law / GA milestones gap) |
| W2/W8/W17 Health/Wellbeing/Friends | ✅ clear (stranger-visibility rule for W17) |
| W1 School / W5 College | ✅ clear (outside domain) |
| W4 Activities / W18 Summer | ⚠️ — camp vetting card for W18 |
| W12 Babysitters | ⚠️ — parent-curated only, no AI sitter discovery |
| W15 Screen Time | ⚠️ — resolve access-model tension explicitly |
| W21 Mail / W14 / W10 / W3 / W19 | ✅ clear |
| Pookie AI + Muse toggle | 🛑 blocked as designed — minor-safety system policy + "unfiltered" respec required |
| API Platform / Settings | ✅ clear |

**Bottom line:** the discovery trio (W27/W28/W29) is the right product bet for a life app, and the access model's authority mechanics are sound. But three things must change before build: (1) ground every AI recommendation in verified listings — an LLM that invents restaurants will eventually invent one in the wrong place at the wrong hour for a 14-year-old; (2) classify discovery as teen-sensitive location data in the access model with a trusted-contact handoff on revoke; (3) ship "Share my plans" as the tool behind every safety nudge, co-designed with teens so it reads as protective, not patronizing.
