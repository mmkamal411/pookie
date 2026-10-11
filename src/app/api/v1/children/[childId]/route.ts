// Versioned REST surface — machine clients (Python workers, crons) and any
// future third-party integration. Membership asserted via assertTenant before
// any query. Canonical error envelope: { ok, data } / { ok:false, error:{code,message,requestId} }.
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { TRPCError } from '@trpc/server';
import { assertTenant } from '@/server/tenant';
import { toApiError, ErrorCodes, httpStatusFor, type ErrorCode } from '@/server/errors';
import { getChild } from '@/server/services/children';

const KNOWN_CODES = new Set<string>(Object.values(ErrorCodes));

function toErrorCode(err: unknown): ErrorCode {
  if (err instanceof TRPCError && KNOWN_CODES.has(err.message)) {
    return err.message as ErrorCode; // assertTenant throws with the canonical code as message
  }
  return ErrorCodes.INTERNAL; // raw detail stays server-side
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ childId: string }> },
) {
  const requestId = randomUUID();
  try {
    const { childId } = await params;
    await assertTenant(childId);
    const child = await getChild(childId);
    if (!child) {
      return NextResponse.json(toApiError(ErrorCodes.NOT_FOUND, requestId), {
        status: httpStatusFor(ErrorCodes.NOT_FOUND),
      });
    }
    return NextResponse.json({ ok: true, data: child });
  } catch (err) {
    const code = toErrorCode(err);
    return NextResponse.json(toApiError(code, requestId), { status: httpStatusFor(code) });
  }
}
