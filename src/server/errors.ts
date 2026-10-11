// Canonical error-code registry. Codes are stable API — add, never rename.
// Raw Postgres messages are NEVER returned to clients; map them here.
import { TRPCError } from '@trpc/server';

export const ErrorCodes = {
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_EMAIL_MISMATCH: 'INVITE_EMAIL_MISMATCH',
  PARENT_ROLE_REQUIRED: 'PARENT_ROLE_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const HUMAN_MESSAGES: Record<ErrorCode, string> = {
  TENANT_SCOPE_VIOLATION: "You don't have access to this child's data.",
  INVITE_NOT_FOUND: 'This invite is invalid or has expired.',
  INVITE_EMAIL_MISMATCH: 'This invite was sent to a different email address.',
  PARENT_ROLE_REQUIRED: 'This action requires a parent account.',
  VALIDATION_FAILED: 'The request was invalid.',
  NOT_FOUND: 'Not found.',
  CONFLICT: 'This already exists.',
  RATE_LIMITED: 'Too many requests. Please try again shortly.',
  UPSTREAM_UNAVAILABLE: 'A downstream service is unavailable. Please try again.',
  INTERNAL: 'Something went wrong. Please try again.',
};

const HTTP_STATUS: Record<ErrorCode, number> = {
  TENANT_SCOPE_VIOLATION: 403, // never 404 — do not confirm/deny tenant existence
  INVITE_NOT_FOUND: 401,
  INVITE_EMAIL_MISMATCH: 401,
  PARENT_ROLE_REQUIRED: 403,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL: 500,
};

/** Map a Postgres / RPC exception to a canonical code. Logs the raw detail. */
export function mapDbError(err: unknown, requestId: string): ErrorCode {
  const message = err instanceof Error ? err.message : String(err);
  // Log raw detail server-side with request correlation (never to client).
  console.error(`[${requestId}] db error:`, message);
  if (message.includes('invite_not_found_or_expired')) return ErrorCodes.INVITE_NOT_FOUND;
  if (message.includes('invite_email_mismatch')) return ErrorCodes.INVITE_EMAIL_MISMATCH;
  if (message.includes('tenant_membership_required')) return ErrorCodes.TENANT_SCOPE_VIOLATION;
  if (message.includes('parent_membership_required')) return ErrorCodes.PARENT_ROLE_REQUIRED;
  if (message.includes('agent_scope_violation')) return ErrorCodes.TENANT_SCOPE_VIOLATION;
  if (/duplicate key|unique constraint/i.test(message)) return ErrorCodes.CONFLICT;
  return ErrorCodes.INTERNAL;
}

export function toApiError(code: ErrorCode, requestId: string, details?: Record<string, unknown>) {
  return {
    ok: false as const,
    error: {
      code,
      message: HUMAN_MESSAGES[code],
      ...(details ? { details } : {}),
      requestId,
    },
  };
}

export function httpStatusFor(code: ErrorCode): number {
  return HTTP_STATUS[code];
}

/** Throw a tRPC error carrying a canonical code (client adapter normalizes to the envelope). */
export function trpcError(code: ErrorCode, trpcCode: 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT' | 'TOO_MANY_REQUESTS' | 'INTERNAL_SERVER_ERROR' = 'INTERNAL_SERVER_ERROR'): never {
  throw new TRPCError({ code: trpcCode, message: code });
}
