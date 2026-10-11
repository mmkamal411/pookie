// W5 college prep — framework-free business logic (per MODULE-ARCHITECTURE.md §1).
// Handlers are thin: validate → resolve tenant → call service → audit.
// Every query runs through the user-JWT server client; RLS (current_child_ids())
// enforces tenancy. Reference tables (colleges, college_stats,
// requirement_templates, college_aid_programs) are public Class-P data — no
// client writes, ever. Mirrors supabase/migrations/009_w5_college_prep.sql.
//
// Mutation services take the caller's requestId for error correlation
// (mapDbError); the read-only aggregates generate their own.
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requestEssayFeedback } from "@/server/essay-feedback";
import type {
  College,
  CollegeListEntry,
  CollegeStat,
  Deadline,
  DeadlineKind,
  DerivedRequirement,
  Essay,
  EssayFeedback,
  GpaSimulation,
  ListStatus,
  Readiness,
  Recommender,
  RecommenderRelationship,
  ReleaseDocument,
  ReleaseStatus,
  RequirementTemplate,
  TemplateKind,
  TestScore,
  TestType,
  TranscriptRelease,
} from "@/lib/college/types";

type Db = Awaited<ReturnType<typeof createClient>>;

// ---------------------------------------------------------------------------
// Zod input schemas
// ---------------------------------------------------------------------------

export const explorerQuerySchema = z.object({
  region: z.enum(["ga_instate", "southeast", "national_premed"]).optional(),
  control: z.enum(["public", "private"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});
export type ExplorerQuery = z.infer<typeof explorerQuerySchema>;

const listStatusEnum = z.enum([
  "interested",
  "applying",
  "applied",
  "accepted",
  "denied",
  "waitlisted",
  "enrolled",
  "removed",
]);

export const listCreateSchema = z.object({
  college_id: z.string().uuid(),
  status: listStatusEnum.default("interested"),
  notes: z.string().max(2000).nullable().optional(),
});
export type ListCreate = z.infer<typeof listCreateSchema>;

export const listPatchSchema = z.object({
  status: listStatusEnum.optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type ListPatch = z.infer<typeof listPatchSchema>;

const deadlineKindEnum = z.enum([
  "early_action",
  "early_decision",
  "early_decision_2",
  "regular",
  "rolling",
  "scholarship",
  "fafsa",
  "css_profile",
  "other",
]);

export const deadlineCreateSchema = z.object({
  college_id: z.string().uuid().nullable().optional(),
  kind: deadlineKindEnum,
  label: z.string().trim().min(1).max(200),
  due_at: z.string().datetime(),
  notes: z.string().max(2000).nullable().optional(),
  done: z.boolean().default(false),
});
export type DeadlineCreate = z.infer<typeof deadlineCreateSchema>;

export const deadlinePatchSchema = z.object({
  college_id: z.string().uuid().nullable().optional(),
  kind: deadlineKindEnum.optional(),
  label: z.string().trim().min(1).max(200).optional(),
  due_at: z.string().datetime().optional(),
  notes: z.string().max(2000).nullable().optional(),
  done: z.boolean().optional(),
});
export type DeadlinePatch = z.infer<typeof deadlinePatchSchema>;

const essayStatusEnum = z.enum(["draft", "in_review", "final"]);

export const essayCreateSchema = z.object({
  college_id: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(4000),
  draft: z.string().max(50000).optional(),
  status: essayStatusEnum.default("draft"),
  word_limit: z.number().int().min(1).max(10000).optional(),
});
export type EssayCreate = z.infer<typeof essayCreateSchema>;

export const essayPatchSchema = z.object({
  college_id: z.string().uuid().nullable().optional(),
  prompt: z.string().trim().min(1).max(4000).optional(),
  draft: z.string().max(50000).nullable().optional(),
  status: essayStatusEnum.optional(),
  word_limit: z.number().int().min(1).max(10000).nullable().optional(),
});
export type EssayPatch = z.infer<typeof essayPatchSchema>;

const recommenderRelationshipEnum = z.enum([
  "teacher",
  "counselor",
  "coach",
  "employer",
  "other",
]);
const recommenderStatusEnum = z.enum(["asked", "agreed", "submitted", "declined"]);

export const recommenderCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  relationship: recommenderRelationshipEnum,
  email: z.string().email().max(320).nullable().optional(),
  status: recommenderStatusEnum.default("asked"),
  requested_at: z.string().datetime().nullable().optional(),
  submitted_at: z.string().datetime().nullable().optional(),
});
export type RecommenderCreate = z.infer<typeof recommenderCreateSchema>;

export const recommenderPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  relationship: recommenderRelationshipEnum.optional(),
  email: z.string().email().max(320).nullable().optional(),
  status: recommenderStatusEnum.optional(),
  requested_at: z.string().datetime().nullable().optional(),
  submitted_at: z.string().datetime().nullable().optional(),
});
export type RecommenderPatch = z.infer<typeof recommenderPatchSchema>;

const testTypeEnum = z.enum(["SAT", "ACT", "PSAT", "AP", "other"]);

export const testScoreCreateSchema = z.object({
  test: testTypeEnum,
  test_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "test_date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  section_scores: z.record(z.string(), z.number().min(0).max(1600)).default({}),
  total: z.number().min(0).max(1600).nullable().optional(),
});
export type TestScoreCreate = z.infer<typeof testScoreCreateSchema>;

export const testScorePatchSchema = z.object({
  test: testTypeEnum.optional(),
  test_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "test_date must be YYYY-MM-DD")
    .nullable()
    .optional(),
  section_scores: z.record(z.string(), z.number().min(0).max(1600)).optional(),
  total: z.number().min(0).max(1600).nullable().optional(),
});
export type TestScorePatch = z.infer<typeof testScorePatchSchema>;

export const testScoreVerifySchema = z.object({
  reported_total: z.number().min(0).max(1600),
});
export type TestScoreVerify = z.infer<typeof testScoreVerifySchema>;

const releaseDocumentEnum = z.enum([
  "official_transcript",
  "midyear_report",
  "final_transcript",
  "other",
]);

export const releaseCreateSchema = z.object({
  college_id: z.string().uuid().nullable().optional(),
  document_kind: releaseDocumentEnum.default("official_transcript"),
});
export type ReleaseCreate = z.infer<typeof releaseCreateSchema>;

export const releaseAuthorizeSchema = z.object({
  authorized_text: z.string().trim().min(1).max(5000),
});
export type ReleaseAuthorize = z.infer<typeof releaseAuthorizeSchema>;

export const gpaSimulateSchema = z.object({
  term: z.string().max(40).nullable().optional(),
  adjustments: z
    .array(
      z.object({
        class_id: z.string().uuid(),
        numeric: z.number().min(0).max(100),
      }),
    )
    .default([]),
});
export type GpaSimulate = z.infer<typeof gpaSimulateSchema>;

export interface GpaAdjustment {
  class_id: string;
  numeric: number;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Drop undefined keys so PostgREST never sees an explicit undefined field. */
function defined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** Fail closed when a referenced college does not exist (FK would 500 otherwise). */
async function assertCollegeExists(
  supabase: Db,
  requestId: string,
  collegeId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("colleges")
    .select("id")
    .eq("id", collegeId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
}

function toCollege(row: Record<string, unknown>): College {
  return {
    id: row.id as string,
    name: row.name as string,
    city: row.city as string,
    state: row.state as string,
    region: row.region as College["region"],
    control: row.control as College["control"],
    website: (row.website as string | null) ?? null,
  };
}

function toCollegeStat(row: Record<string, unknown>): CollegeStat {
  return {
    id: row.id as string,
    college_id: row.college_id as string,
    stat_key: row.stat_key as string,
    stat_value: Number(row.stat_value),
    as_of: row.as_of as string,
    source: row.source as string,
  };
}

/** The joined `colleges:college_id(...)` embed from collection GETs, if present. */
function joinedCollege(row: Record<string, unknown>): College | undefined {
  const c = row.colleges as Record<string, unknown> | null | undefined;
  return c ? toCollege(c) : undefined;
}

function toListEntry(row: Record<string, unknown>): CollegeListEntry {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    college_id: row.college_id as string,
    college: joinedCollege(row),
    status: row.status as ListStatus,
    notes: (row.notes as string | null) ?? null,
  };
}

function toDeadline(row: Record<string, unknown>): Deadline {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    college_id: (row.college_id as string | null) ?? null,
    college: joinedCollege(row),
    kind: row.kind as DeadlineKind,
    label: row.label as string,
    due_at: row.due_at as string,
    notes: (row.notes as string | null) ?? null,
    done: row.done as boolean,
  };
}

function toEssay(row: Record<string, unknown>): Essay {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    college_id: (row.college_id as string | null) ?? null,
    college: joinedCollege(row),
    prompt: row.prompt as string,
    draft: (row.draft as string | null) ?? null,
    status: row.status as Essay["status"],
    word_limit: row.word_limit == null ? null : Number(row.word_limit),
  };
}

function toRecommender(row: Record<string, unknown>): Recommender {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    name: row.name as string,
    relationship: row.relationship as RecommenderRelationship,
    email: (row.email as string | null) ?? null,
    status: row.status as Recommender["status"],
    requested_at: (row.requested_at as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
  };
}

function toTestScore(row: Record<string, unknown>): TestScore {
  const sections = (row.section_scores as Record<string, unknown> | null) ?? {};
  const numeric: Record<string, number> = {};
  for (const [k, v] of Object.entries(sections)) numeric[k] = Number(v);
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    test: row.test as TestType,
    test_date: (row.test_date as string | null) ?? null,
    section_scores: numeric,
    total: row.total == null ? null : Number(row.total),
    report_path: (row.report_path as string | null) ?? null,
    verified: row.verified as boolean,
  };
}

function toRelease(row: Record<string, unknown>): TranscriptRelease {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    college_id: (row.college_id as string | null) ?? null,
    college: joinedCollege(row),
    document_kind: row.document_kind as ReleaseDocument,
    status: row.status as ReleaseStatus,
    authorized_text: (row.authorized_text as string | null) ?? null,
    authorized_by: (row.authorized_by as string | null) ?? null,
    authorized_at: (row.authorized_at as string | null) ?? null,
    sent_at: (row.sent_at as string | null) ?? null,
  };
}

function toTemplate(row: Record<string, unknown>): RequirementTemplate {
  return {
    id: row.id as string,
    template_key: (row.template_key as string | null) ?? null,
    college_id: (row.college_id as string | null) ?? null,
    kind: row.kind as TemplateKind,
    label: row.label as string,
    description: (row.description as string | null) ?? null,
    required: row.required as boolean,
    sort_order: Number(row.sort_order),
  };
}

// ---------------------------------------------------------------------------
// College explorer (public registry)
// ---------------------------------------------------------------------------

export interface ExplorerCollege extends College {
  /** Dated, cited stats — empty until the P2 Scorecard ETL seeds them. */
  stats: CollegeStat[];
}

/** Sanitize free text for PostgREST ilike: strip wildcard/separator chars. */
function sanitizeIlike(raw: string): string {
  return raw.replace(/[%_(),]/g, "").trim();
}

/**
 * The public college directory. Class-P reference data — anon/authenticated
 * read at the RLS layer; stats arrive with as_of + source (never undated).
 */
export async function listColleges(
  supabase: Db,
  query: ExplorerQuery,
): Promise<ExplorerCollege[]> {
  const correlationId = crypto.randomUUID();
  let q = supabase
    .from("colleges")
    .select("id,name,city,state,region,control,website")
    .order("name");
  if (query.region) q = q.eq("region", query.region);
  if (query.control) q = q.eq("control", query.control);
  const search = query.search ? sanitizeIlike(query.search) : "";
  if (search) {
    const pat = `%${search}%`;
    q = q.or(`name.ilike.${pat},city.ilike.${pat},state.ilike.${pat}`);
  }
  const { data, error } = await q;
  if (error) throw new ApiError(mapDbError(error, correlationId));
  const colleges = ((data ?? []) as Record<string, unknown>[]).map(toCollege);
  if (colleges.length === 0) return [];

  const { data: statRows, error: statErr } = await supabase
    .from("college_stats")
    .select("id,college_id,stat_key,stat_value,as_of,source")
    .in(
      "college_id",
      colleges.map((c) => c.id),
    )
    .order("as_of", { ascending: false });
  if (statErr) throw new ApiError(mapDbError(statErr, correlationId));
  const byCollege = new Map<string, CollegeStat[]>();
  for (const row of ((statRows ?? []) as Record<string, unknown>[]).map(toCollegeStat)) {
    const arr = byCollege.get(row.college_id) ?? [];
    arr.push(row);
    byCollege.set(row.college_id, arr);
  }
  return colleges.map((c) => ({ ...c, stats: byCollege.get(c.id) ?? [] }));
}

// ---------------------------------------------------------------------------
// College list CRUD
// ---------------------------------------------------------------------------

/** Add a college to the child's working list. Duplicate → 409 CONFLICT. */
export async function addToList(
  supabase: Db,
  requestId: string,
  childId: string,
  input: ListCreate,
): Promise<CollegeListEntry> {
  await assertCollegeExists(supabase, requestId, input.college_id);
  const { data, error } = await supabase
    .from("college_list")
    .insert(
      defined({
        child_id: childId,
        college_id: input.college_id,
        status: input.status,
        notes: input.notes ?? null,
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toListEntry(data as Record<string, unknown>);
}

/** Patch one list entry (status / notes only — college_id is stable identity). */
export async function patchListEntry(
  supabase: Db,
  requestId: string,
  childId: string,
  entryId: string,
  input: ListPatch,
): Promise<CollegeListEntry> {
  const patch = defined({ status: input.status, notes: input.notes });
  const { data, error } =
    Object.keys(patch).length > 0
      ? await supabase
          .from("college_list")
          .update(patch)
          .eq("id", entryId)
          .eq("child_id", childId)
          .select()
          .maybeSingle()
      : await supabase
          .from("college_list")
          .select()
          .eq("id", entryId)
          .eq("child_id", childId)
          .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toListEntry(data as Record<string, unknown>);
}

/** Remove one list entry. 404 when the entry is not in this tenant. */
export async function removeListEntry(
  supabase: Db,
  requestId: string,
  childId: string,
  entryId: string,
): Promise<{ id: string; deleted: true }> {
  const { data, error } = await supabase
    .from("college_list")
    .delete()
    .eq("id", entryId)
    .eq("child_id", childId)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { id: entryId, deleted: true };
}

// ---------------------------------------------------------------------------
// Deadline CRUD
// ---------------------------------------------------------------------------

export async function addDeadline(
  supabase: Db,
  requestId: string,
  childId: string,
  input: DeadlineCreate,
): Promise<Deadline> {
  if (input.college_id) await assertCollegeExists(supabase, requestId, input.college_id);
  const { data, error } = await supabase
    .from("deadlines")
    .insert(
      defined({
        child_id: childId,
        college_id: input.college_id ?? null,
        kind: input.kind,
        label: input.label,
        due_at: input.due_at,
        notes: input.notes ?? null,
        done: input.done,
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toDeadline(data as Record<string, unknown>);
}

export async function patchDeadline(
  supabase: Db,
  requestId: string,
  childId: string,
  deadlineId: string,
  input: DeadlinePatch,
): Promise<Deadline> {
  if (input.college_id) await assertCollegeExists(supabase, requestId, input.college_id);
  const patch = defined({
    college_id: input.college_id,
    kind: input.kind,
    label: input.label,
    due_at: input.due_at,
    notes: input.notes,
    done: input.done,
  });
  const { data, error } =
    Object.keys(patch).length > 0
      ? await supabase
          .from("deadlines")
          .update(patch)
          .eq("id", deadlineId)
          .eq("child_id", childId)
          .select()
          .maybeSingle()
      : await supabase
          .from("deadlines")
          .select()
          .eq("id", deadlineId)
          .eq("child_id", childId)
          .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toDeadline(data as Record<string, unknown>);
}

export async function deleteDeadline(
  supabase: Db,
  requestId: string,
  childId: string,
  deadlineId: string,
): Promise<{ id: string; deleted: true }> {
  const { data, error } = await supabase
    .from("deadlines")
    .delete()
    .eq("id", deadlineId)
    .eq("child_id", childId)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { id: deadlineId, deleted: true };
}

// ---------------------------------------------------------------------------
// Essay CRUD + AI feedback hook
// ---------------------------------------------------------------------------

export async function addEssay(
  supabase: Db,
  requestId: string,
  childId: string,
  input: EssayCreate,
): Promise<Essay> {
  if (input.college_id) await assertCollegeExists(supabase, requestId, input.college_id);
  const { data, error } = await supabase
    .from("essays")
    .insert(
      defined({
        child_id: childId,
        college_id: input.college_id ?? null,
        prompt: input.prompt,
        draft: input.draft ?? null,
        status: input.status,
        word_limit: input.word_limit ?? null,
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toEssay(data as Record<string, unknown>);
}

export async function patchEssay(
  supabase: Db,
  requestId: string,
  childId: string,
  essayId: string,
  input: EssayPatch,
): Promise<Essay> {
  if (input.college_id) await assertCollegeExists(supabase, requestId, input.college_id);
  const patch = defined({
    college_id: input.college_id,
    prompt: input.prompt,
    draft: input.draft,
    status: input.status,
    word_limit: input.word_limit,
  });
  const { data, error } =
    Object.keys(patch).length > 0
      ? await supabase
          .from("essays")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", essayId)
          .eq("child_id", childId)
          .select()
          .maybeSingle()
      : await supabase
          .from("essays")
          .select()
          .eq("id", essayId)
          .eq("child_id", childId)
          .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toEssay(data as Record<string, unknown>);
}

export async function deleteEssay(
  supabase: Db,
  requestId: string,
  childId: string,
  essayId: string,
): Promise<{ id: string; deleted: true }> {
  const { data, error } = await supabase
    .from("essays")
    .delete()
    .eq("id", essayId)
    .eq("child_id", childId)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { id: essayId, deleted: true };
}

/**
 * AI feedback hook — tenant-partitioned STUB. No provider is called and
 * nothing is persisted (009 has no feedback column by design). The real call
 * site is src/server/essay-feedback.ts; wire a provider there when approved.
 */
export async function feedbackForEssay(
  supabase: Db,
  requestId: string,
  childId: string,
  essayId: string,
): Promise<EssayFeedback> {
  const { data, error } = await supabase
    .from("essays")
    .select("prompt,draft,word_limit")
    .eq("id", essayId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  const row = data as { prompt: string; draft: string | null; word_limit: number | null };
  return requestEssayFeedback({
    prompt: row.prompt,
    draft: row.draft ?? "",
    word_limit: row.word_limit,
  });
}

// ---------------------------------------------------------------------------
// GPA simulator — "what does my GPA look like if…"
// ---------------------------------------------------------------------------

/** Monday (YYYY-MM-DD, UTC) of the week containing an ISO timestamp. */
function weekStartOf(iso: string): string {
  const d = new Date(iso);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Pure read + math via the simulate_gpa() RPC — nothing is written.
 * GET callers pass term=null (latest term resolved) and no adjustments for
 * the current snapshot; POST callers pass hypothetical per-class overrides.
 */
export async function getGpaSimulation(
  supabase: Db,
  childId: string,
  term: string | null,
  adjustments: GpaAdjustment[],
): Promise<GpaSimulation> {
  const correlationId = crypto.randomUUID();

  let resolvedTerm = term;
  if (!resolvedTerm) {
    const { data, error } = await supabase
      .from("grades")
      .select("term")
      .eq("child_id", childId)
      .not("numeric", "is", null)
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new ApiError(mapDbError(error, correlationId));
    resolvedTerm = ((data as { term: string } | null)?.term ?? null);
  }

  async function runGpa(adj: GpaAdjustment[]): Promise<number | null> {
    const { data, error } = await supabase.rpc("simulate_gpa", {
      p_child_id: childId,
      p_term: resolvedTerm,
      p_adjustments: adj,
    });
    if (error) throw new ApiError(mapDbError(error, correlationId));
    const gpa = data as number | null;
    return gpa == null ? null : Number(gpa);
  }

  const current = await runGpa([]);
  const simulated = adjustments.length > 0 ? await runGpa(adjustments) : current;
  const delta =
    current != null && simulated != null ? round2(simulated - current) : null;

  // Trend from real grade history: weekly mean buckets, oldest → newest.
  const { data: trendRows, error: trendErr } = await supabase
    .from("grades")
    .select("numeric,synced_at")
    .eq("child_id", childId)
    .not("numeric", "is", null)
    .order("synced_at", { ascending: true });
  if (trendErr) throw new ApiError(mapDbError(trendErr, correlationId));
  const buckets = new Map<string, number[]>();
  for (const r of (trendRows ?? []) as { numeric: number | string; synced_at: string }[]) {
    const week = weekStartOf(r.synced_at);
    const arr = buckets.get(week) ?? [];
    arr.push(Number(r.numeric));
    buckets.set(week, arr);
  }
  const trend_points = [...buckets.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([week, vals]) => ({
      week,
      avg: round2(vals.reduce((s, v) => s + v, 0) / vals.length),
    }));

  let trend: GpaSimulation["trend"] = null;
  if (trend_points.length >= 2) {
    const tDelta = round2(
      trend_points[trend_points.length - 1].avg - trend_points[0].avg,
    );
    trend = {
      direction: tDelta >= 0.1 ? "rising" : tDelta <= -0.1 ? "falling" : "steady",
      delta: tDelta,
    };
  }

  return {
    term: resolvedTerm,
    current_gpa: current,
    simulated_gpa: simulated,
    delta,
    trend,
    trend_points,
  };
}

// ---------------------------------------------------------------------------
// Recommender CRUD
// ---------------------------------------------------------------------------

export async function addRecommender(
  supabase: Db,
  requestId: string,
  childId: string,
  input: RecommenderCreate,
): Promise<Recommender> {
  const { data, error } = await supabase
    .from("recommenders")
    .insert(
      defined({
        child_id: childId,
        name: input.name,
        relationship: input.relationship,
        email: input.email ?? null,
        status: input.status,
        requested_at: input.requested_at ?? null,
        submitted_at: input.submitted_at ?? null,
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toRecommender(data as Record<string, unknown>);
}

export async function patchRecommender(
  supabase: Db,
  requestId: string,
  childId: string,
  recId: string,
  input: RecommenderPatch,
): Promise<Recommender> {
  const patch = defined({
    name: input.name,
    relationship: input.relationship,
    email: input.email,
    status: input.status,
    requested_at: input.requested_at,
    submitted_at: input.submitted_at,
  });
  const { data, error } =
    Object.keys(patch).length > 0
      ? await supabase
          .from("recommenders")
          .update(patch)
          .eq("id", recId)
          .eq("child_id", childId)
          .select()
          .maybeSingle()
      : await supabase
          .from("recommenders")
          .select()
          .eq("id", recId)
          .eq("child_id", childId)
          .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toRecommender(data as Record<string, unknown>);
}

export async function deleteRecommender(
  supabase: Db,
  requestId: string,
  childId: string,
  recId: string,
): Promise<{ id: string; deleted: true }> {
  const { data, error } = await supabase
    .from("recommenders")
    .delete()
    .eq("id", recId)
    .eq("child_id", childId)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { id: recId, deleted: true };
}

// ---------------------------------------------------------------------------
// Test-score CRUD + human verification
// ---------------------------------------------------------------------------

export async function addTestScore(
  supabase: Db,
  requestId: string,
  childId: string,
  input: TestScoreCreate,
): Promise<TestScore> {
  const { data, error } = await supabase
    .from("test_scores")
    .insert(
      defined({
        child_id: childId,
        test: input.test,
        test_date: input.test_date ?? null,
        section_scores: input.section_scores,
        total: input.total ?? null,
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toTestScore(data as Record<string, unknown>);
}

/**
 * Editing a score's values un-verifies it — the human "report says Y" check
 * must be redone against the new numbers.
 */
export async function patchTestScore(
  supabase: Db,
  requestId: string,
  childId: string,
  scoreId: string,
  input: TestScorePatch,
): Promise<TestScore> {
  const valueFieldsChanged =
    input.test !== undefined ||
    input.test_date !== undefined ||
    input.section_scores !== undefined ||
    input.total !== undefined;
  const patch = defined({
    test: input.test,
    test_date: input.test_date,
    section_scores: input.section_scores,
    total: input.total,
    ...(valueFieldsChanged ? { verified: false } : {}),
  });
  const { data, error } =
    Object.keys(patch).length > 0
      ? await supabase
          .from("test_scores")
          .update(patch)
          .eq("id", scoreId)
          .eq("child_id", childId)
          .select()
          .maybeSingle()
      : await supabase
          .from("test_scores")
          .select()
          .eq("id", scoreId)
          .eq("child_id", childId)
          .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return toTestScore(data as Record<string, unknown>);
}

export async function deleteTestScore(
  supabase: Db,
  requestId: string,
  childId: string,
  scoreId: string,
): Promise<{ id: string; deleted: true }> {
  const { data, error } = await supabase
    .from("test_scores")
    .delete()
    .eq("id", scoreId)
    .eq("child_id", childId)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return { id: scoreId, deleted: true };
}

/**
 * Parent-only human verification: the parent submits what the uploaded score
 * report says; the entered total must match exactly ("you entered X / report
 * says Y"). Match → verified. Mismatch → 409 CONFLICT (nothing stored).
 */
export async function verifyTestScore(
  supabase: Db,
  requestId: string,
  childId: string,
  scoreId: string,
  input: TestScoreVerify,
): Promise<TestScore> {
  const { data, error } = await supabase
    .from("test_scores")
    .select()
    .eq("id", scoreId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  const row = toTestScore(data as Record<string, unknown>);
  const entered = row.total == null ? null : round2(row.total);
  if (entered == null || entered !== round2(input.reported_total)) {
    failWith(ErrorCodes.CONFLICT);
  }
  const { data: updated, error: upErr } = await supabase
    .from("test_scores")
    .update({ verified: true })
    .eq("id", scoreId)
    .eq("child_id", childId)
    .select()
    .maybeSingle();
  if (upErr) throw new ApiError(mapDbError(upErr, requestId));
  if (!updated) failWith(ErrorCodes.NOT_FOUND);
  return toTestScore(updated as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Transcript releases — disclosure accounting.
// The school sends transcripts; we orchestrate. Every release is
// per-college/per-document, explicitly authorized, and audit-logged.
// ---------------------------------------------------------------------------

export type ReleaseAuthority = "parent" | "student";

/** Draft a release. Status starts 'draft' — authorization is a separate step. */
export async function createRelease(
  supabase: Db,
  requestId: string,
  childId: string,
  input: ReleaseCreate,
): Promise<TranscriptRelease> {
  if (input.college_id) await assertCollegeExists(supabase, requestId, input.college_id);
  const { data, error } = await supabase
    .from("transcript_releases")
    .insert(
      defined({
        child_id: childId,
        college_id: input.college_id ?? null,
        document_kind: input.document_kind,
        status: "draft",
      }),
    )
    .select()
    .single();
  if (error) throw new ApiError(mapDbError(error, requestId));
  return toRelease(data as Record<string, unknown>);
}

/**
 * EXPLICIT authorization: the signer approves the exact authorized_text,
 * which is frozen on the row (release_authorization_integrity CHECK).
 * Authority: parent for minors; the student themself at 18+
 * (release_authority_for, lazy DOB check — unknown DOB fails closed to
 * parent). A parent may not sign once authority has flipped to the student.
 */
export async function authorizeRelease(
  supabase: Db,
  requestId: string,
  childId: string,
  userId: string,
  role: "parent" | "child",
  releaseId: string,
  input: ReleaseAuthorize,
): Promise<{ release: TranscriptRelease; authority: ReleaseAuthority }> {
  const { data, error } = await supabase
    .from("transcript_releases")
    .select()
    .eq("id", releaseId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  const status = (data as Record<string, unknown>).status as ReleaseStatus;
  if (status !== "draft" && status !== "requested") failWith(ErrorCodes.CONFLICT);

  const { data: authData, error: authErr } = await supabase.rpc(
    "release_authority_for",
    { p_child_id: childId },
  );
  if (authErr) throw new ApiError(mapDbError(authErr, requestId));
  const authority: ReleaseAuthority =
    (authData as string) === "student" ? "student" : "parent";

  if (authority === "parent" && role !== "parent") {
    failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  }
  if (authority === "student" && role !== "child") {
    failWith(ErrorCodes.TENANT_SCOPE_VIOLATION);
  }

  const { data: updated, error: upErr } = await supabase
    .from("transcript_releases")
    .update({
      status: "approved",
      authorized_text: input.authorized_text,
      authorized_by: userId,
      authorized_at: new Date().toISOString(),
    })
    .eq("id", releaseId)
    .eq("child_id", childId)
    .select()
    .maybeSingle();
  if (upErr) throw new ApiError(mapDbError(upErr, requestId));
  if (!updated) failWith(ErrorCodes.NOT_FOUND);
  return { release: toRelease(updated as Record<string, unknown>), authority };
}

/**
 * Records that the authorized release was actually sent (by the school or
 * the family). Only an 'approved' release can be marked sent — the DB CHECK
 * plus this status gate keep the state machine honest.
 */
export async function markReleaseSent(
  supabase: Db,
  requestId: string,
  childId: string,
  releaseId: string,
): Promise<TranscriptRelease> {
  const { data, error } = await supabase
    .from("transcript_releases")
    .select()
    .eq("id", releaseId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error) throw new ApiError(mapDbError(error, requestId));
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  const status = (data as Record<string, unknown>).status as ReleaseStatus;
  if (status !== "approved") failWith(ErrorCodes.CONFLICT);

  const { data: updated, error: upErr } = await supabase
    .from("transcript_releases")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", releaseId)
    .eq("child_id", childId)
    .select()
    .maybeSingle();
  if (upErr) throw new ApiError(mapDbError(upErr, requestId));
  if (!updated) failWith(ErrorCodes.NOT_FOUND);
  return toRelease(updated as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Readiness — the application-readiness dashboard aggregate.
// ---------------------------------------------------------------------------

export type ReminderBucket =
  | "done"
  | "overdue"
  | "2_days"
  | "7_days"
  | "14_days"
  | "30_days"
  | "later";

export interface ReadinessDeadline extends Deadline {
  /** Whole days until due_at (negative = overdue); null cannot happen. */
  days_until_due: number;
  /** Reminder bucket derived at read time — never stored. */
  reminder_bucket: ReminderBucket;
}

function bucketForDeadline(dueAt: string, done: boolean): ReminderBucket {
  if (done) return "done";
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return "overdue";
  if (days <= 2) return "2_days";
  if (days <= 7) return "7_days";
  if (days <= 14) return "14_days";
  if (days <= 30) return "30_days";
  return "later";
}

interface ArtifactSets {
  essays: Essay[];
  recommenders: Recommender[];
  testScores: TestScore[];
  releases: TranscriptRelease[];
}

/**
 * One college's derived requirement checklist — computed from real artifacts,
 * never stored (there is no per-child requirements table by design).
 */
function deriveRequirement(
  entry: CollegeListEntry,
  template: RequirementTemplate,
  artifacts: ArtifactSets,
): DerivedRequirement | null {
  if (template.college_id && template.college_id !== entry.college_id) return null;
  const base = {
    kind: template.kind,
    label: template.label,
    description: template.description,
    required: template.required,
  };
  switch (template.kind) {
    case "essay": {
      const relevant = artifacts.essays.filter(
        (e) => !e.college_id || e.college_id === entry.college_id,
      );
      if (relevant.some((e) => e.status === "final")) {
        return { ...base, status: "done", detail: "Final draft ready." };
      }
      if (relevant.length > 0) {
        return {
          ...base,
          status: "pending",
          detail: `${relevant.length} draft${relevant.length === 1 ? "" : "s"} in progress.`,
        };
      }
      return { ...base, status: "pending", detail: "No draft started." };
    }
    case "test": {
      const verified = artifacts.testScores.filter((s) => s.verified);
      if (verified.length > 0) {
        return {
          ...base,
          status: "done",
          detail: `${verified.length} verified score${verified.length === 1 ? "" : "s"} on file.`,
        };
      }
      if (artifacts.testScores.length > 0) {
        return {
          ...base,
          status: "pending",
          detail: "Scores entered but not verified against a report.",
        };
      }
      return { ...base, status: "pending", detail: "No scores on file." };
    }
    case "recommendation": {
      const key = template.template_key ?? "";
      const rel: RecommenderRelationship | null = key.includes("teacher")
        ? "teacher"
        : key.includes("counselor")
          ? "counselor"
          : null;
      const relevant = rel
        ? artifacts.recommenders.filter((r) => r.relationship === rel)
        : artifacts.recommenders;
      if (relevant.some((r) => r.status === "submitted")) {
        const who = relevant.find((r) => r.status === "submitted");
        return { ...base, status: "done", detail: `Submitted by ${who?.name ?? "recommender"}.` };
      }
      const inFlight = relevant.find((r) => r.status === "agreed" || r.status === "asked");
      if (inFlight) {
        return { ...base, status: "pending", detail: `${inFlight.name} — ${inFlight.status}.` };
      }
      return { ...base, status: "pending", detail: "No recommender asked yet." };
    }
    case "transcript": {
      const relevant = artifacts.releases.filter(
        (r) => !r.college_id || r.college_id === entry.college_id,
      );
      const advanced = relevant.find((r) => r.status === "sent" || r.status === "approved");
      if (advanced) {
        return {
          ...base,
          status: "done",
          detail: `Release ${advanced.status} (${advanced.document_kind}).`,
        };
      }
      if (relevant.length > 0) {
        return {
          ...base,
          status: "pending",
          detail: "Release drafted — needs authorization.",
        };
      }
      return { ...base, status: "pending", detail: "No release on file." };
    }
    default:
      return { ...base, status: "pending", detail: null };
  }
}

/**
 * The application-readiness dashboard aggregate: list, deadlines (with
 * derived 30/14/7/2-day buckets), derived requirement checklists, essays,
 * recommenders, scores, releases, templates, and the GPA snapshot.
 */
export async function getReadiness(
  supabase: Db,
  childId: string,
): Promise<Readiness> {
  const correlationId = crypto.randomUUID();
  const collegeSelect = "*, colleges:college_id(id,name,city,state,region,control,website)";
  const [
    listRes,
    deadlinesRes,
    essaysRes,
    recommendersRes,
    scoresRes,
    releasesRes,
    templatesRes,
  ] = await Promise.all([
    supabase.from("college_list").select(collegeSelect).eq("child_id", childId).order("created_at"),
    supabase.from("deadlines").select(collegeSelect).eq("child_id", childId).order("due_at"),
    supabase
      .from("essays")
      .select(collegeSelect)
      .eq("child_id", childId)
      .order("updated_at", { ascending: false }),
    supabase.from("recommenders").select("*").eq("child_id", childId).order("created_at"),
    supabase
      .from("test_scores")
      .select("*")
      .eq("child_id", childId)
      .order("created_at", { ascending: false }),
    supabase
      .from("transcript_releases")
      .select(collegeSelect)
      .eq("child_id", childId)
      .order("created_at", { ascending: false }),
    supabase.from("requirement_templates").select("*").order("sort_order"),
  ]);
  for (const res of [
    listRes,
    deadlinesRes,
    essaysRes,
    recommendersRes,
    scoresRes,
    releasesRes,
    templatesRes,
  ]) {
    if (res.error) throw new ApiError(mapDbError(res.error, correlationId));
  }

  const list = ((listRes.data ?? []) as Record<string, unknown>[]).map(toListEntry);
  const essays = ((essaysRes.data ?? []) as Record<string, unknown>[]).map(toEssay);
  const recommenders = ((recommendersRes.data ?? []) as Record<string, unknown>[]).map(
    toRecommender,
  );
  const testScores = ((scoresRes.data ?? []) as Record<string, unknown>[]).map(toTestScore);
  const releases = ((releasesRes.data ?? []) as Record<string, unknown>[]).map(toRelease);
  const templates = ((templatesRes.data ?? []) as Record<string, unknown>[]).map(toTemplate);

  const deadlines: ReadinessDeadline[] = (
    (deadlinesRes.data ?? []) as Record<string, unknown>[]
  ).map((row) => {
    const deadline = toDeadline(row);
    const days_until_due = Math.ceil(
      (new Date(deadline.due_at).getTime() - Date.now()) / 86400000,
    );
    return {
      ...deadline,
      days_until_due,
      reminder_bucket: bucketForDeadline(deadline.due_at, deadline.done),
    };
  });

  const artifacts: ArtifactSets = { essays, recommenders, testScores, releases };
  const derived = list.map((entry) => ({
    list_id: entry.id,
    requirements: templates.flatMap((t) => {
      const req = deriveRequirement(entry, t, artifacts);
      return req ? [req] : [];
    }),
  }));

  const gpa = await getGpaSimulation(supabase, childId, null, []);

  return { list, deadlines, essays, recommenders, testScores, releases, templates, derived, gpa };
}
