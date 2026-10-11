// Shared REST route wrapper. Every /api/v1/* route goes through handleRoute:
//   - generates a requestId for correlation
//   - requires an authenticated session (403 otherwise — never confirm/deny)
//   - maps ApiError → canonical envelope { ok:false, error:{code,message,requestId} }
//   - maps ZodError → VALIDATION_FAILED (400)
//   - maps anything else → INTERNAL (500); raw detail stays server-side
//
// Per ADR-004 §2: routes implement resolve → assert → use → audit. The wrapper
// covers auth; each route resolves + asserts child_id (via assertTenant) and
// audits via auditEvent().
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  ApiError,
  ErrorCodes,
  httpStatusFor,
  toApiError,
  type ErrorCode,
} from './errors';

export interface RouteContext {
  requestId: string;
  userId: string;
}

type Params = Record<string, string | string[]>;

export function handleRoute<P extends Params = Params>(
  handler: (
    ctx: RouteContext & { params: P },
    req: NextRequest,
  ) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx?: { params: Promise<P> }) => {
    const requestId = crypto.randomUUID();
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        return NextResponse.json(
          toApiError(ErrorCodes.TENANT_SCOPE_VIOLATION, requestId),
          { status: httpStatusFor(ErrorCodes.TENANT_SCOPE_VIOLATION) },
        );
      }
      const params = ((await routeCtx?.params) ?? {}) as P;
      const data = await handler({ requestId, userId: user.id, params }, req);
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
      const code: ErrorCode =
        err instanceof ApiError ? err.code : ErrorCodes.INTERNAL;
      if (code === ErrorCodes.INTERNAL) {
        console.error(`[${requestId}] unhandled route error:`, err);
      }
      return NextResponse.json(toApiError(code, requestId), {
        status: httpStatusFor(code),
      });
    }
  };
}

/**
 * Best-effort audit via the audit_event() RPC (membership-checked server-side).
 * Never throws — audit failure must not break the primary operation.
 */
export async function auditEvent(
  childId: string,
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc('audit_event', {
      p_child_id: childId,
      p_action: action,
      p_detail: (detail ?? {}) as never,
    });
    if (error) console.error(`[audit] ${action} failed:`, error.message);
  } catch (err) {
    console.error(`[audit] ${action} threw:`, err);
  }
}
