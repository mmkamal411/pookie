// Canonical error-code registry. Codes are stable API — add, never rename.
// Raw Postgres messages are NEVER returned to clients; map them here.

export const ErrorCodes = {
  TENANT_SCOPE_VIOLATION: 'TENANT_SCOPE_VIOLATION',
  INVITE_NOT_FOUND: 'INVITE_NOT_FOUND',
  INVITE_EMAIL_MISMATCH: 'INVITE_EMAIL_MISMATCH',
  PARENT_ROLE_REQUIRED: 'PARENT_ROLE_REQUIRED',
  CHILD_ROLE_REQUIRED: 'CHILD_ROLE_REQUIRED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  INTERNAL: 'INTERNAL',
  // Health track (FR-HEALTH). Codes are stable API — add, never rename.
  HEALTH_H0_REFUSED: 'HEALTH_H0_REFUSED',
  HEALTH_MINOR_CALORIE_REFUSED: 'HEALTH_MINOR_CALORIE_REFUSED',
  HEALTH_MINOR_SYNC_REFUSED: 'HEALTH_MINOR_SYNC_REFUSED',
  HEALTH_TEEN_ONLY: 'HEALTH_TEEN_ONLY',
  HEALTH_GATE_REQUIRED: 'HEALTH_GATE_REQUIRED',
  // Access / support track (FR-ACCESS, FR-SUPPORT, MD D4). Add, never rename.
  SCOPE_FORBIDDEN: 'SCOPE_FORBIDDEN',
  AGENT_ACCESS_REQUIRED: 'AGENT_ACCESS_REQUIRED',
  GRANT_SCOPE_NOT_ALLOWED: 'GRANT_SCOPE_NOT_ALLOWED',
  GRANT_NOT_ACTIVE: 'GRANT_NOT_ACTIVE',
  CREDIT_APPROVAL_REQUIRED: 'CREDIT_APPROVAL_REQUIRED',
  CREDIT_AMOUNT_INVALID: 'CREDIT_AMOUNT_INVALID',
  TICKET_TRANSITION_INVALID: 'TICKET_TRANSITION_INVALID',
  // School track — second-parent linking (FR-AUTH-011, D5 open signup).
  LINKING_DISABLED: 'LINKING_DISABLED',
  CANNOT_INVITE_SELF: 'CANNOT_INVITE_SELF',
  // AI track — Direct Mode 18+ gate (FR-AI-002).
  DIRECT_MODE_18_ONLY: 'DIRECT_MODE_18_ONLY',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const HUMAN_MESSAGES: Record<ErrorCode, string> = {
  TENANT_SCOPE_VIOLATION: "You don't have access to this child's data.",
  INVITE_NOT_FOUND: 'This invite is invalid or has expired.',
  INVITE_EMAIL_MISMATCH: 'This invite was sent to a different email address.',
  PARENT_ROLE_REQUIRED: 'This action requires a parent account.',
  CHILD_ROLE_REQUIRED: 'This is only available to the student.',
  VALIDATION_FAILED: 'The request was invalid.',
  NOT_FOUND: 'Not found.',
  CONFLICT: 'This already exists.',
  CONSENT_REQUIRED: 'Explicit consent is required before using this service.',
  RATE_LIMITED: 'Too many requests. Please try again shortly.',
  UPSTREAM_UNAVAILABLE: 'A downstream service is unavailable. Please try again.',
  INTERNAL: 'Something went wrong. Please try again.',
  HEALTH_H0_REFUSED:
    'This type of health data is not collected for anyone under 18.',
  HEALTH_MINOR_CALORIE_REFUSED:
    'Calorie tracking is not available for anyone under 18.',
  HEALTH_MINOR_SYNC_REFUSED:
    'Device sync is not available for children under 13.',
  HEALTH_TEEN_ONLY: 'This health record is private to the teen.',
  HEALTH_GATE_REQUIRED:
    'This target needs a verified clinician order before it can be created.',
  SCOPE_FORBIDDEN: "You don't have access to this child's data in this area.",
  AGENT_ACCESS_REQUIRED: 'This action requires an active support-agent account.',
  GRANT_SCOPE_NOT_ALLOWED:
    'Support agents can never be granted access to health, wellbeing, mood, or check-in data.',
  GRANT_NOT_ACTIVE: 'This data-access grant is no longer active.',
  CREDIT_APPROVAL_REQUIRED:
    'Credits above $50 need Managing Director approval first.',
  CREDIT_AMOUNT_INVALID: 'The credit amount is invalid.',
  TICKET_TRANSITION_INVALID: 'This ticket cannot move to that status right now.',
  LINKING_DISABLED:
    'Self-serve linking is not available for this child. Please contact support.',
  CANNOT_INVITE_SELF: 'You cannot redeem your own invite.',
  DIRECT_MODE_18_ONLY: 'Direct Mode is only available to verified adults (18+).',
};

const HTTP_STATUS: Record<ErrorCode, number> = {
  TENANT_SCOPE_VIOLATION: 403, // never 404 — do not confirm/deny tenant existence
  INVITE_NOT_FOUND: 401,
  INVITE_EMAIL_MISMATCH: 401,
  PARENT_ROLE_REQUIRED: 403,
  CHILD_ROLE_REQUIRED: 403,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  CONSENT_REQUIRED: 403,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 502,
  INTERNAL: 500,
  HEALTH_H0_REFUSED: 403,
  HEALTH_MINOR_CALORIE_REFUSED: 403,
  HEALTH_MINOR_SYNC_REFUSED: 403,
  HEALTH_TEEN_ONLY: 403,
  HEALTH_GATE_REQUIRED: 403,
  SCOPE_FORBIDDEN: 403,
  AGENT_ACCESS_REQUIRED: 403,
  GRANT_SCOPE_NOT_ALLOWED: 403,
  GRANT_NOT_ACTIVE: 410,
  CREDIT_APPROVAL_REQUIRED: 403,
  CREDIT_AMOUNT_INVALID: 400,
  TICKET_TRANSITION_INVALID: 409,
  LINKING_DISABLED: 403,
  CANNOT_INVITE_SELF: 400,
  DIRECT_MODE_18_ONLY: 403,
};

/**
 * Error carrying a canonical API code. The REST wrapper maps this to the
 * canonical envelope; the message IS the code (safe to log, never shown).
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** Throw an ApiError for a canonical code. */
export function failWith(code: ErrorCode): never {
  throw new ApiError(code);
}

/** Map a Postgres / RPC exception to a canonical code. Logs the raw detail. */
export function mapDbError(err: unknown, requestId: string): ErrorCode {
  const message = err instanceof Error ? err.message : String(err);
  // Log raw detail server-side with request correlation (never to client).
  console.error(`[${requestId}] db error:`, message);
  if (message.includes('invite_not_found_or_expired')) return ErrorCodes.INVITE_NOT_FOUND;
  if (message.includes('cannot_invite_self')) return ErrorCodes.CANNOT_INVITE_SELF;
  // Second-parent claim RPC exceptions (049) — raw strings never reach clients.
  if (message.includes('linking_disabled_court_order')) return ErrorCodes.LINKING_DISABLED;
  if (message.includes('rate_limited')) return ErrorCodes.RATE_LIMITED;
  if (message.includes('claim_attestation_required')) return ErrorCodes.VALIDATION_FAILED;
  // claim_not_your_decision / claim_not_found collapse to NOT_FOUND — a prober
  // cannot distinguish "no such claim" from "not yours" (no enumeration oracle).
  if (message.includes('claim_not_your_decision') || message.includes('claim_not_found')) {
    return ErrorCodes.NOT_FOUND;
  }
  if (message.includes('study_plan_checkboxes_teen_only')) return ErrorCodes.CHILD_ROLE_REQUIRED;
  // SEC-002 (2026-10-12): invite_not_found vs invite_email_mismatch was an
  // enumeration oracle on POST /api/v1/invites/consume. Both collapse to the
  // single INVITE_NOT_FOUND code/message — a prober cannot distinguish
  // "token invalid" from "token valid, wrong email". INVITE_EMAIL_MISMATCH
  // remains in the registry (stable API) but is no longer emitted here.
  if (message.includes('invite_email_mismatch')) return ErrorCodes.INVITE_NOT_FOUND;
  if (message.includes('tenant_membership_required')) return ErrorCodes.TENANT_SCOPE_VIOLATION;
  if (message.includes('parent_membership_required')) return ErrorCodes.PARENT_ROLE_REQUIRED;
  if (message.includes('agent_scope_violation')) return ErrorCodes.TENANT_SCOPE_VIOLATION;
  // W22/W23 health + nutrition RPC exceptions (raw strings never reach clients).
  if (message.includes('override_reason_too_short')) return ErrorCodes.VALIDATION_FAILED;
  if (message.includes('override_not_applicable') || message.includes('override_needs_dob'))
    return ErrorCodes.VALIDATION_FAILED;
  if (message.includes('unknown_metric') || message.includes('unknown_subject'))
    return ErrorCodes.VALIDATION_FAILED;
  if (/duplicate key|unique constraint/i.test(message)) return ErrorCodes.CONFLICT;
  // Health track (FR-HEALTH) DB exceptions → canonical codes.
  if (message.includes('h0_minor_refusal')) return ErrorCodes.HEALTH_H0_REFUSED;
  if (message.includes('nutrition_minor_calorie_refusal'))
    return ErrorCodes.HEALTH_MINOR_CALORIE_REFUSED;
  if (message.includes('nutrition_minor_deficit_refusal'))
    return ErrorCodes.HEALTH_GATE_REQUIRED;
  if (message.includes('nutrition_gate_not_found') || message.includes('nutrition_gate_expired'))
    return ErrorCodes.HEALTH_GATE_REQUIRED;
  if (message.includes('h3_parent_write_refusal')) return ErrorCodes.HEALTH_TEEN_ONLY;
  if (message.includes('health_reconsent_subject_only') || message.includes('health_review_subject_only'))
    return ErrorCodes.HEALTH_TEEN_ONLY;
  // School track — second-parent linking (FR-AUTH-011, D5 open signup).
  if (message.includes('linking_disabled_court_order')) return ErrorCodes.LINKING_DISABLED;
  if (message.includes('claim_attestation_required') || message.includes('claim_invalid_decision'))
    return ErrorCodes.VALIDATION_FAILED;
  if (message.includes('claim_not_found') || message.includes('claim_child_not_found'))
    return ErrorCodes.NOT_FOUND;
  if (message.includes('claim_already_decided') || message.includes('claim_already_routed') || message.includes('claim_unmatched'))
    return ErrorCodes.CONFLICT;
  if (message.includes('claim_not_your_decision') || message.includes('claim_staff_only'))
    return ErrorCodes.TENANT_SCOPE_VIOLATION;
  if (message.includes('rate_limited')) return ErrorCodes.RATE_LIMITED;
  if (message.includes('quiz_publish_blocked')) return ErrorCodes.CONFLICT;
  if (message.includes('safety_event_bad_type') || message.includes('safety_event_bad_severity'))
    return ErrorCodes.VALIDATION_FAILED;
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
