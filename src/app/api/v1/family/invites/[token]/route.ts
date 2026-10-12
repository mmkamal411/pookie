// GET /api/v1/family/invites/[token] — PUBLIC invite preview.
// Zero child PII before authentication (FR-AUTH-009): returns only the
// inviter's display name + expiry. Invalid/expired/used tokens all return the
// same "invalid or expired" response — no enumeration oracle.
import { NextResponse } from "next/server";
import { previewFamilyInvite } from "@/server/services/family-links";
import { ApiError, ErrorCodes, toApiError, httpStatusFor } from "@/server/errors";

export async function GET(
  _req: Request,
  routeCtx: { params: Promise<{ token: string }> },
) {
  const requestId = crypto.randomUUID();
  try {
    // Public route: use the anon client — no auth gate, no child PII.
    const { token } = await routeCtx.params;
    const preview = await previewFamilyInvite(token);
    return NextResponse.json({ ok: true, data: preview });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json(toApiError(err.code, requestId), {
        status: httpStatusFor(err.code),
      });
    }
    return NextResponse.json(toApiError(ErrorCodes.INTERNAL, requestId), {
      status: httpStatusFor(ErrorCodes.INTERNAL),
    });
  }
}
