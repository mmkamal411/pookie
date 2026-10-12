// W21 mail intelligence — shared server helpers for the /api/v1/household/mail
// routes. Class-S handling, enforced here:
//   - MAIL_ITEM_PUBLIC_COLS never includes ocr_text (§3.1.8: no OCR text in
//     list payloads). The audited detail route alone uses DETAIL_COLS.
//   - Every loader scopes by (id, owner_user_id); RLS (is_household_parent)
//     is the authorization layer, the explicit owner_user_id predicate is
//     belt-and-suspenders. Absent rows → NOT_FOUND (404 is safe: existence
//     is already scoped to the caller's household).
//   - Audit detail hygiene: routes pass ids only — never amounts, account
//     fragments, or OCR text (see SECURITY checklist item 9).
import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorCodes, failWith } from '@/server/errors';

/** Metadata only — §3.1.8. ocr_text is deliberately absent. */
export const MAIL_ITEM_PUBLIC_COLS =
  'id,owner_user_id,related_child_id,photo_path,ocr_confidence,ocr_provider,ocr_at,handwriting_flag,external_ocr_consent,classification,classification_confidence,amount,account_last4,due_date,sender,received_date,status,data_class,retention_class,auto_delete_at,photo_purged_at,created_at';

/** Detail columns — ocr_text included. Audited read only. */
export const MAIL_ITEM_DETAIL_COLS = `${MAIL_ITEM_PUBLIC_COLS},ocr_text`;

export const MAIL_ACTION_COLS =
  'id,mail_item_id,owner_user_id,kind,title,detail,amount,due_date,status,reminder_at,reminder_sent,resolved_at,resolution_note,ledger_entry_id,data_class,created_at';

export const MAIL_DISPUTE_COLS =
  'id,mail_item_id,owner_user_id,draft_text,status,approved_text,approved_by,approved_at,sent_at,data_class,created_at';

export type MailClassification =
  | 'bill'
  | 'tax'
  | 'legal'
  | 'insurance'
  | 'medical'
  | 'other'
  | 'junk';

export type MailItemStatus = 'new' | 'triaged' | 'actioned' | 'dismissed';

export interface MailItemPublic {
  id: string;
  owner_user_id: string;
  related_child_id: string | null;
  photo_path: string;
  ocr_confidence: number | string | null;
  ocr_provider: string | null;
  ocr_at: string | null;
  handwriting_flag: boolean;
  external_ocr_consent: boolean;
  classification: MailClassification;
  classification_confidence: number | string | null;
  amount: number | string | null;
  account_last4: string | null;
  due_date: string | null;
  sender: string | null;
  received_date: string;
  status: MailItemStatus;
  data_class: string;
  retention_class: string;
  /** Raw-photo purge deadline (≤30d from intake) — drives the retention UI. */
  auto_delete_at: string | null;
  /** Set when the raw photo was purged (auto or "Delete now"). */
  photo_purged_at: string | null;
  created_at: string;
}

export interface MailItemDetail extends MailItemPublic {
  ocr_text: string | null;
}

export type MailActionKind = 'pay' | 'file' | 'dispute' | 'schedule' | 'review' | 'other';
export type MailActionStatus = 'open' | 'snoozed' | 'done' | 'cancelled';

export interface MailActionItem {
  id: string;
  mail_item_id: string;
  owner_user_id: string;
  kind: MailActionKind;
  title: string;
  detail: string | null;
  amount: number | string | null;
  due_date: string | null;
  status: MailActionStatus;
  reminder_at: string | null;
  reminder_sent: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  ledger_entry_id: string | null;
  data_class: string;
  created_at: string;
}

export type MailDisputeStatus = 'draft' | 'approved' | 'sent' | 'abandoned';

export interface MailDisputeDraft {
  id: string;
  mail_item_id: string;
  owner_user_id: string;
  draft_text: string;
  status: MailDisputeStatus;
  approved_text: string | null;
  approved_by: string | null;
  approved_at: string | null;
  sent_at: string | null;
  data_class: string;
  created_at: string;
}

/**
 * Load one mail item scoped to the caller's household.
 * Throws NOT_FOUND (404) when absent — safe: existence is already scoped.
 */
export async function getHouseholdMailItem(
  supabase: SupabaseClient,
  ownerUserId: string,
  itemId: string,
  withOcr = false,
): Promise<MailItemPublic | MailItemDetail> {
  const { data, error } = await supabase
    .from('mail_items')
    .select(withOcr ? MAIL_ITEM_DETAIL_COLS : MAIL_ITEM_PUBLIC_COLS)
    .eq('id', itemId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return data as unknown as MailItemPublic | MailItemDetail;
}

/** Load one action item scoped to the caller's household (404 when absent). */
export async function getHouseholdMailAction(
  supabase: SupabaseClient,
  ownerUserId: string,
  actionId: string,
): Promise<MailActionItem> {
  const { data, error } = await supabase
    .from('mail_action_items')
    .select(MAIL_ACTION_COLS)
    .eq('id', actionId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return data as MailActionItem;
}

/** Load one dispute draft scoped to the caller's household (404 when absent). */
export async function getHouseholdDispute(
  supabase: SupabaseClient,
  ownerUserId: string,
  disputeId: string,
): Promise<MailDisputeDraft> {
  const { data, error } = await supabase
    .from('mail_dispute_drafts')
    .select(MAIL_DISPUTE_COLS)
    .eq('id', disputeId)
    .eq('owner_user_id', ownerUserId)
    .maybeSingle();
  if (error) throw error;
  if (!data) failWith(ErrorCodes.NOT_FOUND);
  return data as MailDisputeDraft;
}
