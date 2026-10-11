// W5 college prep — shared shapes. Client-safe (no server imports).
// Mirrors the DBA's canonical schema: supabase/migrations/009_w5_college_prep.sql.
// Honesty rules are structural here: selectivity stats live in college_stats
// with mandatory as_of + source; nothing in these types can express an
// admission probability.

export type CollegeRegion = "ga_instate" | "southeast" | "national_premed";
export type CollegeControl = "public" | "private";

export interface College {
  id: string;
  name: string;
  city: string;
  state: string;
  region: CollegeRegion;
  control: CollegeControl;
  website: string | null;
}

/**
 * One dated, cited statistic. stat_key examples: 'acceptance_rate',
 * 'sat_25', 'sat_75', 'act_25', 'act_75', 'avg_gpa', 'enrollment_total'.
 * Values are bands/points, never probabilities.
 */
export interface CollegeStat {
  id: string;
  college_id: string;
  stat_key: string;
  stat_value: number;
  as_of: string; // YYYY-MM-DD
  source: string;
}

export type TemplateKind =
  | "essay"
  | "test"
  | "recommendation"
  | "transcript"
  | "portfolio"
  | "interview"
  | "other";

export interface RequirementTemplate {
  id: string;
  template_key: string | null;
  college_id: string | null;
  kind: TemplateKind;
  label: string;
  description: string | null;
  required: boolean;
  sort_order: number;
}

export interface AidProgram {
  program_key: string;
  name: string;
  state: string;
  description: string;
  min_gpa: number | null;
  test_requirement: string | null;
  residency: string | null;
  as_of: string;
  source: string;
  active: boolean;
}

export type ListStatus =
  | "interested"
  | "applying"
  | "applied"
  | "accepted"
  | "denied"
  | "waitlisted"
  | "enrolled"
  | "removed";

export interface CollegeListEntry {
  id: string;
  child_id: string;
  college_id: string;
  college?: College;
  status: ListStatus;
  notes: string | null;
}

export type DeadlineKind =
  | "early_action"
  | "early_decision"
  | "early_decision_2"
  | "regular"
  | "rolling"
  | "scholarship"
  | "fafsa"
  | "css_profile"
  | "other";

export interface Deadline {
  id: string;
  child_id: string;
  college_id: string | null;
  college?: College;
  kind: DeadlineKind;
  label: string;
  due_at: string;
  notes: string | null;
  done: boolean;
}

export interface Essay {
  id: string;
  child_id: string;
  college_id: string | null;
  college?: College;
  prompt: string;
  draft: string | null;
  status: "draft" | "in_review" | "final";
  word_limit: number | null;
}

export interface EssayFeedback {
  /** Always true in v1 — the AI call site is a stub, no provider is called. */
  stub: true;
  word_count: number;
  word_target: number | null;
  checks: { label: string; detail: string }[];
  message: string;
}

export type RecommenderRelationship =
  | "teacher"
  | "counselor"
  | "coach"
  | "employer"
  | "other";

export interface Recommender {
  id: string;
  child_id: string;
  name: string;
  relationship: RecommenderRelationship;
  email: string | null;
  status: "asked" | "agreed" | "submitted" | "declined";
  requested_at: string | null;
  submitted_at: string | null;
}

export type TestType = "SAT" | "ACT" | "PSAT" | "AP" | "other";

export interface TestScore {
  id: string;
  child_id: string;
  test: TestType;
  test_date: string | null;
  section_scores: Record<string, number>;
  total: number | null;
  report_path: string | null;
  verified: boolean;
}

export type ReleaseDocument =
  | "official_transcript"
  | "midyear_report"
  | "final_transcript"
  | "other";

export type ReleaseStatus = "draft" | "requested" | "approved" | "sent" | "revoked";

export interface TranscriptRelease {
  id: string;
  child_id: string;
  college_id: string | null;
  college?: College;
  document_kind: ReleaseDocument;
  status: ReleaseStatus;
  authorized_text: string | null;
  authorized_by: string | null;
  authorized_at: string | null;
  sent_at: string | null;
}

/** Derived per-college requirement checklist — computed from real artifacts,
 *  never stored (there is no per-child requirements table by design). */
export interface DerivedRequirement {
  kind: TemplateKind;
  label: string;
  description: string | null;
  required: boolean;
  status: "pending" | "done" | "waived";
  detail: string | null;
}

export interface GpaTrendPoint {
  week: string;
  avg: number;
}

export interface GpaSimulation {
  term: string | null;
  current_gpa: number | null;
  simulated_gpa: number | null;
  delta: number | null;
  trend: { direction: "rising" | "falling" | "steady"; delta: number } | null;
  trend_points: GpaTrendPoint[];
}

export interface Readiness {
  list: CollegeListEntry[];
  deadlines: Deadline[];
  essays: Essay[];
  recommenders: Recommender[];
  testScores: TestScore[];
  releases: TranscriptRelease[];
  templates: RequirementTemplate[];
  derived: { list_id: string; requirements: DerivedRequirement[] }[];
  gpa: GpaSimulation | null;
}
