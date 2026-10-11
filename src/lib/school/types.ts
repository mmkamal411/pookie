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
  status: "draft" | "approved" | "sent" | "received";
  created_at: string;
  sent_at: string | null;
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
