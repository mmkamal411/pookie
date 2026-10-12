// Support-agent RBAC primitives — PURE functions (FR-SUPPORT-005, sol-support §B).
// Least-privilege: agents see ticket content + contact + relevant module
// context only. Break-glass grants are single-scope, short-TTL, and every
// scoped read is audit-logged. Health / wellbeing / mood / check-in scopes are
// NOT grantable — rejected here and by the DB CHECK (sol-support conflict C1).

export const GRANTABLE_SCOPES = [
  'school.grades.read',
  'billing.read',
  'sync.status.read',
] as const;

export type GrantableScope = (typeof GRANTABLE_SCOPES)[number];

/** Scopes that must never be grantable, even if requested. */
export const NEVER_GRANTABLE_SCOPE_PREFIXES = [
  'health.',
  'wellbeing.',
  'mood.',
  'checkin.',
  'reflection.',
  'wellness.',
] as const;

export function isGrantableScope(scope: string): scope is GrantableScope {
  return (GRANTABLE_SCOPES as readonly string[]).includes(scope);
}

export function isNeverGrantableScope(scope: string): boolean {
  return NEVER_GRANTABLE_SCOPE_PREFIXES.some((p) => scope.startsWith(p));
}

export const GRANT_DEFAULT_TTL_HOURS = 24;
export const GRANT_MAX_TTL_HOURS = 72;

/** Expiry for a new grant: consented_at + ttl (default 24h, hard cap 72h). */
export function grantExpiresAt(consentedAt: Date, ttlHours: number = GRANT_DEFAULT_TTL_HOURS): Date {
  const ttl = Math.min(Math.max(ttlHours, 1), GRANT_MAX_TTL_HOURS);
  return new Date(consentedAt.getTime() + ttl * 3_600_000);
}

export interface SupportGrant {
  status: 'pending' | 'active' | 'expired' | 'revoked' | 'denied';
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

/** A grant authorizes reads only when active, unrevoked, and unexpired. */
export function isGrantActive(grant: SupportGrant, now: Date = new Date()): boolean {
  if (grant.status !== 'active') return false;
  if (grant.revoked_at) return false;
  return new Date(grant.expires_at).getTime() > now.getTime();
}

// ---------------------------------------------------------------------------
// D4 tiered financial authority (pure rules)
// ---------------------------------------------------------------------------

export const AGENT_CREDIT_LIMIT_CENTS = 5000; // $50 in-ticket, no escalation

export type CreditPath = 'direct' | 'approval_required';

export function creditPathFor(amountCents: number): CreditPath {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('amountCents must be a positive integer');
  }
  return amountCents <= AGENT_CREDIT_LIMIT_CENTS ? 'direct' : 'approval_required';
}

/** Agent tiers allowed to decide a credit approval (the Managing Director). */
export const CREDIT_APPROVER_TIERS = ['admin'] as const;

export function canDecideCreditApproval(roleTier: string): boolean {
  return (CREDIT_APPROVER_TIERS as readonly string[]).includes(roleTier);
}

// ---------------------------------------------------------------------------
// Ticket status machine (sol-support §D.2) — pure transition validation
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export type TicketActor = 'user' | 'agent' | 'lead' | 'system';

const TRANSITIONS: Record<TicketStatus, Partial<Record<TicketActor, TicketStatus[]>>> = {
  open: { agent: ['in_progress'], lead: ['in_progress'], system: ['in_progress'] },
  in_progress: { agent: ['resolved'], lead: ['resolved', 'open'], user: ['resolved'] },
  resolved: { user: ['closed', 'in_progress'], system: ['closed', 'in_progress'] },
  closed: { user: ['in_progress'] }, // reopen within 30 days (enforced by API)
};

export function canTransitionTicket(from: TicketStatus, to: TicketStatus, actor: TicketActor): boolean {
  if (from === to) return false;
  return TRANSITIONS[from]?.[actor]?.includes(to) ?? false;
}
