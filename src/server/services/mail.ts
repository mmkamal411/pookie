// W21 mail intake — upload + listing. The OCR pipeline lives in
// src/server/ocr/pipeline.ts (extract-then-mask enforced there: raw text is
// extracted, then digit runs ≥8 are masked to ****last4 before ocr_text is
// persisted — NFR-PRIVACY-009).
//
// Upload path: the route streams the photo to the private 'mail-photos'
// bucket via the service_role client (storage policies are defense-in-depth),
// creates the mail_items row through the user-JWT client (RLS: parent-only),
// and stamps auto_delete_at (raw images auto-delete ≤ 30 days via
// purge_expired_mail_photos()).
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ErrorCodes, failWith } from '@/server/errors';
import type { HouseholdContext } from '@/server/tenant';
import {
  MAIL_ITEM_PUBLIC_COLS,
  type MailClassification,
  type MailItemPublic,
  type MailItemStatus,
} from '@/server/mail/common';

type Db = Awaited<ReturnType<typeof createClient>>;

const MAX_PHOTO_BYTES = 12 * 1024 * 1024; // 12 MB

export interface IntakeInput {
  bytes: Uint8Array;
  contentType: string;
  sender?: string;
  relatedChildId?: string;
}

/** Upload a mail photo and create the mail item. Returns the metadata row (no OCR text). */
export async function intakeMailPhoto(
  supabase: Db,
  ctx: HouseholdContext,
  input: IntakeInput,
): Promise<MailItemPublic> {
  if (input.bytes.length === 0 || input.bytes.length > MAX_PHOTO_BYTES) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(input.contentType)) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const ext = input.contentType.split('/')[1] ?? 'jpg';
  const itemId = crypto.randomUUID();
  const day = new Date().toISOString().slice(0, 10);
  const photoPath = `${ctx.ownerUserId}/mail/${day}/${itemId}.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('mail-photos')
    .upload(photoPath, input.bytes, { contentType: input.contentType, upsert: false });
  if (uploadError) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);

  const { data, error } = await supabase
    .from('mail_items')
    .insert({
      id: itemId,
      owner_user_id: ctx.ownerUserId,
      related_child_id: input.relatedChildId ?? null,
      photo_path: photoPath,
      sender: input.sender ?? null,
      status: 'new',
      data_class: 'S',
      // auto_delete_at defaults to now() + 30 days (migration 024).
    })
    .select(MAIL_ITEM_PUBLIC_COLS)
    .single();
  if (error || !data) {
    // Roll back the orphaned photo — intake must not leave unattached images.
    await supabaseAdmin.storage.from('mail-photos').remove([photoPath]);
    failWith(ErrorCodes.INTERNAL);
  }
  return data as MailItemPublic;
}

/** List mail items (metadata only — ocr_text is never in list payloads). */
export async function listMailItems(
  supabase: Db,
  ownerUserId: string,
  filters: { status?: MailItemStatus; classification?: MailClassification; limit?: number },
): Promise<MailItemPublic[]> {
  let query = supabase
    .from('mail_items')
    .select(MAIL_ITEM_PUBLIC_COLS)
    .eq('owner_user_id', ownerUserId)
    .order('received_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.classification) query = query.eq('classification', filters.classification);
  const { data, error } = await query.limit(filters.limit ?? 100);
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data ?? []) as MailItemPublic[];
}

/** Mark an item triaged/actioned/dismissed (no client DELETE — ledger-like). */
export async function setMailItemStatus(
  supabase: Db,
  ownerUserId: string,
  itemId: string,
  status: MailItemStatus,
): Promise<MailItemPublic> {
  const { data, error } = await supabase
    .from('mail_items')
    .update({ status })
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .select(MAIL_ITEM_PUBLIC_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return data as MailItemPublic;
}
