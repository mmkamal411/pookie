// POST /api/v1/tutor/chat — tenant-scoped proxy to the pookie-tutor-v2 worker.
// Keeps the worker URL and CORS config out of the client bundle; the worker
// receives child_id so prompts are parameterized from the children row,
// never from client text. Full chat UI comes later; this is the secure pipe.
import { z } from 'zod';
import { handleRoute, auditEvent } from '@/server/rest';
import { assertTenant } from '@/server/tenant';
import { ApiError, ErrorCodes } from '@/server/errors';

const chatSchema = z.object({
  childId: z.string().uuid(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(50),
});

export const POST = handleRoute(async (ctx, req) => {
  const body = chatSchema.parse(await req.json());
  const { childId } = await assertTenant(body.childId);

  const tutorUrl = process.env.POOKIE_TUTOR_URL;
  if (!tutorUrl) throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);

  const upstream = await fetch(`${tutorUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-request-id': ctx.requestId },
    body: JSON.stringify({ child_id: childId, messages: body.messages }),
  });
  if (!upstream.ok) throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);

  const data = await upstream.json();
  await auditEvent(childId, 'tutor_chat');
  return data;
});
