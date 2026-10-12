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

export interface ManualMailInput {
  sender?: string;
  amount?: number;
  due_date?: string;
}

/** Manual mail intake — typed by hand, no photo. The fully-working primary
 *  path when the camera or OCR can't do the job. No raw photo exists, so the
 *  30-day photo countdown never starts; extracted metadata is filed directly. */
export async function intakeMailManual(
  supabase: Db,
  ctx: HouseholdContext,
  input: ManualMailInput,
): Promise<MailItemPublic> {
  if (!input.sender && input.amount == null && !input.due_date) {
    failWith(ErrorCodes.VALIDATION_FAILED);
  }
  const { data, error } = await supabase
    .from('mail_items')
    .insert({
      owner_user_id: ctx.ownerUserId,
      photo_path: '',
      sender: input.sender?.trim() || null,
      amount: input.amount ?? null,
      due_date: input.due_date ?? null,
      classification: 'bill',
      status: 'new',
      data_class: 'S',
    })
    .select(MAIL_ITEM_PUBLIC_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
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

/** Update an item: status and/or confirm-screen corrections (sender, amount,
 *  due_date). No client DELETE — ledger-like. The account field is locked by
 *  design: account_last4 is written by the OCR pipeline only. */
export async function updateMailItem(
  supabase: Db,
  ownerUserId: string,
  itemId: string,
  input: {
    status?: MailItemStatus;
    sender?: string | null;
    amount?: number | null;
    due_date?: string | null;
  },
): Promise<MailItemPublic> {
  const patch: Record<string, unknown> = {};
  if (input.status) patch.status = input.status;
  if (input.sender !== undefined) patch.sender = input.sender?.trim() || null;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.due_date !== undefined) patch.due_date = input.due_date;
  if (Object.keys(patch).length === 0) failWith(ErrorCodes.VALIDATION_FAILED);
  const { data, error } = await supabase
    .from('mail_items')
    .update(patch)
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .select(MAIL_ITEM_PUBLIC_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return data as MailItemPublic;
}

/** Mark an item triaged/actioned/dismissed (no client DELETE — ledger-like). */
export async function setMailItemStatus(
  supabase: Db,
  ownerUserId: string,
  itemId: string,
  status: MailItemStatus,
): Promise<MailItemPublic> {
  return updateMailItem(supabase, ownerUserId, itemId, { status });
}

/**
 * Delete the raw photo NOW (user-initiated disposal). The object is removed
 * from the private mail-photos bucket and the row is marked purged; the
 * extracted metadata (sender, amount, due date — all masked) stays in the
 * file. Parent-only, audited by the route.
 */
export async function deleteMailPhotoNow(
  supabase: Db,
  ownerUserId: string,
  itemId: string,
): Promise<MailItemPublic> {
  const { data: row, error: loadError } = await supabase
    .from('mail_items')
    .select('id, photo_path')
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (loadError || !row) failWith(ErrorCodes.NOT_FOUND);
  const path = (row as { photo_path: string | null }).photo_path;
  if (path) {
    const { error: storageError } = await supabaseAdmin.storage
      .from('mail-photos')
      .remove([path]);
    if (storageError) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }
  const { data, error } = await supabase
    .from('mail_items')
    .update({ photo_path: '', photo_purged_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .select(MAIL_ITEM_PUBLIC_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return data as MailItemPublic;
}
