// W21 mail intelligence — OCR pipeline (spec §3.3, steps 1–7).
// v1 runs INLINE in the API route with the stub provider. When a real vision
// provider is chosen, this logic moves to supabase/functions/mail-ocr and the
// route invokes it async; the contract (steps, gates, dedupe) stays identical.
//
// Gates (checked here AND in the route — the gate is not trust-on-entry):
//   - external providers refuse without mail_items.external_ocr_consent.
//   - handwritingDetected && !provider.handlesHandwriting → handwriting_flag,
//     skip extraction, status stays 'new' for human review.
// Deterministic extraction only (extract.ts) — never the LLM's guess.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ErrorCodes, failWith } from '@/server/errors';
import { auditEvent } from '@/server/rest';
import type { HouseholdContext } from '@/server/tenant';
import {
  extractMailFields,
  extractAllAmounts,
  maskAccountNumbers,
  computeReminderTimes,
  type MailClassification,
} from './extract';
import {
  resolveOcrProvider,
  isProviderUnavailable,
  type OcrProvider,
  type OcrProviderRow,
  type OcrResult,
} from './providers';
import {
  getHouseholdMailItem,
  MAIL_ITEM_PUBLIC_COLS,
  type MailItemPublic,
} from '@/server/mail/common';

export interface OcrTriggerOptions {
  providerKey?: string;
  /** Explicit per-document opt-in to a third-party provider (flips the gate). */
  externalConsent?: boolean;
  force?: boolean;
}

interface PipelineItem {
  id: string;
  owner_user_id: string;
  photo_path: string;
  ocr_at: string | null;
  external_ocr_consent: boolean;
  sender: string | null;
  status: string;
}

async function loadPipelineItem(
  supabase: SupabaseClient,
  ctx: HouseholdContext,
  itemId: string,
): Promise<PipelineItem> {
  const item = (await getHouseholdMailItem(
    supabase,
    ctx.ownerUserId,
    itemId,
  )) as MailItemPublic;
  return {
    id: item.id,
    owner_user_id: item.owner_user_id,
    photo_path: item.photo_path,
    ocr_at: item.ocr_at,
    external_ocr_consent: item.external_ocr_consent,
    sender: item.sender,
    status: item.status,
  };
}

/** Second-notice dedupe (§3.2): same (sender, amount) + open action → escalate, don't duplicate. */
async function findDuplicateAction(
  supabase: SupabaseClient,
  ownerUserId: string,
  sender: string,
  amount: number,
): Promise<{ id: string; detail: string | null } | null> {
  const { data, error } = await supabase
    .from('mail_action_items')
    .select('id, detail, mail_items!inner(sender)')
    .eq('owner_user_id', ownerUserId)
    .in('status', ['open', 'snoozed'])
    .eq('amount', amount);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    detail: string | null;
    mail_items: { sender: string | null } | { sender: string | null }[];
  }[];
  for (const r of rows) {
    const mi = Array.isArray(r.mail_items) ? r.mail_items[0] : r.mail_items;
    if (mi?.sender && mi.sender.toLowerCase() === sender.toLowerCase()) {
      return { id: r.id, detail: r.detail };
    }
  }
  return null;
}

const ACTIONABLE: MailClassification[] = ['bill', 'legal', 'insurance'];

function actionKindFor(c: MailClassification): 'pay' | 'review' {
  return c === 'bill' ? 'pay' : 'review';
}

function actionTitleFor(c: MailClassification, sender: string | null): string {
  const who = sender ?? 'this document';
  if (c === 'bill') return `Pay ${who}`;
  if (c === 'legal') return `Review legal notice from ${who}`;
  return `Review insurance document from ${who}`;
}

export interface OcrPipelineResult {
  accepted: true;
  item: MailItemPublic;
  handwritingReview: boolean;
  actionsCreated: number;
  actionsEscalated: number;
}

/**
 * Run the §3.3 pipeline for one mail item. Returns metadata-only (no ocr_text;
 * the parent reads it through the audited detail route). Throws ApiError on
 * gate/state violations; UPSTREAM_UNAVAILABLE when no provider resolves.
 */
export async function runOcrPipeline(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  ctx: HouseholdContext,
  itemId: string,
  opts: OcrTriggerOptions = {},
): Promise<OcrPipelineResult> {
  // Step 1: load item; resolve provider (local preferred).
  const item = await loadPipelineItem(supabase, ctx, itemId);

  if (item.ocr_at && !opts.force) failWith(ErrorCodes.CONFLICT);

  // Per-document consent opt-in is recorded explicitly, never implied.
  let consented = item.external_ocr_consent;
  if (opts.externalConsent === true && !consented) {
    const { error } = await supabase
      .from('mail_items')
      .update({ external_ocr_consent: true })
      .eq('id', item.id)
      .eq('owner_user_id', ctx.ownerUserId);
    if (error) throw error;
    consented = true;
  }

  let provider: OcrProvider;
  let row: OcrProviderRow;
  try {
    ({ provider, row } = await resolveOcrProvider(supabase, opts.providerKey));
  } catch (err) {
    if (isProviderUnavailable(err)) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
    throw err;
  }

  // Step 1 (gate, re-checked): external providers need explicit consent.
  if (provider.isExternal && !consented) failWith(ErrorCodes.CONSENT_REQUIRED);

  // Step 2: fetch photo bytes (service_role: private bucket, server-side only).
  const { data: blob, error: dlError } = await admin.storage
    .from('mail-photos')
    .download(item.photo_path);
  if (dlError || !blob) failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  const bytes = new Uint8Array(await (blob as Blob).arrayBuffer());

  let result: OcrResult;
  try {
    result = await provider.ocr(bytes);
  } catch {
    failWith(ErrorCodes.UPSTREAM_UNAVAILABLE);
  }

  const nowIso = new Date().toISOString();
  // Extract-then-mask (NFR-PRIVACY-009): the extractor sees the raw text;
  // what PERSISTS to ocr_text is masked (digit runs ≥8 → ****last4).
  const maskedText = maskAccountNumbers(result.text);
  const baseUpdate = {
    ocr_text: maskedText,
    ocr_confidence: Math.min(1, Math.max(0, result.confidence)),
    ocr_provider: row.provider_key,
    ocr_at: nowIso,
  };

  // Step 4: handwriting short-circuit — never extract dates from handwriting alone.
  if (result.handwritingDetected && !provider.handlesHandwriting) {
    const { data, error } = await supabase
      .from('mail_items')
      .update({ ...baseUpdate, handwriting_flag: true })
      .eq('id', item.id)
      .eq('owner_user_id', ctx.ownerUserId)
      .select(MAIL_ITEM_PUBLIC_COLS)
      .single();
    if (error) throw error;
    await auditEvent(ctx.anchorChildId, 'mail_item.ocr_completed', {
      item_id: item.id,
      provider: row.provider_key,
      handwriting_review: true,
    });
    return {
      accepted: true,
      item: data as MailItemPublic,
      handwritingReview: true,
      actionsCreated: 0,
      actionsEscalated: 0,
    };
  }

  // Step 3: deterministic extraction (skipped for confidence-0 stub readings).
  // Extraction runs on the RAW text (the extractor needs the real digits);
  // only the persisted ocr_text is masked.
  const fields = extractMailFields(result.text, result.confidence);
  const allAmounts = extractAllAmounts(result.text);
  const allDueDates = fields.dueDate ? [fields.dueDate] : [];
  const { error: upError } = await supabase
    .from('mail_items')
    .update({
      ...baseUpdate,
      // Clear a stale flag on force re-runs: this reading was extractable.
      handwriting_flag: false,
      classification: fields.classification,
      classification_confidence: fields.classificationConfidence,
      amount: fields.amount,
      account_last4: fields.accountLast4,
      due_date: fields.dueDate,
      extracted_amounts: allAmounts,
      extracted_due_dates: allDueDates,
      // Never overwrite a parent-provided sender with the heuristic.
      ...(item.sender ? {} : { sender: fields.sender }),
    })
    .eq('id', item.id)
    .eq('owner_user_id', ctx.ownerUserId);
  if (upError) throw upError;

  // Step 6: create action items for bills/legal/insurance (dedupe 2nd notices).
  let actionsCreated = 0;
  let actionsEscalated = 0;
  const sender = item.sender ?? fields.sender;
  if (ACTIONABLE.includes(fields.classification)) {
    const kind = actionKindFor(fields.classification);
    let reminderAt: string | null = null;
    let detail: string | null =
      fields.classification === 'bill'
        ? 'Extracted from the scanned bill. Verify the amount against the photo before paying.'
        : 'Extracted from the scanned document. Review the photo before acting.';
    if (fields.dueDate) {
      const { sevenDay, twoDay } = computeReminderTimes(fields.dueDate);
      reminderAt = sevenDay;
      detail += ` Follow-up reminder scheduled for ${twoDay.slice(0, 10)}.`;
    }

    const duplicate =
      sender && fields.amount != null
        ? await findDuplicateAction(supabase, ctx.ownerUserId, sender, fields.amount)
        : null;

    if (duplicate) {
      // Second notice for the same bill: escalate the existing action.
      const escalatedDetail = `${duplicate.detail ?? ''}\nSecond notice received ${new Date().toISOString().slice(0, 10)} — escalated.`.trim();
      const { error } = await supabase
        .from('mail_action_items')
        .update({
          detail: escalatedDetail,
          ...(reminderAt
            ? { reminder_at: computeReminderTimes(fields.dueDate!).twoDay }
            : {}),
        })
        .eq('id', duplicate.id)
        .eq('owner_user_id', ctx.ownerUserId);
      if (error) throw error;
      actionsEscalated = 1;
    } else {
      const { error } = await supabase.from('mail_action_items').insert({
        mail_item_id: item.id,
        owner_user_id: ctx.ownerUserId,
        kind,
        title: actionTitleFor(fields.classification, sender),
        detail,
        amount: fields.amount,
        due_date: fields.dueDate,
        reminder_at: reminderAt,
        data_class: 'S',
      });
      if (error) throw error;
      actionsCreated = 1;
    }
  }

  const { data: updated, error: selError } = await supabase
    .from('mail_items')
    .select(MAIL_ITEM_PUBLIC_COLS)
    .eq('id', item.id)
    .eq('owner_user_id', ctx.ownerUserId)
    .single();
  if (selError) throw selError;

  // Persist the action-item extraction array (ids only in the array payload —
  // no amounts, fragments, or OCR text beyond what the columns already hold).
  const extractedActionItems = ACTIONABLE.includes(fields.classification)
    ? [
        {
          kind: actionKindFor(fields.classification),
          title: actionTitleFor(fields.classification, sender),
          created: actionsCreated === 1,
          escalated: actionsEscalated === 1,
        },
      ]
    : [];
  await supabase
    .from('mail_items')
    .update({ extracted_action_items: extractedActionItems })
    .eq('id', item.id)
    .eq('owner_user_id', ctx.ownerUserId);

  // Step 7: audit (ids only — never amounts, fragments, or OCR text).
  await auditEvent(ctx.anchorChildId, 'mail_item.ocr_completed', {
    item_id: item.id,
    provider: row.provider_key,
    classification: fields.classification,
  });

  return {
    accepted: true,
    item: updated as MailItemPublic,
    handwritingReview: false,
    actionsCreated,
    actionsEscalated,
  };
}
