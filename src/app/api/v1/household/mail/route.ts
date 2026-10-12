// GET /api/v1/household/mail — list mail items (metadata only; ocr_text is
// never in list payloads — §3.1.8).
// POST — intake a mail photo (multipart/form-data: photo, sender?, related_child_id?).
// Uploads to the private 'mail-photos' bucket and creates the mail_items row;
// raw images auto-delete ≤ 30 days via purge_expired_mail_photos().
// Parent-only (Class S).
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertHousehold } from '@/server/tenant';
import { ErrorCodes, failWith } from '@/server/errors';
import { createClient } from '@/lib/supabase/server';
import { intakeMailPhoto, listMailItems } from '@/server/services/mail';

const listSchema = z.object({
  status: z.enum(['new', 'triaged', 'actioned', 'dismissed']).optional(),
  classification: z
    .enum(['bill', 'tax', 'legal', 'insurance', 'medical', 'other', 'junk'])
    .optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export const GET = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const params = listSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const supabase = await createClient();
  const items = await listMailItems(supabase, household.ownerUserId, params);
  await auditEvent(household.anchorChildId, 'mail_items.viewed', {
    count: items.length,
  });
  return { items };
});

export const POST = handleRoute(async (ctx, req) => {
  const household = await assertHousehold();
  if (household.role !== 'parent') failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
  const form = await req.formData();
  const photo = form.get('photo');
  if (!(photo instanceof File)) failWith(ErrorCodes.VALIDATION_FAILED);
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const sender = form.get('sender');
  const relatedChildId = form.get('related_child_id');
  const supabase = await createClient();
  const item = await intakeMailPhoto(supabase, household, {
    bytes,
    contentType: photo.type || 'image/jpeg',
    sender: typeof sender === 'string' && sender ? sender : undefined,
    relatedChildId:
      typeof relatedChildId === 'string' && relatedChildId ? relatedChildId : undefined,
  });
  await auditEvent(household.anchorChildId, 'mail_item.intake', {
    item_id: item.id,
  });
  return { item };
});
