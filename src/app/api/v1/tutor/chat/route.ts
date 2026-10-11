// POST /api/v1/tutor/chat — tenant-scoped proxy to the pookie-tutor-v2 worker.
// Keeps the worker URL and CORS config out of the client bundle; the worker
// receives child_id so prompts are parameterized from the children row,
// never from client text. Full chat UI comes later; this is the secure pipe.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { assertTenant } from '@/server/tenant';
import { toApiError, ErrorCodes, httpStatusFor } from '@/server/errors';

const KNOWN_CODES = new Set<string>(Object.values(ErrorCodes));

const chatSchema = z.object({
  childId: z.string().uuid(),
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(50),
});

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const body = chatSchema.parse(await req.json());
    const { childId } = await assertTenant(body.childId);

    const tutorUrl = process.env.POOKIE_TUTOR_URL;
    if (!tutorUrl) {
      return NextResponse.json(toApiError(ErrorCodes.UPSTREAM_UNAVAILABLE, requestId), {
        status: httpStatusFor(ErrorCodes.UPSTREAM_UNAVAILABLE),
      });
    }

    const upstream = await fetch(`${tutorUrl}/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': requestId },
      body: JSON.stringify({ child_id: childId, messages: body.messages }),
    });
    if (!upstream.ok) {
      return NextResponse.json(toApiError(ErrorCodes.UPSTREAM_UNAVAILABLE, requestId), {
        status: httpStatusFor(ErrorCodes.UPSTREAM_UNAVAILABLE),
      });
    }
    const data = await upstream.json();
    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        toApiError(ErrorCodes.VALIDATION_FAILED, requestId, {
          issues: err.issues.map((i) => i.path.join('.')),
        }),
        { status: httpStatusFor(ErrorCodes.VALIDATION_FAILED) },
      );
    }
    const code =
      err instanceof TRPCError && KNOWN_CODES.has(err.message)
        ? (err.message as (typeof ErrorCodes)[keyof typeof ErrorCodes])
        : ErrorCodes.INTERNAL;
    return NextResponse.json(toApiError(code, requestId), { status: httpStatusFor(code) });
  }
}
