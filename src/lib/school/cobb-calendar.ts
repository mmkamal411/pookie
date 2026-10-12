// Cobb County School District calendar events — ported from the d-dash
// cobb-calendar.json (curated from cobbk12.org). Title Case everywhere.
// Categories: First and Last Days of School | Digital Learning Day |
// Board Meeting | Holiday - School Closed | Early Release Day - All levels |
// Elementary/Middle School Conference Week | Student Holiday/Staff Day

export interface CobbEvent {
  title: string;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  category: string;
}

export const COBB_EVENTS: CobbEvent[] = [
  { title: "First Day of School", start: "2026-08-03", end: "2026-08-03", category: "First and Last Days of School" },
  { title: "Digital Learning Day", start: "2026-08-17", end: "2026-08-17", category: "Digital Learning Day" },
  { title: "CCSD Board Meeting", start: "2026-08-20", end: "2026-08-20", category: "Board Meeting" },
  { title: "Labor Day", start: "2026-09-07", end: "2026-09-07", category: "Holiday - School Closed" },
  { title: "CCSD Board Meeting", start: "2026-09-17", end: "2026-09-17", category: "Board Meeting" },
  { title: "Fall Break", start: "2026-09-21", end: "2026-09-25", category: "Holiday - School Closed" },
  { title: "Digital Learning Day", start: "2026-10-12", end: "2026-10-12", category: "Digital Learning Day" },
  { title: "Elementary/Middle School Conference Week", start: "2026-10-13", end: "2026-10-16", category: "Elementary/Middle School Conference Week" },
  { title: "CCSD Board Meeting", start: "2026-10-15", end: "2026-10-15", category: "Board Meeting" },
  { title: "Election Day", start: "2026-11-03", end: "2026-11-03", category: "Student Holiday/Staff Day" },
  { title: "CCSD Board Meeting", start: "2026-11-12", end: "2026-11-12", category: "Board Meeting" },
  { title: "Thanksgiving Holidays", start: "2026-11-23", end: "2026-11-27", category: "Holiday - School Closed" },
  { title: "Digital Learning Day", start: "2026-12-01", end: "2026-12-01", category: "Digital Learning Day" },
  { title: "Early Release All Levels", start: "2026-12-17", end: "2026-12-18", category: "Early Release Day - All levels" },
  { title: "CCSD Board Meeting", start: "2026-12-17", end: "2026-12-17", category: "Board Meeting" },
  { title: "Winter Holidays", start: "2026-12-21", end: "2027-01-01", category: "Holiday - School Closed" },
  { title: "Winter Holiday", start: "2027-01-04", end: "2027-01-04", category: "Student Holiday/Staff Day" },
  { title: "MLK, Jr. Day", start: "2027-01-18", end: "2027-01-18", category: "Holiday - School Closed" },
  { title: "CCSD Board Meeting", start: "2027-01-21", end: "2027-01-21", category: "Board Meeting" },
  { title: "Winter Break", start: "2027-02-15", end: "2027-02-19", category: "Holiday - School Closed" },
  { title: "Digital Learning Day", start: "2027-03-01", end: "2027-03-01", category: "Digital Learning Day" },
  { title: "Spring Break", start: "2027-04-05", end: "2027-04-09", category: "Holiday - School Closed" },
  { title: "Early Release All Levels", start: "2027-05-17", end: "2027-05-19", category: "Early Release Day - All levels" },
  { title: "Last Day of School", start: "2027-05-19", end: "2027-05-19", category: "First and Last Days of School" },
  { title: "Memorial Day", start: "2027-05-31", end: "2027-05-31", category: "Holiday - School Closed" },
];

export const COBB_CATEGORIES: { key: string; label: string; dot: string; chip: string }[] = [
  { key: "First and Last Days of School", label: "First / Last Day", dot: "#059669", chip: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30" },
  { key: "Digital Learning Day", label: "Digital Learning", dot: "#d97706", chip: "bg-amber-400/15 text-amber-300 border-amber-400/30" },
  { key: "Board Meeting", label: "Board Meeting", dot: "#94a3b8", chip: "bg-slate-400/15 text-slate-300 border-slate-400/30" },
  { key: "Holiday - School Closed", label: "Holiday (Closed)", dot: "#e11d48", chip: "bg-rose-400/15 text-rose-300 border-rose-400/30" },
  { key: "Early Release Day - All levels", label: "Early Release", dot: "#ea580c", chip: "bg-orange-400/15 text-orange-300 border-orange-400/30" },
  { key: "Elementary/Middle School Conference Week", label: "Conference Week", dot: "#2dd4bf", chip: "bg-teal-400/15 text-teal-300 border-teal-400/30" },
  { key: "Student Holiday/Staff Day", label: "Student Holiday", dot: "#2563eb", chip: "bg-blue-400/15 text-blue-300 border-blue-400/30" },
];

export function cobbStyleFor(category: string): { dot: string; chip: string; label: string } {
  const found = COBB_CATEGORIES.find((c) => c.key === category);
  if (found) return { dot: found.dot, chip: found.chip, label: found.label };
  return { dot: "#71717a", chip: "bg-zinc-400/15 text-zinc-300 border-zinc-400/30", label: category };
}
