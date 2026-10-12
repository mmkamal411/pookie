# Expert Review — Municipal Governance Advisor (City Mayor's Perspective)

**Reviewer:** municipal/community governance lens · **Spec:** USER-FIRST-ACCESS-MODEL-SPEC.md (locked 2026-10-12)
**Starting community:** Marietta / Cobb County, Georgia · **Date:** 2026-10-12

Ground facts verified via public sources: Cobb PARKS manages ~90 properties / 78 developed parks / 6,000+ acres / 60+ miles of trails, with recreation centers (Fair Oaks, Fullers, Milford, Ron Anderson, Ward) and arts centers; Marietta PAL runs after-hours youth sports (grades K–12) at Lawrence Street Recreation Center with a juvenile-crime-prevention mission; Cobb County Public Library runs teen programs (grades 6–12: Teen Connect, Teen Drama Club, Teen Board Game Night) plus Library PASS (student-ID library access); Cobb County Youth Commission serves grades 9–12 with annual applications; Keep Cobb Beautiful runs an Associate Board Member program (juniors/seniors, 16+, 35 service hours, scholarships); the county pushes severe-weather and boil-water alerts through the CobbGov app.

---

## 1. Verdict per relevant spec section

- **§1 Product principles — ACCEPT with addition.** The five principles are sound and map well to a civic-responsibility posture (server-side enforcement, no client-derived roles). Missing: a sixth principle committing that Pookie never routes user or teen data to government systems. In a mayor's chair, a teen-safety app that quietly shares data with the city is a scandal; one that loudly promises it never does is a partner.
- **§2 Signup & onboarding — ACCEPT.** No municipal issue. Note: onboarding is the right place to ask the user's home county/city (drives the civic-resource layer below) — currently no location capture in the 3-step flow.
- **§3 Child access authority matrix — ACCEPT.** The granter-only revocation rule is the strongest child-safety property in the spec and it is exactly what a city youth-services director would want to hear: no adult can lock another adult out, no parent can strip the child's own control.
- **§4 Age tiers — ACCEPT with modifications.** The 13–15 cooling-off and 16–17 instant-revoke tiers are reasonable. From a public-safety standpoint the gap is: a 13–15-year-old using Trails & Parks / Events Near Me to go somewhere new has no safety affordance at all. The spec handles *who sees the data* but not *who knows where the kid is going*.
- **§5 Child linking — ACCEPT.** No municipal concern.
- **§6 "Go independent" — ACCEPT with addition.** Graduation framing is excellent civic messaging. But "your own Pookie" for a 13-year-old means an independent teen navigating real streets, trails, and restaurants with zero city-resource awareness built in. The independence flow should hand them the community safety toolkit (below).
- **§7 "Just me" mode — ACCEPT.** No municipal concern.
- **§8 Migrations — ACCEPT.** `granted_by` enforcement is the load-bearing wall; do not weaken it later.
- **§9 API surface — ACCEPT.** Note: any future civic-integration RPC (e.g., reporting a park issue to the county) must run under the *user's* session and consent, never as a silent municipal feed — see spec change #4.
- **§10 UI screens — ACCEPT with addition.** The Sharing screen and independence flows are the right surfaces to add optional safety tools (share-my-plan, county-alert enrollment) without turning them into surveillance.
- **§11 Risks & mitigations — REVISE.** The risk table is missing the highest-likelihood municipal incident: a teen goes to an app-recommended location and something bad happens. Add as risk #9.

---

## 2. Concrete spec changes (quote + replacement)

**Change 1 — §11, add risk #9 to the table.**

Quote:
```
| 8 | Non-parent UX | Genuine "just me" dashboard; no upsell harassment |
```

Replacement:
```
| 8 | Non-parent UX | Genuine "just me" dashboard; no upsell harassment |
| 9 | Teen harmed at app-recommended location (trail, event, restaurant) | Community safety layer in location modules: recommend established public venues only; show hours/staffing; suppress isolated trailheads after dark for 13–15; one-tap "share my plan" (not surveillance); report-a-problem routes to city/county channels, not just in-app reviews |
| 10 | App perceived as a government data pipeline | Standing principle: Pookie never shares user/teen records or location with municipal or government systems except at explicit user request or legal compulsion; stated in privacy policy and onboarding |
```

**Change 2 — §1, add principle 6.**

Quote:
```
5. All access decisions are enforced server-side. The client never derives roles.
```

Replacement:
```
5. All access decisions are enforced server-side. The client never derives roles.
6. Pookie is not a government data pipeline. User and teen records are never shared with municipal or government systems except at explicit user request or legal compulsion.
```

**Change 3 — §4, 13–15 tier: add optional safety affordance (not surveillance).**

Quote:
```
- Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today."
```

Replacement:
```
- Confirmation lists consequences: "Your grades will stop updating. Mom and Dad will be notified today."
- Safety tools are offered, never imposed: any 13–17 user gets one-tap "share my plan" (destination + ETA sent to a chosen contact) in the location modules, and a nudge to enable county emergency alerts (CobbGov app / NWS alerts) during onboarding. These are user-controlled tools; they do not create parent visibility or override the access matrix.
```

**Change 4 — §6, add community handoff to the graduation flow.**

Quote:
```
- Marketing rule: **"Pookie grows with your child — from you managing everything, to shared oversight, to their own independent assistant."** Never "your teen can cut you off."
```

Replacement:
```
- Marketing rule: **"Pookie grows with your child — from you managing everything, to shared oversight, to their own independent assistant."** Never "your teen can cut you off."
- Graduation hands the teen a community toolkit: the city's supervised options (recreation centers, library teen programs, PAL after-hours sports), transit options, and emergency-alert enrollment — so "your own Pookie" means "your own city, navigated safely," not just "no one watching."
```

**Change 5 — §2 onboarding: capture home locality.**

Quote:
```
      Step 2: "Do you want to track children in Pookie?" [Yes / Skip for now]
```

Replacement:
```
      Step 2: "Where's home base?" (city/county — drives local resources, transit, and alerts; editable in Settings)
      Step 3: "Do you want to track children in Pookie?" [Yes / Skip for now]
```

(Step numbering shifts; "Done → dashboard" becomes Step 4.)

---

## 3. Feature improvements (municipal lens)

1. **Community resource layer in location modules.** Events Near Me, Trails & Parks, and Restaurants Near Me should carry a civic directory seeded per locality: Cobb PARKS rec centers and arts centers, Cobb County Public Library teen programs (grades 6–12, plus Library PASS so a student ID is a library card), Marietta PAL after-hours sports at Lawrence Street Recreation Center, CobbLinc transit routes for car-less teens. Prefer these in recommendations: they are staffed, free or cheap, and supervised — the mayor's definition of a good teen recommendation.
2. **Hyperlocal Weather: defer life-safety to the county.** The module should forecast; it must not present itself as the alert system. Deep-link to county alert enrollment (CobbGov app notifications: Cobb Alerts + NWS Alerts; text-to-99411 CodeRED-style enrollment where offered) and label official alerts distinctly: "Official county alert — follow county guidance," never paraphrased as Pookie advice. Also surface non-weather county advisories the app already has a channel for (boil-water advisories).
3. **Report-a-problem bridge.** At civic locations, offer "report an issue here" that routes to the right city/county channel (parks maintenance, broken lighting, graffiti) instead of only an in-app review. This is the correct app↔city relationship: the city fixes infrastructure, the app reports it. It also builds the municipal partnership story without any data-sharing.
4. **Civic engagement track.** Add to Grow or Plan: (a) Cobb County Youth Commission applications (grades 9–12, annual fall window — currently recruiting); (b) Keep Cobb Beautiful Associate Board Member program (juniors/seniors 16+, 35 service hours, scholarship eligibility); (c) library teen advisory boards; (d) volunteer-hour logging that maps to school service-hour requirements. This is age-appropriate civic engagement with real, verified local programs — not generic "volunteer" filler.
5. **Trail/event safety metadata.** Trails & Parks entries should show: official park hours, whether the trailhead is staffed/rangered, and after-dark suppression rules for under-16 users (no isolated-trailhead recommendations after sunset). Events should prefer permitted, organized events over informal gatherings for the 13–15 cohort.

---

## 4. Gaps

- **The access model governs *who sees records*, not *what the location modules recommend*.** The highest civic-risk surface (teens discovering real places) lives in module specs that don't exist yet in this document. The safety-layer rules above must be written into the Events/Trails/Restaurants module specs when they're drafted — this spec should reference that obligation.
- **No incident-response posture.** If a teen is harmed at a recommended location, the spec says nothing about what Pookie does next (preserve recommendation history for investigators? cooperate with law enforcement under legal process? notify the linked parent?). A one-paragraph incident protocol belongs in §11.
- **Transit is the missing mobility link.** Teens 13–17 mostly can't drive themselves. Every "go here" recommendation without a "get here" answer (CobbLinc routes, walking safety, daylight constraints) is half a feature and a safety gap.
- **18+ continuity vs. city programs.** At 18, school-credential handoffs are covered (§4), but city youth programs age out too (PAL, Youth Commission are youth-scoped). The graduation flow could note which community resources transition at 18 — minor, but it's the kind of detail a city partner would notice.

---

## 5. Reassessment flags

- **Reassess if Pookie takes any official municipal data feed** (parks hours, program listings, alert ingestion). A read-only public-data feed is fine and changes nothing; any two-way flow (usage data back to the city, or the city pushing content into teen feeds) reopens the privacy principle in Change 2 and the access-authority model.
- **Reassess if emergency-alert handling goes beyond deep-linking.** If Pookie ingests and re-presents NWS/county alerts in-app, that creates a duty-of-timeliness expectation the app doesn't have today. Stay a signpost, not a siren, unless counsel signs off.
- **Reassess the safety-layer rules when the location-module specs are written.** This review's Change 1 assumes those specs will adopt venue-vetting, hours/staffing metadata, and after-dark suppression. If they don't, the risk #9 mitigation is paper only.
- **Reassess if "share my plan" is ever made visible to parents by default.** It must remain user-initiated and user-chosen-contact; any drift toward automatic parent visibility would contradict the §3 access matrix and the child-authority principle the whole spec rests on.
- **Liability note for the record (not legal advice):** Georgia's recreational-use statute (O.C.G.A. § 51-3-20 et seq.) generally shields landowners — including the county — who permit free public recreational use, which bounds the *city's* exposure for park incidents. The *app's* exposure is reputational and civic: a mayor will judge Pookie on whether it steered a kid somewhere sensible and whether it cooperated cleanly afterward, not on statute. The disclaimers, safety metadata, and incident protocol above are the civic-expectation layer.

---

*End of municipal governance review.*
