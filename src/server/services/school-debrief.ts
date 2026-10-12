// Astronaut-debriefing backend — per-class check-in detail + handout
// uploads. Writes E4's checkin_class_details (covered/clicked/fuzzy/
// due_next/confidence) and checkin_uploads (class-handouts bucket +
// metadata with auto unit tag from classes.current_unit).
//
// Privacy: debriefing text is child-confidential (W8 contract) — writes are
// teen-only via requireChildRole; parents get aggregates elsewhere.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ApiError, ErrorCodes, failWith, mapDbError } from "@/server/errors";
import { requireChildRole } from "@/server/services/school";

export const debriefSchema = z.object({
  class_id: z.string().uuid(),
  covered: z.string().max(2000).optional().nullable(),
  clicked: z.string().max(2000).optional().nullable(),
  fuzzy: z.string().max(2000).optional().nullable(),
  due_next: z.string().max(1000).optional().nullable(),
  confidence: z.number().int().min(1).max(5).optional().nullable(),
});

export interface ClassDebrief {
  covered: string | null;
  clicked: string | null;
  fuzzy: string | null;
  dueNext: string | null;
  confidence: number | null;
}

const HANDOUTS_BUCKET = "class-handouts";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

async function assertCheckin(childId: string, checkinId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkins")
    .select("id")
    .eq("id", checkinId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
}

async function classSlug(childId: string, classId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("class_slug, current_unit")
    .eq("id", classId)
    .eq("child_id", childId)
    .maybeSingle();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return (data as { class_slug: string }).class_slug;
}

/** Upsert one class's debriefing for today's check-in. */
export async function saveClassDebrief(
  childId: string,
  checkinId: string,
  input: z.infer<typeof debriefSchema>
): Promise<ClassDebrief> {
  const userId = await requireChildRole(childId);
  void userId;
  await assertCheckin(childId, checkinId);
  await classSlug(childId, input.class_id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_class_details")
    .upsert(
      {
        checkin_id: checkinId,
        child_id: childId,
        class_id: input.class_id,
        covered: input.covered ?? null,
        clicked: input.clicked ?? null,
        fuzzy: input.fuzzy ?? null,
        due_next: input.due_next ?? null,
        confidence: input.confidence ?? null,
      },
      { onConflict: "checkin_id,class_id" }
    )
    .select("covered, clicked, fuzzy, due_next, confidence")
    .single();
  if (error) throw new ApiError(mapDbError(error, crypto.randomUUID()));
  const row = data as { covered: string | null; clicked: string | null; fuzzy: string | null; due_next: string | null; confidence: number | null };
  return {
    covered: row.covered,
    clicked: row.clicked,
    fuzzy: row.fuzzy,
    dueNext: row.due_next,
    confidence: row.confidence,
  };
}

/** Load a class's existing debriefing (for prefill). */
export async function getClassDebrief(
  childId: string,
  checkinId: string,
  classId: string
): Promise<ClassDebrief | null> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_class_details")
    .select("covered, clicked, fuzzy, due_next, confidence")
    .eq("checkin_id", checkinId)
    .eq("child_id", childId)
    .eq("class_id", classId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { covered: string | null; clicked: string | null; fuzzy: string | null; due_next: string | null; confidence: number | null };
  return {
    covered: row.covered,
    clicked: row.clicked,
    fuzzy: row.fuzzy,
    dueNext: row.due_next,
    confidence: row.confidence,
  };
}

/**
 * Upload a handout during the check-in flow. File lands in the
 * class-handouts bucket at <child_id>/<class_slug>/<uuid>-<name>;
 * metadata (auto unit tag = classes.current_unit) goes to checkin_uploads.
 */
export async function uploadCheckinHandout(
  childId: string,
  checkinId: string,
  classId: string,
  userId: string,
  file: File
): Promise<{ path: string; fileName: string }> {
  await requireChildRole(childId);
  await assertCheckin(childId, checkinId);
  if (file.size > MAX_UPLOAD_BYTES) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  const { data: cls, error: clsErr } = await supabase
    .from("classes")
    .select("class_slug, current_unit")
    .eq("id", classId)
    .eq("child_id", childId)
    .maybeSingle();
  if (clsErr || !cls) failWith(ErrorCodes.NOT_FOUND);
  const slug = (cls as { class_slug: string }).class_slug;
  const unitTag = (cls as { current_unit: string | null }).current_unit ?? null;

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const path = `${childId}/${slug}/${crypto.randomUUID()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabaseAdmin.storage
    .from(HANDOUTS_BUCKET)
    .upload(path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
  if (upErr) throw new ApiError(mapDbError(upErr, crypto.randomUUID()));

  const { error: metaErr } = await supabaseAdmin.from("checkin_uploads").insert({
    checkin_id: checkinId,
    child_id: childId,
    class_id: classId,
    unit_tag: unitTag,
    file_path: path,
    file_name: file.name.slice(0, 200),
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: userId,
  });
  if (metaErr) {
    // Roll back the object so storage and metadata never drift.
    await supabaseAdmin.storage.from(HANDOUTS_BUCKET).remove([path]);
    throw new ApiError(mapDbError(metaErr, crypto.randomUUID()));
  }

  return { path, fileName: file.name };
}

export interface CheckinHandout {
  id: string;
  classId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  unitTag: string | null;
  signedUrl: string;
  uploadedAt: string;
}

/** List a check-in's handouts (signed URLs, 15 min). */
export async function listCheckinHandouts(
  childId: string,
  checkinId: string
): Promise<CheckinHandout[]> {
  await requireChildRole(childId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_uploads")
    .select("id, class_id, file_path, file_name, mime_type, size_bytes, unit_tag, uploaded_at")
    .eq("checkin_id", checkinId)
    .eq("child_id", childId)
    .order("uploaded_at", { ascending: true });
  if (error) return [];

  const rows = data as Array<{
    id: string;
    class_id: string;
    file_path: string;
    file_name: string;
    mime_type: string | null;
    size_bytes: number | null;
    unit_tag: string | null;
    uploaded_at: string;
  }>;
  const out: CheckinHandout[] = [];
  for (const r of rows) {
    const { data: signed } = await supabaseAdmin.storage
      .from(HANDOUTS_BUCKET)
      .createSignedUrl(r.file_path, 900);
    out.push({
      id: r.id,
      classId: r.class_id,
      fileName: r.file_name,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      unitTag: r.unit_tag,
      signedUrl: signed?.signedUrl ?? "",
      uploadedAt: r.uploaded_at,
    });
  }
  return out;
}
