// Public surface of the shared API layer (Phase 0, Platform Team 2).
//
//   handler.ts  apiHandler()      — the wrapper every /api/v1 route uses:
//                                   auth + request-id (via handleRoute) plus the
//                                   scope-filtering choke point.
//   scopes.ts   resolveVisibleScopesPure / applyScopeFilter / withScope
//   db.ts       resolveVisibleScopes / coolingFreezeAt (real data)
//   sla.ts      computeSlaDueAt / slaStatus / holiday + on-call rotation (D4)
//   grants.ts   break-glass grant rules, credit authority, ticket transitions
//   support.ts  ticket / grant / credit / on-call backend helpers
export { apiHandler, type ApiHandlerOptions, type ScopedRouteContext } from './handler';
export {
  SCOPES,
  TEEN_PRIVATE_SCOPES,
  sanitizeScopes,
  resolveVisibleScopesPure,
  hasScopePure,
  applyScopeFilter,
  withScope,
  type Scope,
  type HealthTier,
  type ScopeResolution,
  type FilterOptions,
} from './scopes';
export { resolveVisibleScopes, coolingFreezeAt, type ViewerScopes } from './db';
export {
  SUPPORT_WINDOW_START_HOUR_ET,
  SUPPORT_WINDOW_END_HOUR_ET,
  FIRST_RESPONSE_SLA_HOURS,
  isSupportHoliday,
  holidayName,
  etDateKey,
  defaultOnCallIndex,
  resolveOnCallAgent,
  computeSlaDueAt,
  slaStatus,
  slaRemainingMs,
  type SlaState,
  type SlaTicket,
} from './sla';
export {
  GRANTABLE_SCOPES,
  NEVER_GRANTABLE_SCOPE_PREFIXES,
  isGrantableScope,
  isNeverGrantableScope,
  GRANT_DEFAULT_TTL_HOURS,
  GRANT_MAX_TTL_HOURS,
  grantExpiresAt,
  isGrantActive,
  AGENT_CREDIT_LIMIT_CENTS,
  creditPathFor,
  CREDIT_APPROVER_TIERS,
  canDecideCreditApproval,
  TICKET_STATUSES,
  canTransitionTicket,
  type GrantableScope,
  type SupportGrant,
  type TicketStatus,
  type TicketActor,
  type CreditPath,
} from './grants';
export {
  resolveOnCallAgentId,
  openTicket,
  listUserTickets,
  getUserTicket,
  getTicketForAgent,
  postTicketEvent,
  claimTicket,
  transitionTicket,
  requestSupportGrant,
  decideSupportGrant,
  checkGrantForRead,
  expireSupportGrants,
  issueOrRequestCredit,
  decideCreditApproval,
  type OpenTicketInput,
} from './support';
