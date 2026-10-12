// Shared W1 School Core shapes — client-safe (no server imports).
// Server responses and UI props both conform to these.

export interface ClassOverview {
  class_id: string;
  class_slug: string;
  name: string;
  display_name: string | null;
  period: string | null;
  teacher_name: string | null;
  term: string | null;
  numeric: number | null;
  delta_7d: number | null;
}

export interface DueNextItem {
  id: string;
  class_id: string;
  class_slug: string;
  class_name: string;
  title: string;
  category: string | null;
  due_date: string | null;
  status: string;
  points_earned: number | null;
  points_possible: number | null;
  notes: string | null;
}

export interface SchoolOverview {
  classes: ClassOverview[];
  due_next: DueNextItem[];
  checkin_today: boolean;
}

export interface GradeHistoryPoint {
  taken_at: string;
  numeric: number | null;
}

export interface AssignmentItem {
  id: string;
  class_id: string;
  title: string;
  category: string | null;
  due_date: string | null;
  status: string;
  points_earned: number | null;
  points_possible: number | null;
  notes: string | null;
}

export interface PlanAction {
  rank: number;
  action: string;
  why?: string;
  done: boolean;
}

export interface StudyPlan {
  id: string;
  class_id: string;
  week_start: string;
  plan: PlanAction[];
  generated_by: string;
  safety_status: "pending" | "approved" | "rejected";
  status: string;
  created_at: string;
}

export interface TeacherMessage {
  id: string;
  class_id: string | null;
  direction: "inbound" | "outbound";
  subject: string | null;
  body: string;
  /** True when a parent viewer gets metadata only (counselor confidentiality). */
  body_withheld?: boolean;
  status: "draft" | "approved" | "sent" | "received";
  created_at: string;
  sent_at: string | null;
  /** FR-SCHOOL-002: counselor rows (class_id NULL per 006 route rule) are segregated. */
  sender_type?: "teacher" | "counselor";
  /** FR-SCHOOL-001: per-message provenance. */
  source?: "parentvue" | "ctls" | "gmail" | "manual" | string;
  fetched_at?: string | null;
  safety_critical?: boolean;
}

/** FR-SCHOOL-003: the teen's outcome estimate on one check-in. */
export interface CheckinEstimate {
  id: string;
  label: string;
  estimate_pct: number;
  /** Paired by the sync worker when the graded outcome arrives (null until then). */
  actual_pct: number | null;
}

/** FR-SCHOOL-003: rolling calibration — teen-only, never parent-visible. */
export interface CalibrationSummary {
  /** Paired estimates counted (last 10). <5 → small-n guard, no score. */
  paired: number;
  /** Mean |estimate − actual| in percentage points, null until ≥5 paired. */
  mean_error_pts: number | null;
  /** Framing band — about the skill of estimating, never about honesty. */
  band: "warming" | "steady" | "sharpening";
  /** First-half vs second-half mean error delta (positive = improving). */
  trend_pts: number | null;
}

/** The teen's own check-in for one day (private — requireChildRole). */
export interface TodayCheckin {
  id: string;
  mood: number | null;
  energy: number | null;
  stress: number | null;
  text: string | null;
  lab_read_safety_card: boolean;
  lab_anonymous_question: string | null;
  estimates: CheckinEstimate[];
}

/** FR-SCHOOL-004: Study Sparks — labeled study-skill micro-content. */
export interface StudySpark {
  id: string;
  class_id: string | null;
  body: string;
  origin: "ai-synthesis" | "curriculum-extraction";
  source_refs: unknown;
  deident_method: "aggregate-k5" | "curriculum-only";
  study_skill_tags: string[];
  review_status: "auto" | "human-approved" | "qa-sampled";
  ai_label: string;
  expires_at: string;
  created_at: string;
}

export interface ClassDetail {
  class: {
    id: string;
    class_slug: string;
    name: string;
    display_name: string | null;
    period: string | null;
    teacher_name: string | null;
    teacher_email: string | null;
  };
  grade: { term: string | null; numeric: number | null } | null;
  history: GradeHistoryPoint[];
  assignments: AssignmentItem[];
  study_plan: StudyPlan | null;
  teacher_thread: TeacherMessage[];
}

export interface ClassFile {
  name: string;
  path: string;
  signed_url: string;
  created_at: string | null;
}
