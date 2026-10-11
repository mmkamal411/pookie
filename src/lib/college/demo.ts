// W5 demo dataset — clearly mock reference values for click-through only.
// Demo never calls /api/v1/*; these mocks stand in for the Supabase rows.
// Note: the DBA seeds NO college_stats (honesty rule — no fabricated stats),
// so the demo ships stats for exactly one college, labeled demo data, to
// exercise both the band UI and the "not yet available" path.
import type {
  AidProgram,
  College,
  CollegeStat,
  Deadline,
  Essay,
  CollegeListEntry,
  Readiness,
  Recommender,
  RequirementTemplate,
  TestScore,
  TranscriptRelease,
} from "./types";

const CHILD_ID = "00000000-0000-4000-8000-0000000000d0";
const AS_OF = "2025-10-01";
const DEMO_SOURCE = "Demo reference data — not real statistics";

export function getDemoColleges(): College[] {
  const c = (
    name: string,
    city: string,
    state: string,
    region: College["region"],
    control: College["control"],
  ): College => ({
    id: `demo-college-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    city,
    state,
    region,
    control,
    website: "https://example.edu",
  });
  return [
    c("Emory University", "Atlanta", "GA", "ga_instate", "private"),
    c("Georgia Institute of Technology", "Atlanta", "GA", "ga_instate", "public"),
    c("University of Georgia", "Athens", "GA", "ga_instate", "public"),
    c("Augusta University", "Augusta", "GA", "ga_instate", "public"),
    c("Duke University", "Durham", "NC", "southeast", "private"),
    c("Vanderbilt University", "Nashville", "TN", "southeast", "private"),
    c("Johns Hopkins University", "Baltimore", "MD", "national_premed", "private"),
    c("University of Pittsburgh", "Pittsburgh", "PA", "national_premed", "public"),
  ];
}

/** Demo stats for exactly one college — exercises the band + citation UI. */
export function getDemoCollegeStats(): CollegeStat[] {
  const uga = `demo-college-university-of-georgia`;
  const s = (stat_key: string, stat_value: number): CollegeStat => ({
    id: `demo-stat-${stat_key}`,
    college_id: uga,
    stat_key,
    stat_value,
    as_of: AS_OF,
    source: DEMO_SOURCE,
  });
  return [
    s("sat_25", 1270),
    s("sat_75", 1450),
    s("act_25", 28),
    s("act_75", 33),
    s("acceptance_rate", 43),
  ];
}

export function getDemoTemplates(): RequirementTemplate[] {
  return [
    { id: "demo-tpl-1", template_key: "personal_statement", college_id: null, kind: "essay", label: "Personal statement", description: "Common App personal essay, 650 words max", required: true, sort_order: 10 },
    { id: "demo-tpl-2", template_key: "test_scores", college_id: null, kind: "test", label: "SAT or ACT scores", description: "Official scores sent from the testing agency", required: false, sort_order: 20 },
    { id: "demo-tpl-3", template_key: "teacher_rec", college_id: null, kind: "recommendation", label: "Teacher recommendation", description: "At least one core-subject teacher recommendation", required: true, sort_order: 30 },
    { id: "demo-tpl-4", template_key: "counselor_rec", college_id: null, kind: "recommendation", label: "Counselor recommendation", description: "School counselor recommendation + school report", required: true, sort_order: 40 },
    { id: "demo-tpl-5", template_key: "official_transcript", college_id: null, kind: "transcript", label: "Official transcript", description: "Released via an authorized transcript release", required: true, sort_order: 50 },
  ];
}

export function getDemoAidPrograms(): AidProgram[] {
  return [
    { program_key: "hope", name: "HOPE Scholarship", state: "GA", description: "Demo: merit-based award for Georgia residents.", min_gpa: 3.0, test_requirement: null, residency: "Georgia resident", as_of: AS_OF, source: "Demo data", active: true },
    { program_key: "zell_miller", name: "Zell Miller Scholarship", state: "GA", description: "Demo: top-tier merit award for Georgia residents.", min_gpa: 3.7, test_requirement: "1200 SAT or 26 ACT (single sitting)", residency: "Georgia resident", as_of: AS_OF, source: "Demo data", active: true },
  ];
}

export function getDemoReadiness(): Readiness {
  const colleges = getDemoColleges();
  const byName = (n: string) => colleges.find((c) => c.name === n)!;
  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

  const list: CollegeListEntry[] = [
    { id: "demo-list-1", child_id: CHILD_ID, college_id: byName("University of Georgia").id, college: byName("University of Georgia"), status: "applying", notes: null },
    { id: "demo-list-2", child_id: CHILD_ID, college_id: byName("Augusta University").id, college: byName("Augusta University"), status: "interested", notes: null },
    { id: "demo-list-3", child_id: CHILD_ID, college_id: byName("Emory University").id, college: byName("Emory University"), status: "interested", notes: null },
  ];
  const deadlines: Deadline[] = [
    { id: "demo-dl-1", child_id: CHILD_ID, college_id: byName("University of Georgia").id, college: byName("University of Georgia"), kind: "early_action", label: "Early Action application", due_at: inDays(5), notes: null, done: false },
    { id: "demo-dl-2", child_id: CHILD_ID, college_id: byName("University of Georgia").id, college: byName("University of Georgia"), kind: "scholarship", label: "Foundation Fellowship", due_at: inDays(12), notes: null, done: false },
    { id: "demo-dl-3", child_id: CHILD_ID, college_id: byName("Augusta University").id, college: byName("Augusta University"), kind: "regular", label: "Regular Decision", due_at: inDays(45), notes: null, done: false },
  ];
  const essays: Essay[] = [
    { id: "demo-essay-1", child_id: CHILD_ID, college_id: byName("University of Georgia").id, college: byName("University of Georgia"), prompt: "Demo: describe a challenge you overcame.", draft: "Demo draft text — the real essay lives here.", status: "draft", word_limit: 650 },
  ];
  const recommenders: Recommender[] = [
    { id: "demo-rec-1", child_id: CHILD_ID, name: "Demo Teacher", relationship: "teacher", email: "teacher@example.edu", status: "asked", requested_at: inDays(-3), submitted_at: null },
  ];
  const testScores: TestScore[] = [
    { id: "demo-ts-1", child_id: CHILD_ID, test: "PSAT", test_date: "2026-10-01", section_scores: { reading_writing: 620, math: 590 }, total: 1210, report_path: null, verified: true },
  ];
  const releases: TranscriptRelease[] = [
    { id: "demo-rel-1", child_id: CHILD_ID, college_id: byName("University of Georgia").id, college: byName("University of Georgia"), document_kind: "official_transcript", status: "draft", authorized_text: null, authorized_by: null, authorized_at: null, sent_at: null },
  ];
  const templates = getDemoTemplates();
  const derived = [
    {
      list_id: "demo-list-1",
      requirements: [
        { kind: "essay" as const, label: "Personal statement", description: "Common App personal essay, 650 words max", required: true, status: "pending" as const, detail: "Draft in progress" },
        { kind: "test" as const, label: "SAT or ACT scores", description: "Official scores sent from the testing agency", required: false, status: "done" as const, detail: "PSAT 1210 verified" },
        { kind: "recommendation" as const, label: "Teacher recommendation", description: "At least one core-subject teacher recommendation", required: true, status: "pending" as const, detail: "Asked — awaiting response" },
        { kind: "transcript" as const, label: "Official transcript", description: "Released via an authorized transcript release", required: true, status: "pending" as const, detail: "Release not yet authorized" },
      ],
    },
  ];
  const gpa = {
    term: "GP2",
    current_gpa: 81.5,
    simulated_gpa: 81.5,
    delta: 0,
    trend: { direction: "rising" as const, delta: 2.3 },
    trend_points: [
      { week: "2026-08-17", avg: 79.2 },
      { week: "2026-09-21", avg: 81.5 },
    ],
  };
  return { list, deadlines, essays, recommenders, testScores, releases, templates, derived, gpa };
}
