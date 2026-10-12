// District calendar — prefers E4's school_calendar table (live ingest),
// falls back to the curated Cobb static data so the calendar never blanks.

import { createClient } from "@/lib/supabase/server";
import { COBB_CATEGORIES, COBB_EVENTS, type CobbEvent } from "@/lib/school/cobb-calendar";

const TYPE_LABEL: Record<string, string> = {
  holiday: "Holiday (Closed)",
  no_school: "Student Holiday",
  early_release: "Early Release",
  late_start: "Late Start",
  testing: "Testing",
  event: "School Event",
  deadline: "Deadline",
};

export interface CalendarPayload {
  events: CobbEvent[];
  categories: typeof COBB_CATEGORIES;
  live: boolean;
}

export async function getCalendarEvents(childId: string): Promise<CalendarPayload> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("school_calendar")
      .select("event_date, end_date, title, event_type, description")
      .eq("child_id", childId)
      .order("event_date", { ascending: true })
      .limit(120);
    if (!error && data && data.length > 0) {
      const events: CobbEvent[] = (data as Array<{
        event_date: string;
        end_date: string | null;
        title: string;
        event_type: string;
        description: string | null;
      }>).map((e) => ({
        title: e.title,
        start: e.event_date,
        end: e.end_date ?? e.event_date,
        category: TYPE_LABEL[e.event_type] ?? e.event_type,
      }));
      return { events, categories: COBB_CATEGORIES, live: true };
    }
  } catch {
    // curated fallback holds
  }
  return { events: COBB_EVENTS, categories: COBB_CATEGORIES, live: false };
}
