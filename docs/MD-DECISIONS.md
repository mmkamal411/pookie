# Managing Director Decisions — Critical Path Unblockers

**Decided by Muse (Managing Director) on Mehedi's explicit authority, 2026-10-12.**
**Basis:** Expert panel recommendations (Rounds 1+2) + prior Mehedi discussions. Mehedi may override any of these.

---

## D1. 24/7 Emergency-Review Staffing → CONTRACT
**Decision:** Contract a specialized crisis-response vendor for 24/7 break-glass human review. Do NOT build in-house rotation.
**Rationale (panel):** Liability attorney flagged this as the single costliest decision. Path A requires human review of corroboration — low-frequency, high-stakes, needs trained crisis responders, not support agents. The 2 support agents (9–5 ET) handle the non-emergency queue; the contracted service covers break-glass review around the clock.
**Unblocks:** FR-SAFETY-013 (Path A human review); Squad 1 can build the request flow against a vendor API contract.

## D2. AI Training Commitment → "NEVER" (absolute)
**Decision:** Absolute "never train on your data" commitment. No opt-out toggle (nothing to opt out of).
**Rationale (panel):** Liability attorney was explicit — kill the toggle, broad "train" definition (training, fine-tuning, RLHF, evals, embeddings). "Not today" is deceptive-trade-practice risk under FTC precedents. **However:** do NOT publish until Cloudflare/Meta DPA terms are verified with zero-retention-for-training clauses (NFR-PRIVACY-010).
**Unblocks:** FAQ legal accordion content; privacy policy drafting.

## D3. Washington State Posture → COMPLY WITH MHMDA
**Decision:** Full MHMDA compliance. No geofencing, no blocking.
**Rationale:** MHMDA is a superset of practices we're already building (explicit consent, data minimization, no sale). Geofencing is hostile UX and forfeits a major market. The H0–H3 taxonomy + consent flows already align. Incremental cost is documentation, which Fractional Team 1 is producing anyway.
**Unblocks:** Multi-state architecture (build state-aware from day one, don't retrofit).

## D4. Support Scope → Rotating Holiday On-Call + Tiered Financial Authority
**Decision:** 
- Holidays: 2 agents alternate on-call (one on, one off, rotating). AI handles L1; on-call agent takes escalations. Honors Mehedi's "everyday" without burnout.
- Financial: agents may issue credits/adjustments up to $50 in-ticket without escalation; above $50 → Managing Director approval. (Future-proofing — no paid tiers yet.)
**Rationale:** "Everyday" coverage with 2 humans requires rotation math, not heroics. In-ticket resolution is better UX than triage-and-wait; bounds prevent abuse.
**Unblocks:** FR-SUPPORT-003/006 (SLA engine, empowerment scope).

## D5. Second-Parent Onboarding → OPEN SIGNUP (Mehedi override 2026-10-12)
**Decision (revised):** Second parents sign up straight from the main page. No invite required. The "Connect to my family" first-run card is fully functional at launch.
**Flow:** Sign up → "Connect to my family" → identify child (corroborated claim: verified sign-in + name/DOB + creating-parent email + perjury-style + custody attestations) → approval request to Parent A (if child <13) or teen (if 13+) → connected on approval. Invite-from-inside (deep link/QR) remains as the fastest path but is NOT the only path.
**Safeguards (non-negotiable, from Panel Round 2):** no enumeration oracle (rate-limited, uniform responses — can't probe for children's existence); no auto-grant (Parent A or teen must approve); 14-day unresponsive escalation to human review; 30-day re-request lockout after rejection.
**Custody posture:** STAY OUT for v1. Pookie does not adjudicate custody. The `court_order_restriction` flag exists for verified presented orders; disputes go to human review case-by-case.
**Rationale:** Consistent with Mehedi's locked user-first direction (fully automated signup for any user). An invite-only gate recreates the "no-invite dead end" we eliminated.
**Unblocks:** FR-AUTH-011 (Squad 3 builds the full claim flow now, not just invite).

## D6. Time-Boxed Grants → Tiered Caps + Smart Co-Approval
**Decision:**
- Frequency cap: **8/grantee/30d** for recurring/trusted grantees (previously approved, no blocks); **2/30d** for first-time grantees. Installment detection stays active regardless.
- Teen co-approval (13–15): **required for NEW grantees only**, not renewals of existing grants within cap.
**Rationale:** 2/30d blocks legitimate weekly sitters. The cap's purpose is anti-harassment, not anti-convenience. Tiering preserves the safety property while allowing real-world use. Re-approving the same sitter weekly is friction without safety benefit.
**Unblocks:** FR-ACCESS-011 (Squad 4 / W12).

## D7. Location Data → COARSE ONLY (architectural constraint)
**Decision:** Pookie holds city/ZIP-level location ONLY. Never precise GPS. This is an architectural constraint, not a policy.
**Rationale:** No module needs precise location (weather = city; trails/fuel = "nearby" via coarse + user radius). This (a) eliminates the most sensitive category from break-glass disclosure scope, (b) simplifies MHMDA/GIPA compliance, (c) defuses the "where is my child right now" surveillance concern. Any future precise-location need triggers a separate privacy review.
**Unblocks:** Proposal 1 Q2 resolved — break-glass location scope is now "coarse location + W19 medical card" by architecture.

---

**All 7 critical-path decisions resolved. Teams unblocked. Mehedi may override any decision — overrides should be recorded here with rationale.**
