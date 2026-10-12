// POST /api/v1/tutor/chat — tenant-scoped proxy to the pookie-tutor-v2 worker.
// Keeps the worker URL and CORS config out of the client bundle; the worker
// receives child_id so prompts are parameterized from the children row,
// never from client text. Full chat UI comes later; this is the secure pipe.
//
// SEC-004 (2026-10-12): the route goes through the scope choke point
// (apiHandler). The worker is told the caller's resolved scopes + whether the
// caller is the teen, under this contract: the worker's prompt builder MUST
// strip out-of-scope (teen-private: reflection/wellness) context before
// generating, so a parent-initiated chat can never surface teen-private
// content. Structured worker payloads tagged with _scope are additionally
// post-filtered server-side by apiHandler before serialization.
// FOLLOW-UP (worker owner): attest which data sources the prompt builder
// touches; free-text redaction is the worker's contractual responsibility
// (worker code is not in this repo).
import { z } from 'zod';
import { apiHandler } from '@/lib/api';
import { assertTenant } from '@/server/tenant';
import { ApiError, ErrorCodes } from '@/server/errors';
import { auditEvent } from '@/server/rest';

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

export const POST = apiHandler(
  {
    // childId lives in the JSON body: read via a clone so the handler can
    // still parse the body itself.
    childId: async (_ctx, req) => {
      try {
        const body = (await req.clone().json()) as { childId?: unknown };
        return typeof body.childId === 'string' ? body.childId : null;
      } catch {
        return null;
      }
    },
  },
  async (ctx, req) => {
    const body = chatSchema.parse(await req.json());
    const { childId } = await assertTenant(body.childId);

    const tutorUrl = process.env.POOKIE_TUTOR_URL;
    if (!tutorUrl) throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);

    const upstream = await fetch(`${tutorUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': ctx.requestId },
      body: JSON.stringify({
        child_id: childId,
        messages: body.messages,
        // SEC-004 contract: the worker strips out-of-scope context.
        viewer_scopes: ctx.scopes?.scopes ?? ['safety_comms'],
        viewer_is_teen: ctx.scopes?.isTeen ?? false,
      }),
    });
    if (!upstream.ok) throw new ApiError(ErrorCodes.UPSTREAM_UNAVAILABLE);

    const data = await upstream.json();
    await auditEvent(childId, 'tutor_chat');
    return data;
  },
);
