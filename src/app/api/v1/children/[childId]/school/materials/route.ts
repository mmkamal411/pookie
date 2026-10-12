// GET /api/v1/children/[childId]/school/materials?slug=apcsp — Drive-synced
// course units + materials for a class (course_units / course_materials).
// Graceful when the tables don't exist yet: returns empty units/materials
// with available:false instead of 500ing.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";

export interface CourseUnit {
  id: string;
  unit_number: number;
  unit_label: string;
  semester: string | null;
  is_current: boolean;
}

export interface CourseMaterial {
  id: string;
  title: string;
  file_type: string | null;
  section: string | null;
  unit_number: number | null;
  part_number: number | null;
  size_bytes: number | null;
  tags: string[];
  semester: string | null;
}

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").toLowerCase().trim();

  let units: CourseUnit[] = [];
  let materials: CourseMaterial[] = [];
  let available = true;

  if (slug) {
    try {
      const supabase = await createClient();
      const [unitsRes, matsRes] = await Promise.all([
        supabase
          .from("course_units")
          .select("id, unit_number, unit_label, semester, is_current")
          .eq("class_slug", slug)
          .order("unit_number", { ascending: true }),
        supabase
          .from("course_materials")
          .select("id, title, file_type, section, unit_number, part_number, size_bytes, tags, semester")
          .eq("class_slug", slug)
          .order("section", { ascending: true })
          .order("unit_number", { ascending: true, nullsFirst: false })
          .order("part_number", { ascending: true, nullsFirst: false })
          .order("title", { ascending: true }),
      ]);
      if (unitsRes.error) throw unitsRes.error;
      if (matsRes.error) throw matsRes.error;
      units = ((unitsRes.data ?? []) as Array<Record<string, unknown>>).map((u) => ({
        id: String(u.id),
        unit_number: Number(u.unit_number),
        unit_label: String(u.unit_label),
        semester: (u.semester as string | null) ?? null,
        is_current: Boolean(u.is_current),
      }));
      materials = ((matsRes.data ?? []) as Array<Record<string, unknown>>).map((m) => ({
        id: String(m.id),
        title: String(m.title),
        file_type: (m.file_type as string | null) ?? null,
        section: (m.section as string | null) ?? null,
        unit_number: m.unit_number != null ? Number(m.unit_number) : null,
        part_number: m.part_number != null ? Number(m.part_number) : null,
        size_bytes: m.size_bytes != null ? Number(m.size_bytes) : null,
        tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
        semester: (m.semester as string | null) ?? null,
      }));
    } catch {
      // Tables not yet migrated — the UI renders the awaiting-sync state.
      available = false;
    }
  }

  await auditEvent(tenant.childId, "school.materials.read", { slug });
  return { slug, available, units, materials };
});
