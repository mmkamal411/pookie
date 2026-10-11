// W22/W23 shared copy — guidance-pod rules on every string:
// shame-free, no diagnoses, "talk to your doctor" rails.
// Wellness tracking, never a medical device.

/** The rail under every health/nutrition surface. */
export const DOCTOR_RAIL =
  'Pookie tracks wellness trends, never diagnoses. If a number worries you, talk to your doctor — that is what they are for.';

/** Short variant for tight UI spaces. */
export const DOCTOR_RAIL_SHORT =
  'Wellness tracking only — not medical advice. Talk to your doctor with concerns.';

/** Why weight is invisible to teen tenants (founder rule). */
export const WEIGHT_HIDDEN_NOTE =
  'Weight stays out of the teen view on purpose — tracking works best pressure-free. A parent can still log it after a doctor visit.';

/** Teen privacy promise (sensitive-default-private, 13–17). */
export const TEEN_PRIVACY_PROMISE =
  'Some health details stay private to you by default. A parent can only see them with your knowledge, through a recorded safety override.';

/** Parent override explainer (shown before the reason form). */
export const OVERRIDE_EXPLAINER =
  'A safety override lets you see one sensitive metric for your teen. It is recorded, the teen is told right away, and you can undo it any time. Overrides are for safety — not curiosity.';

/** Shame-free target-kind descriptions (W23). No deficit kind exists — by design. */
export const TARGET_KIND_COPY: Record<string, string> = {
  maintain:
    'Steady energy for school, sports, and growing — a balanced day, every day.',
  athletic_performance:
    'Fuel for training days: enough energy to practice hard and recover well.',
  healthy_gain:
    'Growing strong: a little extra fuel each day, built from real meals.',
  medical_recovery:
    'Getting back to full strength with your clinician’s plan as the guide.',
};

/** What-if simulator framing — information, never judgment. */
export const WHATIF_FRAMING =
  'No judgment here — just the numbers, so you can plan the rest of your day.';

/** Real-food-first policy line (founder-locked). */
export const REAL_FOOD_FIRST =
  'Real food first: the answer to a nutrition gap is always a meal, not a pill. Supplements only enter the picture with your doctor.';

/** Photo-estimate honesty badge. */
export const ESTIMATE_BADGE =
  'Estimate — a photo can suggest a range, never an exact number.';

/** Dexcom/manual source honesty for glucose. */
export const GLUCOSE_SOURCES_NOTE =
  'Glucose here comes from manual entries. A live Dexcom feed arrives in a later release.';
