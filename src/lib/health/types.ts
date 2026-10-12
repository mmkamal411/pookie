// Squad 2 — Health Track. Client-safe types and copy contracts.
// Tier names use the plain-language mapping (docs/squads/squad2-health/UX-SPECS.md,
// global design language): H1 "Everyday wellness", H2 "Private health",
// H3 "Most personal", H0 "Never collected". Tier codes never appear in
// user-facing copy. Reading level <= 8th grade. No em dashes in user copy.
//
// Data contracts: docs/solutions/sol-health.md Appendices A (migrations 022-028)
// and B (RPC inventory). The server actions in ./actions.ts implement these
// contracts against the real tables/RPCs. No mocks, no stubs, no TODOs.

export type HealthTier = "H0" | "H1" | "H2" | "H3";

/** Server-computed from children.date_of_birth. Unknown DOB fails closed. */
export type AgeBand = "under13" | "teen_13_15" | "teen_16_17" | "adult" | "unknown";

export type TierAccess = "full" | "locked" | "hidden";

/** Plain-language tier names. The only tier labels the UI may render. */
export const TIER_NAMES: Record<HealthTier, string> = {
  H0: "Never collected",
  H1: "Everyday wellness",
  H2: "Private health",
  H3: "Most personal",
};

export const TIER_DESCRIPTIONS: Record<HealthTier, string> = {
  H0: "Pookie never collects this for anyone under 18.",
  H1: "Steps, sleep, and activity. The basics your devices record.",
  H2: "Weight, medications, allergies, doctor notes, food diary. Stays with you unless you share it.",
  H3: "Records about care you consented to yourself. Only you. Always. There is no switch for this.",
};

/** Machine-readable outcome for every health server action. */
export type HealthActionCode =
  | "ok"
  | "not_signed_in"
  | "not_a_member"
  | "backend_not_ready"
  | "teen_private"
  | "authority_denied"
  | "h3_no_grant_path"
  | "h0_minor_refusal"
  | "minor_numeric_refusal"
  | "adult_only"
  | "validation_failed"
  | "grantee_unverifiable"
  | "dependency_not_ready"
  | "write_failed"
  | "read_failed";

export interface HealthFailure {
  ok: false;
  code: Exclude<HealthActionCode, "ok">;
  /** Plain-language, <= 8th grade. Safe to render. */
  message: string;
}

export type HealthResult<T> = { ok: true; data: T } | HealthFailure;

/** Who the caller is relative to the child whose health is being touched. */
export interface HealthContext {
  childId: string;
  childSlug: string;
  displayName: string;
  /** "parent" | "child" — the caller's own membership role. */
  role: "parent" | "child";
  /** True when the caller is the subject themself (child-role on this child). */
  isSubject: boolean;
  band: AgeBand;
  isMinor: boolean;
  /** True when the spec'd health tables/RPCs exist and answered. */
  schemaReady: boolean;
}

// ---------------------------------------------------------------------------
// Hub (W2)
// ---------------------------------------------------------------------------

export interface HealthReading {
  id: string;
  metricKey: string;
  metricLabel: string;
  value: number;
  unit: string | null;
  recordedAt: string;
  provenance: "manual" | "apple_healthkit" | "google_health_connect" | "provider_import";
  deviceName: string | null;
  enteredByLabel: string | null;
  tier: HealthTier;
}

export interface HubTierSection {
  tier: HealthTier;
  access: TierAccess;
  readings: HealthReading[];
  readingCount: number | null;
}

export interface HealthHubData {
  sections: HubTierSection[];
  deviceSync: DeviceSyncState | null;
}

export type DeviceSyncStatus =
  | "connected"
  | "disconnected"
  | "suspended_pending_reauth"
  | "never_connected";

export interface DeviceSyncState {
  status: DeviceSyncStatus;
  provider: "apple_healthkit" | "google_health_connect" | null;
  deviceName: string | null;
  lastSyncAt: string | null;
}

// ---------------------------------------------------------------------------
// Wellbeing (W8)
// ---------------------------------------------------------------------------

export interface WellbeingEntry {
  id: string;
  enteredAt: string;
  mood: number;
  note: string | null;
  tags: string[];
  tier: HealthTier;
}

export interface WellbeingState {
  entries: WellbeingEntry[];
  /** Days after which journal text auto-purges. Null = default 12-month rolling. */
  retentionDays: number | null;
}

export const MOOD_LABELS: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

// ---------------------------------------------------------------------------
// Nutrition (W23) + Meals (W13)
// ---------------------------------------------------------------------------

export type MealKind = "breakfast" | "lunch" | "dinner" | "snack";

export interface MealCheckin {
  id: string;
  loggedAt: string;
  meal: MealKind;
  foodGroups: string[];
  hungerBefore: number | null;
  fullnessAfter: number | null;
  energyNote: string | null;
}

/** Engagement-only aggregate for parents of minors. No calories, ever. */
export interface NutritionEngagement {
  weekStart: string;
  daysLogged: number;
  mealsRecorded: number;
  mealsByType: Record<MealKind, number>;
  detail: "engagement_only_minor" | "full";
}

export interface NutritionState {
  /** The subject's own recent check-ins / diary rows. */
  checkins: MealCheckin[];
  diary: FoodDiaryEntry[];
  /** Engagement-only aggregate shown to parents of minors. Never calories. */
  engagement: NutritionEngagement | null;
  /** "own" | "engagement" | "locked" */
  view: "own" | "engagement" | "locked";
}

export interface FoodDiaryEntry {
  id: string;
  loggedAt: string;
  description: string;
  caloriesLow: number;
  caloriesHigh: number;
}

export interface MealPlanDay {
  day: string;
  breakfastIdea: string;
  lunchIdea: string;
  dinnerIdea: string;
  notes: string;
  /** Optional links into the recipe library (W13 elevate). */
  breakfastRecipeId?: string | null;
  lunchRecipeId?: string | null;
  dinnerRecipeId?: string | null;
}

export interface MealPlan {
  id: string | null;
  weekStart: string;
  days: MealPlanDay[];
  groceryList: string[];
}

// ---------------------------------------------------------------------------
// W13 elevate — recipes, preferences
// ---------------------------------------------------------------------------

export interface MealIngredient {
  name: string;
  quantity: number;
  unit: string;
}

export interface MealRecipe {
  id: string;
  name: string;
  ingredients: MealIngredient[];
  instructions: string;
  photoUrl: string | null;
  tags: string[];
  favorite: boolean;
  updatedAt: string;
}

export interface MealPreference {
  id: string | null;
  personLabel: string;
  likes: string[];
  dislikes: string[];
  /** Free-text allergen flags ("peanuts", "shellfish"). Explicit entry only. */
  allergenFlags: string[];
}

// ---------------------------------------------------------------------------
// Grants + audit (Sharing)
// ---------------------------------------------------------------------------

export interface HealthGrantState {
  granteeUserId: string;
  granteeLabel: string;
  h1: boolean;
  h2: boolean;
  /** Grace reads of historical records, when a grant recently ended. */
  graceUntil: string | null;
  gracedTiers: HealthTier[];
}

export interface HealthAuditEvent {
  id: string;
  at: string;
  /** Plain-language rendering, e.g. "Mom viewed your everyday wellness". */
  summary: string;
  actorLabel: string;
}

// ---------------------------------------------------------------------------
// 18th-birthday review
// ---------------------------------------------------------------------------

export type ReconsentStatus =
  | "not_due"
  | "pending"
  | "complete"
  | "skipped_private"
  | "unknown";

export interface ReviewQueueRow {
  recordId: string;
  table: string;
  category: string;
  summary: string;
  enteredByLabel: string;
  enteredAt: string;
}

export interface EmergencyContactInput {
  name: string;
  relationship: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// Copy contracts (single source of truth for health UX strings)
// ---------------------------------------------------------------------------

export const COPY = {
  medicalDisclaimerHeader:
    "Pookie shows what your devices recorded. It does not diagnose, treat, or predict anything about your health.",
  medicalDisclaimerFooter:
    "Not a medical device. For medical advice, talk to a clinician.",
  deviceSyncConsent:
    "Your health app data is descriptive only. Steps, sleep, heart rate as recorded. Pookie will not tell you what it means medically.",
  unusualReading:
    "This reading looks unusual. Devices can be wrong. If you feel unwell, talk to a clinician or urgent care.",
  h3FirewallParent:
    "Some health records stay only with your teen. This includes care Georgia lets teens consent to themselves. This is not something you can turn on. It is how Pookie is built.",
  wellbeingFirstRun:
    "Pookie is not a therapist. Private spaces here are not safety-monitored. If you tell Pookie you might act on thoughts of harming yourself, Pookie will reach your trusted adult. That is the one promise it keeps.",
  wellbeingRung1: "Rough day. That counts as data, not failure.",
  wellbeingRung3:
    "We are really glad you told Pookie. You do not have to handle this alone.",
  nedaTitle: "Worried about food, eating, or body image?",
  nedaBody:
    "You deserve support, and support works. NEDA Helpline: 1-800-931-2237 (call or text). Text NEDA to 741741. In crisis, call or text 988.",
  review18Header: "You are 18. Your health information is now private to you.",
  review18Sub:
    "Until today, your parents could see parts of your health info. That access ended last night. Nothing is shared unless you turn it on below.",
  emergencyDecoupled:
    "Emergency contact is not the same as access. If you list Mom here, she can be called in an emergency. She still cannot see your health information unless you turn that on above.",
  hidePastConfirm:
    "This hides health records from before today from your parents, right away. They will see a neutral message. Not what you hid.",
  backendNotReadyTitle: "Health records are not available yet.",
  backendNotReadyBody:
    "The health privacy database is still in legal review. Nothing here holds real health data until the review clears. These screens are fully built and will light up when it does.",
  teenPrivateTitle: "A private space.",
  teenPrivateBody:
    "Wellbeing entries are never visible to parents. Not the words. Not the mood. Not even a summary. This space belongs to the teen alone.",
  noAggregatesLine:
    "Pookie never shows parents wellbeing summaries. There is no parent view of this module, by design.",
} as const;

export interface CrisisResource {
  label: string;
  detail: string;
  href: string;
}

export const CRISIS_RESOURCES: CrisisResource[] = [
  { label: "Call or text 988", detail: "Suicide and Crisis Lifeline", href: "tel:988" },
  { label: "Text HOME to 741741", detail: "Crisis Text Line", href: "sms:741741" },
  {
    label: "GA Crisis and Access Line",
    detail: "1-800-715-4225",
    href: "tel:+18007154225",
  },
];

export function provenanceLabel(
  provenance: HealthReading["provenance"],
  deviceName: string | null,
  enteredByLabel: string | null,
): string {
  switch (provenance) {
    case "apple_healthkit":
      return `From Apple Health${deviceName ? `, ${deviceName}` : ""}. Descriptive only.`;
    case "google_health_connect":
      return `From Google Health Connect${deviceName ? `, ${deviceName}` : ""}. Descriptive only.`;
    case "provider_import":
      return "From your care provider. Descriptive only.";
    case "manual":
    default:
      return enteredByLabel ? `Entered by ${enteredByLabel}.` : "Entered by hand.";
  }
}
