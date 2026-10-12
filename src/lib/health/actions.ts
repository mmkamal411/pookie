"use server";

// Squad 2 — Health Track: tier-aware server actions for W2/W8/W23/W13,
// the 18th-birthday review, and Sharing -> Health.
//
// Data contracts (this file implements them against the real tables/RPCs):
//   docs/solutions/sol-health.md Appendix A (migrations 022-028) and
//   Appendix B (RPC inventory); tier predicate semantics in sol-health
//   sections 1.3 (access matrix), 1.6 (health_tier_visible), 2 (re-consent),
//   3 (grace/deletion), 5 (W8), 6 (W23/W13).
// Backend dependencies (Squad 2 backend): migrations 022-028 applied, which
// creates health_metrics, wellbeing_entries, meal_checkins, food_logs,
// health_consent_grants, health_grace, health_device_tokens, meal_plans,
// health_preferences, plus the Appendix B RPCs. Until then every action
// returns backend_not_ready with honest copy. No mocks, no stubs, no TODOs.
//
// Security posture: every query uses the user-JWT server client, so RLS is
// the enforcement backstop. This layer ALSO enforces the tier predicate in
// code (deny by default), so a misconfigured policy cannot widen access.
// Product code never uses service_role here.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import type {
  AgeBand,
  FoodDiaryEntry,
  HealthActionCode,
  HealthContext,
  HealthFailure,
  HealthGrantState,
  HealthHubData,
  HealthReading,
  HealthResult,
  HealthTier,
  HubTierSection,
  MealCheckin,
  MealKind,
  MealPlan,
  NutritionEngagement,
  NutritionState,
  ReconsentStatus,
  ReviewQueueRow,
  TierAccess,
  WellbeingEntry,
  WellbeingState,
} from "./types";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fail(code: Exclude<HealthActionCode, "ok">, message: string): HealthFailure {
  return { ok: false, code, message };
}

function ok<T>(data: T): HealthResult<T> {
  return { ok: true, data };
}

/** True when the error means "table/RPC/column not in the database yet". */
function isRelationMissing(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number };
  const hay = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();
  return (
    e.code === "PGRST202" || // PostgREST: function not found
    e.status === 404 ||
    hay.includes("does not exist") ||
    hay.includes("relation") && hay.includes("not found")
  );
}

function fullYears(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age -= 1;
  return age;
}

function bandFor(dob: string | null): AgeBand {
  if (!dob) return "unknown";
  const age = fullYears(dob);
  if (age < 13) return "under13";
  if (age <= 15) return "teen_13_15";
  if (age <= 17) return "teen_16_17";
  return "adult";
}

const BACKEND_NOT_READY_MSG =
  "Health records are not available yet. The health privacy database is still in legal review.";

// ---------------------------------------------------------------------------
// Context resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the caller's membership, the subject's age band, and whether the
 * spec'd health schema is present. Fails closed on every error.
 */
export async function getHealthContext(childId: string): Promise<HealthResult<HealthContext>> {
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child_id === childId);
  if (!membership) return fail("not_a_member", "You do not have access to this child's space.");

  const supabase = await createClient();

  let band: AgeBand = "unknown";
  try {
    const { data, error } = await supabase
      .from("children")
      .select("date_of_birth")
      .eq("id", childId)
      .single();
    if (!error) band = bandFor(data?.date_of_birth ?? null);
  } catch {
    band = "unknown";
  }

  // Schema probe: the first health table (migration 022). Any error, including
  // RLS misconfiguration, fails closed into not-ready.
  let schemaReady = false;
  try {
    const { error } = await supabase
      .from("health_metrics")
      .select("id", { head: true, count: "exact" });
    schemaReady = !error;
  } catch {
    schemaReady = false;
  }

  return ok({
    childId,
    childSlug: membership.child.slug,
    displayName: membership.child.nickname ?? membership.child.first_name,
    role: membership.role,
    isSubject: membership.role === "child",
    band,
    isMinor: band !== "adult",
    schemaReady,
  });
}

async function requireContext(childId: string): Promise<HealthContext> {
  const res = await getHealthContext(childId);
  if (!res.ok) throw res;
  return res.data;
}

/** user_id -> display label for everyone linked to the child. Best effort. */
async function linkedLabels(childId: string): Promise<Map<string, string>> {
  const labels = new Map<string, string>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("child_access")
      .select("user_id, role, users(email, display_name)")
      .eq("child_id", childId);
    if (error || !data) return labels;
    for (const row of data) {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      const label =
        (u && (u.display_name || u.email?.split("@")[0])) ||
        (row.role === "parent" ? "A parent" : "Someone");
      labels.set(row.user_id, label);
    }
  } catch {
    // Labels are cosmetic; the tier checks below never depend on them.
  }
  return labels;
}

// ---------------------------------------------------------------------------
// Tier predicate (sol-health section 1.3 access matrix + 1.6, in code)
// ---------------------------------------------------------------------------

interface TierCheck {
  band: AgeBand;
  isSubject: boolean;
  tier: HealthTier;
  /** Caller holds an active grant for this tier (Wellness scope for H1). */
  hasGrant: boolean;
  /** Active, unexpired, teen-notified safety override (H2 only). */
  hasOverride: boolean;
}

/**
 * Code mirror of health_tier_visible(). Deny by default. RLS enforces the
 * same predicate in the database; this layer must never be more permissive.
 * Module-private: "use server" files may only export async functions, and
 * nothing imports this externally.
 */
function tierVisibleFor(check: TierCheck): boolean {
  const { band, isSubject, tier, hasGrant, hasOverride } = check;
  if (tier === "H0") return isSubject && band === "adult";
  if (isSubject) return true;
  switch (band) {
    case "under13":
      // Stewardship: parents see H1/H2. H3 is not collected under 13.
      return tier === "H1" || tier === "H2";
    case "teen_13_15":
    case "teen_16_17":
      if (tier === "H1") return hasGrant;
      if (tier === "H2") return hasGrant || hasOverride;
      return false; // H3: no grant arm, no override arm, ever.
    case "adult":
      // Post-18: visibility only via affirmative per-tier re-consent.
      // H3 never has a grant row, so this is false for H3 by construction.
      return hasGrant;
    default:
      return false; // unknown DOB fails closed.
  }
}

/** Who may change health sharing grants (sol-health sections 1.3, 2.3). */
function mayManageGrants(ctx: HealthContext): boolean {
  if (ctx.band === "under13") return ctx.role === "parent"; // stewardship
  return ctx.isSubject; // 13+: the teen; 18+: the adult themself
}

// ---------------------------------------------------------------------------
// W2 — Health hub
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<string, { label: string; unit: string }> = {
  steps: { label: "Steps", unit: "steps" },
  steps_daily: { label: "Steps", unit: "steps" },
  sleep_hours: { label: "Sleep", unit: "hours" },
  heart_rate_resting: { label: "Resting heart rate", unit: "bpm" },
  heart_rate_variability: { label: "Heart rate variability", unit: "ms" },
  hrv: { label: "Heart rate variability", unit: "ms" },
  active_minutes: { label: "Active minutes", unit: "min" },
  weight: { label: "Weight", unit: "lb" },
  height: { label: "Height", unit: "in" },
  blood_glucose: { label: "Blood glucose", unit: "mg/dL" },
  blood_pressure_systolic: { label: "Blood pressure (systolic)", unit: "mmHg" },
  blood_pressure_diastolic: { label: "Blood pressure (diastolic)", unit: "mmHg" },
  spo2: { label: "Blood oxygen", unit: "%" },
  water_intake: { label: "Water", unit: "cups" },
};

function toReading(row: Record<string, unknown>, labels: Map<string, string>): HealthReading | null {
  const metricKey = typeof row.metric_key === "string" ? row.metric_key : null;
  const value = typeof row.value === "number" ? row.value : Number(row.value);
  const tier = row.health_tier;
  if (!metricKey || !Number.isFinite(value)) return null;
  if (tier !== "H0" && tier !== "H1" && tier !== "H2" && tier !== "H3") return null;
  const known = METRIC_LABELS[metricKey];
  const enteredBy =
    typeof row.entered_by === "string" ? labels.get(row.entered_by) ?? "Someone" : null;
  const provenance = row.provenance;
  return {
    id: String(row.id ?? `${metricKey}-${row.recorded_at ?? ""}`),
    metricKey,
    metricLabel: known?.label ?? metricKey.replace(/_/g, " "),
    value,
    unit: typeof row.unit === "string" ? row.unit : (known?.unit ?? null),
    recordedAt: typeof row.recorded_at === "string" ? row.recorded_at : new Date().toISOString(),
    provenance:
      provenance === "apple_healthkit" ||
      provenance === "google_health_connect" ||
      provenance === "provider_import"
        ? provenance
        : "manual",
    deviceName: typeof row.device_name === "string" ? row.device_name : null,
    enteredByLabel: enteredBy,
    tier,
  };
}

/**
 * W2 hub data. Contract: health_metrics (022, section 1.6) with health_tier,
 * provenance, device_name, recorded_at, subject_id; health_consent_grants
 * (022, section 1.6); health_device_tokens (023, section 2.1).
 */
export async function getHealthHub(childId: string): Promise<HealthResult<HealthHubData>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  const labels = linkedLabels(childId);

  // Active grants held by this caller (parents) — empty for the subject.
  let grants = new Set<HealthTier>();
  if (!ctx.isSubject) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("health_consent_grants")
        .select("tier")
        .eq("child_id", childId)
        .eq("grantee_user_id", user?.id ?? "")
        .is("revoked_at", null);
      if (!error && data) {
        for (const g of data) {
          if (g.tier === "H1" || g.tier === "H2") grants.add(g.tier);
        }
      }
    } catch {
      grants = new Set();
    }
  }

  const sections: HubTierSection[] = [];
  const labelMap = await labels;
  const tiers: HealthTier[] = ["H1", "H2", "H3"];

  for (const tier of tiers) {
    const visible = tierVisibleFor({
      band: ctx.band,
      isSubject: ctx.isSubject,
      tier,
      hasGrant: grants.has(tier),
      hasOverride: false,
    });
    // No existence signals for H3 to non-subjects (sol-health section 8.2):
    // the section is hidden, never counted.
    const access: TierAccess = !visible ? (tier === "H3" ? "hidden" : "locked") : "full";

    let readings: HealthReading[] = [];
    let readingCount: number | null = null;
    if (access === "full") {
      try {
        const { data, error } = await supabase
          .from("health_metrics")
          .select("*")
          .eq("subject_id", childId)
          .eq("health_tier", tier)
          .order("recorded_at", { ascending: false })
          .limit(24);
        if (error) {
          if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
          return fail("read_failed", "Could not load health readings. Check your connection and try again.");
        }
        readings = (data ?? [])
          .map((r) => toReading(r as Record<string, unknown>, labelMap))
          .filter((r): r is HealthReading => r !== null);
        readingCount = readings.length;
      } catch {
        return fail("read_failed", "Could not load health readings. Check your connection and try again.");
      }
    }

    sections.push({ tier, access, readings, readingCount });
  }

  // Device sync state (023). Absent table -> null, not fatal.
  let deviceSync: HealthHubData["deviceSync"] = null;
  try {
    const { data, error } = await supabase
      .from("health_device_tokens")
      .select("status, provider, device_name, last_sync_at")
      .eq("child_id", childId)
      .order("last_sync_at", { ascending: false })
      .limit(1);
    if (!error && data && data.length > 0) {
      const t = data[0] as Record<string, unknown>;
      const status = t.status;
      deviceSync = {
        status:
          status === "connected" ||
          status === "disconnected" ||
          status === "suspended_pending_reauth"
            ? status
            : "never_connected",
        provider:
          t.provider === "apple_healthkit" || t.provider === "google_health_connect"
            ? t.provider
            : null,
        deviceName: typeof t.device_name === "string" ? t.device_name : null,
        lastSyncAt: typeof t.last_sync_at === "string" ? t.last_sync_at : null,
      };
    } else if (!error) {
      deviceSync = { status: "never_connected", provider: null, deviceName: null, lastSyncAt: null };
    }
  } catch {
    deviceSync = null;
  }

  return ok({ sections, deviceSync });
}

/** Disconnect a wearable feed. Contract: health_device_tokens (023, section 2.1). */
export async function disconnectDeviceSync(childId: string): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject && !(ctx.band === "under13" && ctx.role === "parent")) {
    return fail("authority_denied", "Only the teen can change device sync.");
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("health_device_tokens")
      .update({ status: "disconnected" })
      .eq("child_id", childId)
      .neq("status", "disconnected");
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not disconnect. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not disconnect. Try again.");
  }
  return ok({ done: true });
}

// ---------------------------------------------------------------------------
// W8 — Wellbeing (teen-private; no parent aggregates, ever)
// ---------------------------------------------------------------------------

function mayUseWellbeing(ctx: HealthContext): boolean {
  if (ctx.isSubject) return true;
  return ctx.band === "under13" && ctx.role === "parent"; // stewardship only
}

const wellbeingCheckinSchema = z
  .object({
    mood: z.number().int().min(1).max(5),
    note: z.string().max(2000).optional(),
    tags: z.array(z.string().max(30)).max(10).default([]),
    needHelpNow: z.boolean().default(false),
  })
  .strict();

/**
 * W8 state. Contract: wellbeing_entries (025, section 5.1) — teen-only RLS.
 * There is deliberately no parent aggregate path (section 5.1).
 */
export async function getWellbeingState(childId: string): Promise<HealthResult<WellbeingState>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayUseWellbeing(ctx)) {
    return fail(
      "teen_private",
      "Wellbeing entries are never visible to parents. Not the words, not the mood, not even a summary.",
    );
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("wellbeing_entries")
      .select("id, entered_at, mood_score, mood_label, journal_text, tags, health_tier")
      .eq("child_id", childId)
      .is("deleted_at", null)
      .order("entered_at", { ascending: false })
      .limit(30);
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("read_failed", "Could not load your entries. Check your connection and try again.");
    }
    const entries: WellbeingEntry[] = (data ?? []).map((r) => ({
      id: r.id,
      enteredAt: r.entered_at,
      mood: r.mood_score,
      note: r.journal_text,
      tags: r.tags ?? [],
      tier: r.health_tier === "H3" ? "H3" : "H2",
    }));

    let retentionDays: number | null = null;
    try {
      const { data: pref } = await supabase
        .from("health_preferences")
        .select("wellbeing_retention_days")
        .eq("child_id", childId)
        .limit(1);
      if (pref && pref.length > 0) retentionDays = pref[0].wellbeing_retention_days ?? null;
    } catch {
      retentionDays = null;
    }

    return ok({ entries, retentionDays });
  } catch {
    return fail("read_failed", "Could not load your entries. Check your connection and try again.");
  }
}

/**
 * Log a mood pulse / journal entry. Crisis-event emission (wellbeing_events,
 * section 5.3) is a database trigger owned by the backend; the client routes
 * needHelpNow to the crisis UI immediately.
 */
export async function submitWellbeingCheckin(
  childId: string,
  input: { mood: number; note?: string; tags?: string[]; needHelpNow?: boolean },
): Promise<HealthResult<{ entryId: string }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayUseWellbeing(ctx)) return fail("teen_private", "This space belongs to the teen alone.");
  const parsed = wellbeingCheckinSchema.safeParse(input);
  if (!parsed.success) return fail("validation_failed", "That check-in did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("wellbeing_entries")
      .insert({
        child_id: childId,
        mood_score: parsed.data.mood,
        journal_text: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
        tags: parsed.data.tags,
        health_tier: "H2",
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error && isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save your check-in. Try again.");
    }
    return ok({ entryId: data.id });
  } catch {
    return fail("write_failed", "Could not save your check-in. Try again.");
  }
}

/** Tombstone a wellbeing entry (section 3.3 deletion pipeline). Teen only. */
export async function deleteWellbeingEntry(
  childId: string,
  entryId: string,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayUseWellbeing(ctx)) return fail("teen_private", "This space belongs to the teen alone.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase
      .from("wellbeing_entries")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", entryId)
      .eq("child_id", childId);
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not delete that entry. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not delete that entry. Try again.");
  }
  return ok({ done: true });
}

const retentionSchema = z.enum(["30", "90", "365", "default"]);

/**
 * Teen's auto-purge setting for journal text (section 5.2).
 * Contract: health_preferences(child_id, wellbeing_retention_days) — provided
 * by the Squad 2 backend in the 025 scope; the nightly purge job reads it.
 */
export async function setWellbeingRetention(
  childId: string,
  days: "30" | "90" | "365" | "default",
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayUseWellbeing(ctx)) return fail("teen_private", "This space belongs to the teen alone.");
  const parsed = retentionSchema.safeParse(days);
  if (!parsed.success) return fail("validation_failed", "Pick 30, 90, or 365 days.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const value = parsed.data === "default" ? null : Number(parsed.data);
    const { error } = await supabase
      .from("health_preferences")
      .upsert(
        { child_id: childId, wellbeing_retention_days: value, updated_at: new Date().toISOString() },
        { onConflict: "child_id" },
      );
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that setting. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not save that setting. Try again.");
  }
  return ok({ done: true });
}

// ---------------------------------------------------------------------------
// W23 — Nutrition (+ W13 meal plans)
// ---------------------------------------------------------------------------

const mealCheckinSchema = z
  .object({
    meal: z.enum(["breakfast", "lunch", "dinner", "snack"]),
    foodGroups: z.array(z.string().max(40)).max(8).default([]),
    hungerBefore: z.number().int().min(1).max(5).optional(),
    fullnessAfter: z.number().int().min(1).max(5).optional(),
    energyNote: z.string().max(280).optional(),
  })
  .strict();

const foodDiarySchema = z
  .object({
    description: z.string().min(1).max(280),
    caloriesLow: z.number().int().min(0).max(20000),
    caloriesHigh: z.number().int().min(0).max(20000),
  })
  .strict()
  .refine((d) => d.caloriesHigh >= d.caloriesLow, { message: "Range is inverted." });

/** Numeric fields a minor must never be able to submit (schema backstop, 6.7). */
const MINOR_FORBIDDEN_KEYS = ["calories", "calories_low", "caloriesHigh", "protein", "macros", "weight", "bmi"];

function refuseMinorNumerics(raw: unknown, isMinor: boolean): HealthFailure | null {
  if (!isMinor || !raw || typeof raw !== "object") return null;
  const keys = Object.keys(raw).map((k) => k.toLowerCase());
  const hit = MINOR_FORBIDDEN_KEYS.some((k) => keys.includes(k.toLowerCase()));
  if (hit) {
    return fail(
      "minor_numeric_refusal",
      "Pookie does not track calories or weight for anyone under 18.",
    );
  }
  return null;
}

/**
 * W23 state. Contract: meal_checkins (027, section 6.2); food_logs (012 as
 * amended by 027, section 6.7); nutrition_weekly_patterns() (section 6.7 —
 * engagement-only for minors, server-enforced).
 */
export async function getNutritionState(childId: string): Promise<HealthResult<NutritionState>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();

  const isOwner = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
  if (isOwner) {
    try {
      if (ctx.isMinor) {
        const { data, error } = await supabase
          .from("meal_checkins")
          .select("id, logged_at, meal, food_groups, hunger_before, fullness_after, energy_note")
          .eq("subject_id", childId)
          .order("logged_at", { ascending: false })
          .limit(30);
        if (error) {
          if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
          return fail("read_failed", "Could not load your check-ins. Try again.");
        }
        const checkins: MealCheckin[] = (data ?? []).map((r) => ({
          id: r.id,
          loggedAt: r.logged_at,
          meal: r.meal as MealKind,
          foodGroups: r.food_groups ?? [],
          hungerBefore: r.hunger_before ?? null,
          fullnessAfter: r.fullness_after ?? null,
          energyNote: r.energy_note ?? null,
        }));
        return ok({ checkins, diary: [], engagement: null, view: "own" });
      }
      const { data, error } = await supabase
        .from("food_logs")
        .select("id, logged_at, description, calories_low, calories_high")
        .eq("subject_id", childId)
        .order("logged_at", { ascending: false })
        .limit(30);
      if (error) {
        if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
        return fail("read_failed", "Could not load your food diary. Try again.");
      }
      const diary: FoodDiaryEntry[] = (data ?? []).map((r) => ({
        id: r.id,
        loggedAt: r.logged_at,
        description: r.description,
        caloriesLow: r.calories_low,
        caloriesHigh: r.calories_high,
      }));
      return ok({ checkins: [], diary, engagement: null, view: "own" });
    } catch {
      return fail("read_failed", "Could not load nutrition. Check your connection and try again.");
    }
  }

  // Parent views.
  if (ctx.isMinor) {
    // Engagement only, via the amended RPC (section 6.7). The server refuses
    // calorie/macro/weight aggregates for minors.
    try {
      const { data, error } = await supabase.rpc("nutrition_weekly_patterns", {
        p_subject_id: childId,
      });
      if (error) {
        if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
        return fail("read_failed", "Could not load meal logging activity. Try again.");
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return ok({ checkins: [], diary: [], engagement: null, view: "engagement" });
      return ok({
        checkins: [],
        diary: [],
        engagement: {
          weekStart: String(row.week_start ?? ""),
          daysLogged: Number(row.days_logged ?? 0),
          mealsRecorded: Number(row.meals_recorded ?? row.entries ?? 0),
          mealsByType: {
            breakfast: Number(row.meals_by_type?.breakfast ?? 0),
            lunch: Number(row.meals_by_type?.lunch ?? 0),
            dinner: Number(row.meals_by_type?.dinner ?? 0),
            snack: Number(row.meals_by_type?.snack ?? 0),
          },
          detail: "engagement_only_minor",
        },
        view: "engagement",
      });
    } catch {
      return fail("read_failed", "Could not load meal logging activity. Try again.");
    }
  }

  // Parent of an 18+ adult: diary stays Private health; visible only with a grant.
  return ok({ checkins: [], diary: [], engagement: null, view: "locked" });
}

/**
 * Descriptive meal check-in for under-18s. Contract: meal_checkins has NO
 * calorie/macro/weight columns (027, section 6.2) — a minor cannot log what
 * the schema cannot hold. This action refuses numeric payloads first anyway.
 */
export async function logMealCheckin(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ checkinId: string }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  const isOwner = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
  if (!isOwner) return fail("authority_denied", "Only the teen can log meals.");
  const refused = refuseMinorNumerics(raw, ctx.isMinor);
  if (refused) return refused;
  const parsed = mealCheckinSchema.safeParse(raw);
  if (!parsed.success) {
    const unrecognized = parsed.error.issues.some((i) => i.code === "unrecognized_keys");
    if (unrecognized && ctx.isMinor) {
      return fail("minor_numeric_refusal", "Pookie does not track calories or weight for anyone under 18.");
    }
    return fail("validation_failed", "That check-in did not look right. Try again.");
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("meal_checkins")
      .insert({
        subject_id: childId,
        meal: parsed.data.meal,
        food_groups: parsed.data.foodGroups,
        hunger_before: parsed.data.hungerBefore ?? null,
        fullness_after: parsed.data.fullnessAfter ?? null,
        energy_note: parsed.data.energyNote?.trim() ? parsed.data.energyNote.trim() : null,
        logged_by: ctx.isSubject ? "subject" : "steward_parent",
        health_tier: "H2",
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error && isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that check-in. Try again.");
    }
    return ok({ checkinId: data.id });
  } catch {
    return fail("write_failed", "Could not save that check-in. Try again.");
  }
}

/**
 * Full food diary with mandatory uncertainty ranges. 18+ only (section 6.1).
 */
export async function logFoodDiary(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ entryId: string }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "Only you can write in your food diary.");
  if (ctx.isMinor) return fail("adult_only", "Full food logging unlocks at 18.");
  const parsed = foodDiarySchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That entry did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("food_logs")
      .insert({
        subject_id: childId,
        description: parsed.data.description.trim(),
        calories_low: parsed.data.caloriesLow,
        calories_high: parsed.data.caloriesHigh,
        health_tier: "H2",
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error && isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that entry. Try again.");
    }
    return ok({ entryId: data.id });
  } catch {
    return fail("write_failed", "Could not save that entry. Try again.");
  }
}

// ---------------------------------------------------------------------------
// W13 — Meals (meal plans, never food logs)
// ---------------------------------------------------------------------------

const mealPlanDaySchema = z.object({
  day: z.string().min(1).max(16),
  breakfastIdea: z.string().max(120).default(""),
  lunchIdea: z.string().max(120).default(""),
  dinnerIdea: z.string().max(120).default(""),
  notes: z.string().max(280).default(""),
});

const mealPlanSchema = z
  .object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "weekStart must be YYYY-MM-DD"),
    days: z.array(mealPlanDaySchema).length(7),
    groceryList: z.array(z.string().max(80)).max(40).default([]),
  })
  .strict();

/**
 * W13 meal planning. Contract: sol-health section 6.3 — W13 stores meal
 * plans, not food logs; no calorie fields at any age (the schema is strict).
 * Table meal_plans is provided by the Squad 2 backend (027 scope):
 * (id, subject_id, week_start, plan jsonb, grocery_list text[], health_tier).
 */
export async function getMealPlans(childId: string): Promise<HealthResult<{ plans: MealPlan[] }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("meal_plans")
      .select("id, week_start, plan, grocery_list")
      .eq("subject_id", childId)
      .order("week_start", { ascending: false })
      .limit(8);
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("read_failed", "Could not load meal plans. Try again.");
    }
    const plans: MealPlan[] = (data ?? []).map((r) => ({
      id: r.id,
      weekStart: r.week_start,
      days: Array.isArray(r.plan) ? (r.plan as MealPlan["days"]) : [],
      groceryList: r.grocery_list ?? [],
    }));
    return ok({ plans });
  } catch {
    return fail("read_failed", "Could not load meal plans. Check your connection and try again.");
  }
}

export async function saveMealPlan(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ planId: string }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  const refused = refuseMinorNumerics(raw, true); // plans never hold numerics, any age
  if (refused) return refused;
  const parsed = mealPlanSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That plan did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("meal_plans")
      .upsert(
        {
          subject_id: childId,
          week_start: parsed.data.weekStart,
          plan: parsed.data.days,
          grocery_list: parsed.data.groceryList,
          health_tier: "H1",
        },
        { onConflict: "subject_id,week_start" },
      )
      .select("id")
      .single();
    if (error || !data) {
      if (error && isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that plan. Try again.");
    }
    return ok({ planId: data.id });
  } catch {
    return fail("write_failed", "Could not save that plan. Try again.");
  }
}

// ---------------------------------------------------------------------------
// Sharing -> Health: per-tier, per-parent grants
// ---------------------------------------------------------------------------

/**
 * Current health sharing state per linked parent.
 * Contract: health_consent_grants (022, section 1.6) + health_grace (024,
 * section 3.1). Readable by the granter (the teen / adult subject, or the
 * steward parent under 13).
 */
export async function getHealthGrants(childId: string): Promise<HealthResult<HealthGrantState[]>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayManageGrants(ctx)) {
    return fail("authority_denied", "Health sharing is managed by the teen.");
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  const labels = await linkedLabels(childId);

  try {
    // Linked parents are the only valid grantees.
    const { data: access, error: accessError } = await supabase
      .from("child_access")
      .select("user_id, role")
      .eq("child_id", childId)
      .eq("role", "parent");
    if (accessError) return fail("grantee_unverifiable", "Could not verify linked parents. Try again.");
    const parents = (access ?? []).map((r) => ({
      userId: r.user_id as string,
      label: labels.get(r.user_id as string) ?? "A parent",
    }));
    if (parents.length === 0) return ok([]);

    const { data: grants, error: grantError } = await supabase
      .from("health_consent_grants")
      .select("grantee_user_id, tier, revoked_at, expires_at")
      .eq("child_id", childId)
      .is("revoked_at", null);
    if (grantError) {
      if (isRelationMissing(grantError)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("read_failed", "Could not load sharing settings. Try again.");
    }

    const { data: grace, error: graceError } = await supabase
      .from("health_grace")
      .select("viewer_user_id, tier, grace_expires_at")
      .eq("child_id", childId)
      .gt("grace_expires_at", new Date().toISOString());
    const graceByViewer = new Map<string, { until: string; tiers: HealthTier[] }>();
    if (!graceError && grace) {
      for (const g of grace) {
        const tier = g.tier as HealthTier;
        if (tier !== "H1" && tier !== "H2") continue;
        const cur = graceByViewer.get(g.viewer_user_id) ?? {
          until: g.grace_expires_at,
          tiers: [] as HealthTier[],
        };
        cur.tiers.push(tier);
        if (g.grace_expires_at > cur.until) cur.until = g.grace_expires_at;
        graceByViewer.set(g.viewer_user_id, cur);
      }
    }

    const activeByGrantee = new Map<string, Set<HealthTier>>();
    for (const g of grants ?? []) {
      const tier = g.tier as HealthTier;
      if (tier !== "H1" && tier !== "H2") continue;
      if (g.expires_at && new Date(g.expires_at) <= new Date()) continue;
      const set = activeByGrantee.get(g.grantee_user_id) ?? new Set<HealthTier>();
      set.add(tier);
      activeByGrantee.set(g.grantee_user_id, set);
    }

    return ok(
      parents.map((p) => {
        const active = activeByGrantee.get(p.userId) ?? new Set<HealthTier>();
        const gr = graceByViewer.get(p.userId);
        return {
          granteeUserId: p.userId,
          granteeLabel: p.label,
          h1: active.has("H1"),
          h2: active.has("H2"),
          graceUntil: gr?.until ?? null,
          gracedTiers: gr?.tiers ?? [],
        };
      }),
    );
  } catch {
    return fail("read_failed", "Could not load sharing settings. Check your connection and try again.");
  }
}

const setGrantSchema = z
  .object({
    granteeUserId: z.string().uuid(),
    tier: z.enum(["H1", "H2"]),
    enabled: z.boolean(),
  })
  .strict();

/**
 * Flip one per-tier, per-parent grant. Semantics: sol-health section 2.3 —
 * each toggle maps to exactly one health_consent_grants row; no row means no
 * access. H3 has no grant path: the predicate has no H3 grant arm, so this
 * refuses H3 structurally (section 1.6).
 *
 * Backend dependency: the write goes through rpc_set_health_grant
 * (p_child_id, p_grantee_user_id, p_tier, p_enabled), provided by the Squad 2
 * backend per the section 2.3 toggle semantics and the 023 RLS rule
 * ("grants writable by granter only via RPC").
 */
export async function setHealthGrant(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!mayManageGrants(ctx)) {
    return fail("authority_denied", "Health sharing is managed by the teen.");
  }
  // Structural H3 refusal, before validation: there is no H3 switch.
  const rawTier = (raw as { tier?: unknown } | null)?.tier;
  if (rawTier === "H3" || rawTier === "H0") {
    return fail(
      "h3_no_grant_path",
      "The most personal records stay only with the teen. There is no switch for this.",
    );
  }
  const parsed = setGrantSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That change did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    // The grantee must be a linked parent. Fail closed when unverifiable.
    const { data: access, error: accessError } = await supabase
      .from("child_access")
      .select("user_id, role")
      .eq("child_id", childId)
      .eq("user_id", parsed.data.granteeUserId)
      .limit(1);
    if (accessError || !access || access.length === 0 || access[0].role !== "parent") {
      return fail("grantee_unverifiable", "That person is not linked as a parent.");
    }

    const { error } = await supabase.rpc("rpc_set_health_grant", {
      p_child_id: childId,
      p_grantee_user_id: parsed.data.granteeUserId,
      p_tier: parsed.data.tier,
      p_enabled: parsed.data.enabled,
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that change. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not save that change. Try again.");
  }
  return ok({ done: true });
}

/**
 * "Hide my past health data too" — the teen's FERPA lever (section 3.2).
 * Contract: rpc_hide_past_health() (Appendix B). 13+.
 */
export async function hidePastHealth(childId: string): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject || ctx.band === "under13" || ctx.band === "unknown") {
    return fail("authority_denied", "This choice belongs to the teen.");
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_hide_past_health");
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not hide past records. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not hide past records. Try again.");
  }
  return ok({ done: true });
}

const deletionScopeSchema = z.union([
  z.object({ kind: z.literal("tier"), tier: z.enum(["H2", "H3"]) }).strict(),
  z.object({ kind: z.literal("category"), category: z.literal("wellbeing") }).strict(),
  z.object({ kind: z.literal("all") }).strict(),
]);

/**
 * Map the UI deletion scope to the scope string rpc_request_health_deletion
 * expects inside p_scope (024 reads p_scope ->> 'scope': 'tier:H2',
 * 'category:wellbeing', 'all_health').
 */
function toDeletionScopeString(
  scope: z.infer<typeof deletionScopeSchema>,
): string {
  if (scope.kind === "tier") return `tier:${scope.tier}`;
  if (scope.kind === "category") return "category:wellbeing";
  return "all_health";
}

/**
 * Deletion requests, honored within 30 days (section 3.3).
 * Contract: rpc_request_health_deletion(p_scope jsonb) (024) — p_scope is
 * {"scope": "<tier:H2|tier:H3|category:wellbeing|all_health>"}; the RPC
 * derives the child from the caller's own session (subject-only).
 */
export async function requestHealthDeletion(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  const allowed = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
  if (!allowed) return fail("authority_denied", "This choice belongs to the teen.");
  const parsed = deletionScopeSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That request did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_request_health_deletion", {
      p_scope: { scope: toDeletionScopeString(parsed.data) },
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not start that deletion. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not start that deletion. Try again.");
  }
  return ok({ done: true });
}

// ---------------------------------------------------------------------------
// Audit — "who can see my health info and what changed"
// ---------------------------------------------------------------------------

const AUDIT_SUMMARIES: Array<{ match: RegExp; summary: (tierName: (t: string) => string) => string }> = [
  { match: /health_cutover_18/, summary: () => "Health sharing reset on the 18th birthday. Everyone's access ended." },
  { match: /health_grant_created/, summary: () => "Health sharing was turned on." },
  { match: /health_grant_revoked/, summary: () => "Health sharing was turned off." },
  { match: /health_grace_created/, summary: () => "Temporary access to older records started." },
  { match: /hide_past_health/, summary: () => "Past health records were hidden right away." },
  { match: /transition_summary_export/, summary: () => "The health summary was exported." },
  { match: /health_deletion/, summary: () => "Health records were deleted." },
  { match: /trusted_adult_notified/, summary: () => "The trusted adult was notified." },
  { match: /wellbeing_event/, summary: () => "A private wellbeing signal was recorded. No content left this space." },
];

function auditSummary(event: string): string {
  for (const { match, summary } of AUDIT_SUMMARIES) {
    if (match.test(event)) return summary(() => "");
  }
  return "A health privacy event was recorded.";
}

/**
 * Teen-visible audit of health sharing changes.
 * Contract: access_events (021, Platform Team 1) — event column carries
 * health_* codes (sol-health sections 2.1, 3.1, 3.2, 3.3, 5.4).
 */
export async function getHealthAudit(childId: string): Promise<HealthResult<{ events: import("./types").HealthAuditEvent[] }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  const allowed = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
  if (!allowed) return fail("authority_denied", "This history belongs to the teen.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("access_events")
      .select("id, created_at, event")
      .eq("child_id", childId)
      .ilike("event", "%health%")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("read_failed", "Could not load sharing history. Try again.");
    }
    return ok({
      events: (data ?? []).map((r) => ({
        id: String(r.id),
        at: r.created_at,
        summary: auditSummary(String(r.event ?? "")),
        actorLabel: ctx.isSubject ? "You" : "Parent",
      })),
    });
  } catch {
    return fail("read_failed", "Could not load sharing history. Check your connection and try again.");
  }
}

// ---------------------------------------------------------------------------
// 18th-birthday review (section 2.2)
// ---------------------------------------------------------------------------

/**
 * Re-consent state. Contract: children.health_reconsent_status (023,
 * section 2.7): not_due | pending | complete | skipped_private.
 */
export async function getReconsentState(
  childId: string,
): Promise<HealthResult<{ status: ReconsentStatus; due: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "This review belongs to the adult.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("children")
      .select("health_reconsent_status")
      .eq("id", childId)
      .single();
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return ok({ status: "not_due", due: false });
    }
    const status = (data?.health_reconsent_status ?? "not_due") as ReconsentStatus;
    return ok({ status, due: ctx.band === "adult" && status === "pending" });
  } catch {
    return fail("read_failed", "Could not load your review. Try again.");
  }
}

const reconsentGrantsSchema = z
  .object({
    grants: z
      .array(
        z
          .object({
            granteeUserId: z.string().uuid(),
            tier: z.enum(["H1", "H2"]),
          })
          .strict(),
      )
      .max(10),
  })
  .strict();

/**
 * Submit per-tier re-consent. Contract: rpc_health_reconsent_submit(grants
 * jsonb) (023, section 2.7, Appendix B). All defaults OFF — only the tiers
 * the adult explicitly enables become rows.
 */
export async function submitReconsent(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject || ctx.band !== "adult") {
    return fail("authority_denied", "This review belongs to the adult.");
  }
  const rawTiers = ((raw as { grants?: Array<{ tier?: unknown }> } | null)?.grants ?? []).map(
    (g) => g?.tier,
  );
  if (rawTiers.includes("H3") || rawTiers.includes("H0")) {
    return fail("h3_no_grant_path", "The most personal records stay only with you. There is no switch for this.");
  }
  const parsed = reconsentGrantsSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Those choices did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);

  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_health_reconsent_submit", {
      p_grants: parsed.data.grants.map((g) => ({
        grantee_user_id: g.granteeUserId,
        tier: g.tier,
      })),
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save your choices. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not save your choices. Try again.");
  }
  return ok({ done: true });
}

/** Skip = private, recorded as an affirmative choice (section 2.2). */
export async function skipReconsent(childId: string): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject || ctx.band !== "adult") {
    return fail("authority_denied", "This review belongs to the adult.");
  }
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_health_reconsent_skip");
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save your choice. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not save your choice. Try again.");
  }
  return ok({ done: true });
}

/**
 * Parent-entered rows awaiting review-correct-seal (section 2.4).
 * Contract: rpc_health_review_queue() (Appendix B).
 */
export async function getReviewQueue(childId: string): Promise<HealthResult<{ rows: ReviewQueueRow[] }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "This review belongs to the adult.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("rpc_health_review_queue");
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("read_failed", "Could not load your review queue. Try again.");
    }
    const labels = await linkedLabels(childId);
    const rows: ReviewQueueRow[] = ((Array.isArray(data) ? data : []) as Record<string, unknown>[]).map(
      (r) => ({
        recordId: String(r.record_id ?? r.id ?? ""),
        table: String(r.table ?? ""),
        category: String(r.category ?? "Health record"),
        summary: String(r.summary ?? "A health record"),
        enteredByLabel:
          typeof r.entered_by === "string" ? (labels.get(r.entered_by) ?? "Someone") : "Someone",
        enteredAt: typeof r.entered_at === "string" ? r.entered_at : "",
      }),
    );
    return ok({ rows });
  } catch {
    return fail("read_failed", "Could not load your review queue. Check your connection and try again.");
  }
}

const recordCorrectSchema = z
  .object({
    recordId: z.string().min(1).max(100),
    table: z.string().min(1).max(60),
    patch: z.record(z.string(), z.unknown()),
  })
  .strict();

/**
 * Correct a parent-entered row (writes health_corrections, then seals).
 * Contract: rpc_health_record_correct (Appendix B).
 */
export async function correctHealthRecord(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "This review belongs to the adult.");
  const parsed = recordCorrectSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That correction did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_health_record_correct", {
      p_record_id: parsed.data.recordId,
      p_table: parsed.data.table,
      p_patch: parsed.data.patch,
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not save that correction. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not save that correction. Try again.");
  }
  return ok({ done: true });
}

/** Tombstone a parent-entered row (section 3.3). */
export async function deleteHealthRecord(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "This review belongs to the adult.");
  const parsed = z
    .object({ recordId: z.string().min(1).max(100), table: z.string().min(1).max(60) })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "That request did not look right. Try again.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { error } = await supabase.rpc("rpc_health_record_delete", {
      p_child_id: childId,
      p_record_id: parsed.data.recordId,
      p_table: parsed.data.table,
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not delete that record. Try again.");
    }
  } catch {
    return fail("write_failed", "Could not delete that record. Try again.");
  }
  return ok({ done: true });
}

const exportSchema = z.object({ format: z.enum(["pdf", "json"]) }).strict();

/**
 * "Take to your new doctor" export (section 2.5).
 * Contract: rpc_export_transition_summary(format) (Appendix B) — audit-logged,
 * subject-only, PDF streamed and discarded server-side.
 * Expected payload: { content_base64, mime_type, filename }.
 */
export async function exportTransitionSummary(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ contentBase64: string; mimeType: string; filename: string }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "Only you can export your health summary.");
  const parsed = exportSchema.safeParse(raw);
  if (!parsed.success) return fail("validation_failed", "Pick PDF or JSON.");
  if (!ctx.schemaReady) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.rpc("rpc_export_transition_summary", {
      p_format: parsed.data.format,
    });
    if (error) {
      if (isRelationMissing(error)) return fail("backend_not_ready", BACKEND_NOT_READY_MSG);
      return fail("write_failed", "Could not build your summary. Try again.");
    }
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    if (!row || typeof row.content_base64 !== "string") {
      return fail("write_failed", "The export came back empty. Try again.");
    }
    return ok({
      contentBase64: row.content_base64,
      mimeType: typeof row.mime_type === "string" ? row.mime_type : "application/octet-stream",
      filename: typeof row.filename === "string" ? row.filename : `health-summary.${parsed.data.format}`,
    });
  } catch {
    return fail("write_failed", "Could not build your summary. Try again.");
  }
}

const emergencyContactSchema = z.object({
  name: z.string().min(1).max(80),
  relationship: z.string().min(1).max(40),
  phone: z.string().min(7).max(20),
});

/**
 * Emergency-contact re-designation (section 2.6). Emergency contacts are
 * contact info, NOT access grants — the two tables stay decoupled.
 *
 * Backend dependency: Squad 1 owns the emergency_contacts table (their
 * migrations 022-029 scope). Until their write contract lands, this action
 * validates fully and reports the dependency honestly instead of writing to
 * a guessed schema.
 */
export async function saveEmergencyContacts(
  childId: string,
  raw: unknown,
): Promise<HealthResult<{ done: boolean }>> {
  let ctx: HealthContext;
  try {
    ctx = await requireContext(childId);
  } catch (e) {
    return e as HealthFailure;
  }
  if (!ctx.isSubject) return fail("authority_denied", "This choice belongs to the adult.");
  const parsed = z.array(emergencyContactSchema).min(1).max(5).safeParse(raw);
  if (!parsed.success) {
    return fail("validation_failed", "Add at least one contact with a name and phone number.");
  }
  return fail(
    "dependency_not_ready",
    "Emergency contacts save with the Emergency module (Squad 1). Your sharing choices above are unaffected.",
  );
}
