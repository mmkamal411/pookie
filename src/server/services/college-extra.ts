// Appended W5 helpers: per-class GPA inputs (for the simulator sliders) and
// the public aid-program registry (HOPE / Zell Miller seed).
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError, ErrorCodes } from "@/server/errors";
import type { AidProgram } from "@/lib/college/types";

type Db = SupabaseClient<any, "public", any>;

export interface GpaInput {
  class_id: string;
  name: string;
  current: number | null;
}

/** Per-class current grades feeding the simulator's "what-if" sliders. */
export async function getGpaInputs(supabase: Db, childId: string, term: string | null): Promise<{ term: string | null; inputs: GpaInput[] }> {
  let resolvedTerm = term;
  if (!resolvedTerm) {
    const { data } = await supabase
      .from("grades").select("term").eq("child_id", childId).not("numeric", "is", null)
      .order("synced_at", { ascending: false }).limit(1).maybeSingle();
    resolvedTerm = (data as { term: string } | null)?.term ?? null;
  }
  const { data: classes, error: cErr } = await supabase
    .from("classes").select("id,display_name,name").eq("child_id", childId).eq("active", true)
    .order("display_order").order("name");
  if (cErr) throw new ApiError(ErrorCodes.INTERNAL);
  const { data: grades } = resolvedTerm
    ? await supabase.from("grades").select("class_id,numeric").eq("child_id", childId).eq("term", resolvedTerm)
    : { data: [] as any[] };
  const byClass = new Map(((grades ?? []) as { class_id: string; numeric: number | null }[]).map((g) => [g.class_id, g.numeric]));
  const inputs: GpaInput[] = ((classes ?? []) as { id: string; display_name: string | null; name: string }[]).map((c) => ({
    class_id: c.id,
    name: c.display_name ?? c.name,
    current: byClass.get(c.id) ?? null,
  }));
  return { term: resolvedTerm, inputs };
}

/** Public aid programs (HOPE, Zell Miller) — Class-P reference data. */
export async function getAidPrograms(supabase: Db): Promise<AidProgram[]> {
  const { data, error } = await supabase
    .from("college_aid_programs").select("*").eq("active", true).order("min_gpa", { ascending: false });
  if (error) throw new ApiError(ErrorCodes.INTERNAL);
  return (data ?? []) as AidProgram[];
}
