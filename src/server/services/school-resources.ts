// Per-class resource library — the student owns it: add/edit/remove.
// First view seeds recommendations from the curated study resources
// (CLASS_TOPICS); seeds are rows like any other (is_seeded=true).
// Service uses the user-JWT client; RLS binds created_by = auth.uid().

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertTenant } from "@/server/tenant";
import { CLASS_TOPICS, classMetaFor, matchClassSlug } from "@/lib/school/study-resources";

/** Any tenant member may curate the library; RLS (owner-or-parent) gates writes. */
async function memberUserId(childId: string): Promise<string> {
  const tenant = await assertTenant(childId);
  return tenant.userId;
}

export type ResourceType =
  | "khan_academy"
  | "youtube"
  | "cheat_sheet"
  | "clever"
  | "kahoot"
  | "blooket"
  | "quizlet"
  | "desmos"
  | "deltamath"
  | "ap_classroom"
  | "ebook"
  | "game"
  | "other";

export interface LibraryResource {
  id: string;
  childId: string;
  classId: string;
  title: string;
  url: string | null;
  type: ResourceType;
  description: string | null;
  unitTag: string | null;
  isSeeded: boolean;
  createdAt: string;
}

export const resourceUpsertSchema = z.object({
  class_id: z.string().uuid(),
  title: z.string().min(1).max(280),
  url: z.string().url().max(2000).nullable().optional(),
  resource_type: z.enum([
    "khan_academy",
    "youtube",
    "cheat_sheet",
    "clever",
    "kahoot",
    "blooket",
    "quizlet",
    "desmos",
    "deltamath",
    "ap_classroom",
    "ebook",
    "game",
    "other",
  ]),
  description: z.string().max(1000).nullable().optional(),
  unit_tag: z.string().max(200).nullable().optional(),
});

type Row = {
  id: string;
  child_id: string;
  class_id: string;
  title: string;
  url: string | null;
  resource_type: string;
  description: string | null;
  unit_tag: string | null;
  is_seeded: boolean;
  created_at: string;
};

function toResource(r: Row): LibraryResource {
  return {
    id: r.id,
    childId: r.child_id,
    classId: r.class_id,
    title: r.title,
    url: r.url,
    type: r.resource_type as ResourceType,
    description: r.description,
    unitTag: r.unit_tag,
    isSeeded: r.is_seeded,
    createdAt: r.created_at,
  };
}

/** Curated-topic resource → library type. */
function mapCuratedType(t: string): ResourceType {
  switch (t) {
    case "khan": return "khan_academy";
    case "youtube": return "youtube";
    case "ebook": return "ebook";
    case "game": return "game";
    case "clever": return "clever";
    case "cheatsheet": return "cheat_sheet";
    default: return "other";
  }
}

interface Seed {
  title: string;
  url: string | null;
  type: ResourceType;
  description: string | null;
  unitTag: string | null;
}

function buildSeeds(slug: string): Seed[] {
  const entry = CLASS_TOPICS[slug];
  if (!entry) return [];
  const seeds: Seed[] = [];
  const meta = classMetaFor(slug);
  for (const topic of entry.topics) {
    if (topic.ebook) {
      seeds.push({
        title: topic.ebook.title,
        url: topic.ebook.url,
        type: "ebook",
        description: `Ebook for ${topic.name}`,
        unitTag: topic.name,
      });
    }
    for (const r of topic.resources) {
      seeds.push({
        title: r.title,
        url: r.url,
        type: mapCuratedType(r.type),
        description: r.description ?? null,
        unitTag: topic.name,
      });
    }
    if (topic.quizUrl) {
      seeds.push({
        title: `Practice Quiz — ${topic.name}`,
        url: topic.quizUrl,
        type: "other",
        description: "Self-test on this unit",
        unitTag: topic.name,
      });
    }
    if (topic.games) {
      for (const g of topic.games) {
        seeds.push({
          title: g.name,
          url: g.url,
          type: "game",
          description: g.description,
          unitTag: topic.name,
        });
      }
    }
    if (topic.cheatsheet) {
      seeds.push({
        title: `Cheat Sheet — ${topic.name}`,
        url: null,
        type: "cheat_sheet",
        description: "Open it in Study Resources on the class page",
        unitTag: topic.name,
      });
    }
  }
  return seeds;
}

/**
 * List the library for a class; seeds recommendations on first view when
 * the library is empty and a curated slug matches. Never throws — returns
 * what it can.
 */
export async function listLibraryResources(
  childId: string,
  classId: string,
  slug: string | null
): Promise<{ resources: LibraryResource[]; seeded: boolean }> {
  const supabase = await createClient();
  const userId = await memberUserId(childId);

  const { data, error } = await supabase
    .from("class_resources")
    .select("id, child_id, class_id, title, url, resource_type, description, unit_tag, is_seeded, created_at")
    .eq("child_id", childId)
    .eq("class_id", classId)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { resources: [], seeded: false };

  const rows = (data ?? []) as Row[];
  if (rows.length > 0) return { resources: rows.map(toResource), seeded: false };

  // Empty library: seed from curated recommendations if we know the class.
  if (!slug) return { resources: [], seeded: false };
  const seeds = buildSeeds(slug);
  if (seeds.length === 0) return { resources: [], seeded: false };

  const insertRows = seeds.map((s, i) => ({
    child_id: childId,
    class_id: classId,
    title: s.title,
    url: s.url,
    resource_type: s.type,
    description: s.description,
    unit_tag: s.unitTag,
    is_seeded: true,
    is_active: true,
    sort_order: i,
    created_by: userId,
  }));
  const { data: seeded, error: seedErr } = await supabase
    .from("class_resources")
    .insert(insertRows)
    .select("id, child_id, class_id, title, url, resource_type, description, unit_tag, is_seeded, created_at");
  if (seedErr) return { resources: [], seeded: false };
  return { resources: ((seeded ?? []) as Row[]).map(toResource), seeded: true };
}

/** Map a class_id back to a curated slug via the class name. */
export async function classSlugFor(childId: string, classId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("classes")
      .select("name, class_slug")
      .eq("child_id", childId)
      .eq("id", classId)
      .maybeSingle();
    const row = data as { name: string; class_slug: string | null } | null;
    if (!row) return null;
    return matchClassSlug(row.name) ?? row.class_slug ?? null;
  } catch {
    return null;
  }
}

export async function createLibraryResource(
  childId: string,
  input: z.infer<typeof resourceUpsertSchema>
): Promise<LibraryResource> {
  const supabase = await createClient();
  const userId = await memberUserId(childId);
  const { data, error } = await supabase
    .from("class_resources")
    .insert({
      child_id: childId,
      class_id: input.class_id,
      title: input.title,
      url: input.url ?? null,
      resource_type: input.resource_type,
      description: input.description ?? null,
      unit_tag: input.unit_tag ?? null,
      is_seeded: false,
      is_active: true,
      created_by: userId,
    })
    .select("id, child_id, class_id, title, url, resource_type, description, unit_tag, is_seeded, created_at")
    .single();
  if (error) throw error;
  return toResource(data as Row);
}

export async function updateLibraryResource(
  childId: string,
  resourceId: string,
  patch: Partial<z.infer<typeof resourceUpsertSchema>>
): Promise<LibraryResource> {
  const supabase = await createClient();
  await memberUserId(childId);
  const { data, error } = await supabase
    .from("class_resources")
    .update({
      ...(patch.title != null ? { title: patch.title } : {}),
      ...(patch.url !== undefined ? { url: patch.url ?? null } : {}),
      ...(patch.resource_type ? { resource_type: patch.resource_type } : {}),
      ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
      ...(patch.unit_tag !== undefined ? { unit_tag: patch.unit_tag ?? null } : {}),
    })
    .eq("id", resourceId)
    .eq("child_id", childId)
    .select("id, child_id, class_id, title, url, resource_type, description, unit_tag, is_seeded, created_at")
    .single();
  if (error) throw error;
  return toResource(data as Row);
}

export async function deleteLibraryResource(childId: string, resourceId: string): Promise<void> {
  const supabase = await createClient();
  await memberUserId(childId);
  // Soft-delete: keeps history, hides from the library.
  const { error } = await supabase
    .from("class_resources")
    .update({ is_active: false })
    .eq("id", resourceId)
    .eq("child_id", childId);
  if (error) throw error;
}

/** Restore any seeded recommendations the student removed. */
export async function restoreSeeds(childId: string, classId: string): Promise<{ restored: number }> {
  const supabase = await createClient();
  const userId = await memberUserId(childId);
  const slug = await classSlugFor(childId, classId);
  if (!slug) return { restored: 0 };
  const seeds = buildSeeds(slug);
  if (seeds.length === 0) return { restored: 0 };

  const { data: existing } = await supabase
    .from("class_resources")
    .select("title")
    .eq("child_id", childId)
    .eq("class_id", classId)
    .eq("is_seeded", true);
  const have = new Set(((existing ?? []) as Array<{ title: string }>).map((r) => r.title));
  const missing = seeds.filter((s) => !have.has(s.title));
  if (missing.length === 0) return { restored: 0 };

  const { error } = await supabase.from("class_resources").insert(
    missing.map((s, i) => ({
      child_id: childId,
      class_id: classId,
      title: s.title,
      url: s.url,
      resource_type: s.type,
      description: s.description,
      unit_tag: s.unitTag,
      is_seeded: true,
      is_active: true,
      sort_order: 1000 + i,
      created_by: userId,
    }))
  );
  if (error) throw error;
  return { restored: missing.length };
}
