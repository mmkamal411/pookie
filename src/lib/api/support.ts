// Support backend helpers — S3 tickets, agent RBAC, D4 financial authority.
// Writes go through the service-role client (RLS denies direct status
// updates; every transition is validated here first). Every agent read and
// every financial action is audit-logged to access_events.
//
// Design refs: sol-support §B/§D, FR-SUPPORT-003/004/005, MD decision D4.
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, ErrorCodes, failWith } from '@/server/errors';
import {
  computeSlaDueAt,
  isSupportHoliday,
  resolveOnCallAgent,
  slaStatus,
  type SlaState,
} from './sla';
import {
  AGENT_CREDIT_LIMIT_CENTS,
  canDecideCreditApproval,
  canTransitionTicket,
  creditPathFor,
  grantExpiresAt,
  isGrantActive,
  isGrantableScope,
  type GrantableScope,
  type TicketActor,
  type TicketStatus,
} from './grants';

// ---------------------------------------------------------------------------
// audit
// ---------------------------------------------------------------------------

async function auditSupport(
  db: SupabaseClient,
  params: {
    childId: string | null;
    actorUserId: string | null;
    eventType: string;
    subjectUserId?: string | null;
    amountCents?: number | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await db.rpc('log_access_event', {
      p_child_id: params.childId,
      p_actor_user_id: params.actorUserId,
      p_event_type: params.eventType,
      p_subject_user_id: params.subjectUserId ?? null,
      p_metadata: params.metadata ?? {},
      p_amount_cents: params.amountCents ?? null,
    });
  } catch {
    // audit is best-effort; it must never break the primary operation
  }
}

async function getAgentByUserId(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('support_agents')
    .select('id, user_id, display_name, role_tier, active')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data || !(data as { active: boolean }).active) return null;
  return data as { id: string; user_id: string; display_name: string; role_tier: string; active: boolean };
}

async function requireAgent(db: SupabaseClient, userId: string) {
  const agent = await getAgentByUserId(db, userId);
  if (!agent) failWith(ErrorCodes.AGENT_ACCESS_REQUIRED);
  return agent!;
}

async function getTicketRow(db: SupabaseClient, ticketId: string) {
  const { data, error } = await db.from('support_tickets').select('*').eq('id', ticketId).maybeSingle();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return data as Record<string, unknown> & {
    id: string; user_id: string; child_id: string | null; status: TicketStatus;
    assigned_agent_id: string | null; sensitive: boolean;
  };
}

// ---------------------------------------------------------------------------
// D4: on-call resolution (holiday auto-assignment)
// ---------------------------------------------------------------------------

/** Ordered active agent ids + date->agent overrides from support_oncall. */
export async function resolveOnCallAgentId(db: SupabaseClient, at: Date): Promise<string | null> {
  const { data: agents } = await db
    .from('support_agents')
    .select('id')
    .eq('active', true)
    .order('created_at', { ascending: true });
  const ids = ((agents ?? []) as { id: string }[]).map((a) => a.id);
  const { data: overrides } = await db.from('support_oncall').select('oncall_date, agent_id');
  const map = new Map(((overrides ?? []) as { oncall_date: string; agent_id: string }[]).map((o) => [o.oncall_date, o.agent_id]));
  return resolveOnCallAgent(at, ids, map);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export interface OpenTicketInput {
  userId: string;
  childId?: string | null;
  category: string;
  subject: string;
  body: string;
  source?: 's2_escalation' | 'manual' | 'faq';
  teenPrivacy?: boolean;
  priority?: 'P1' | 'P2' | 'P3';
}

export async function openTicket(db: SupabaseClient, input: OpenTicketInput) {
  const now = new Date();
  const holiday = isSupportHoliday(now);
  // D4: holiday tickets auto-assign to the on-call agent.
  const assignedAgentId = holiday ? await resolveOnCallAgentId(db, now) : null;
  const { data: ticket, error } = await db
    .from('support_tickets')
    .insert({
      user_id: input.userId,
      child_id: input.childId ?? null,
      category: input.category,
      subject: input.subject,
      status: 'open',
      priority: input.priority ?? 'P3',
      sensitive: (input.priority ?? 'P3') === 'P1',
      assigned_agent_id: assignedAgentId,
      sla_due_at: computeSlaDueAt(now).toISOString(),
      holiday,
      source: input.source ?? 'manual',
      teen_privacy: input.teenPrivacy ?? false,
    })
    .select('id, ticket_number, sla_due_at, assigned_agent_id')
    .single();
  if (error || !ticket) failWith(ErrorCodes.INTERNAL);
  const t = ticket as { id: string; ticket_number: string; sla_due_at: string; assigned_agent_id: string | null };
  await db.from('ticket_events').insert({
    ticket_id: t.id,
    author_type: 'user',
    author_id: input.userId,
    kind: 'message',
    body: input.body,
  });
  return t;
}

export async function listUserTickets(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('support_tickets')
    .select('id, ticket_number, subject, status, priority, sla_due_at, sla_breached, created_at, assigned_agent_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) failWith(ErrorCodes.INTERNAL);
  const rows = (data ?? []) as { sla_due_at: string; sla_breached: boolean; status: string }[];
  return rows.map((r) => ({ ...r, sla_state: slaStatus(r) as SlaState }));
}

export async function getUserTicket(db: SupabaseClient, userId: string, ticketId: string) {
  const { data: ticket } = await db
    .from('support_tickets')
    .select('*')
    .eq('id', ticketId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!ticket) failWith(ErrorCodes.NOT_FOUND);
  const { data: events } = await db
    .from('ticket_events')
    .select('id, author_type, kind, body, created_at')
    .eq('ticket_id', ticketId)
    .eq('internal', false)
    .order('created_at', { ascending: true });
  return { ticket, events: events ?? [] };
}

/** Agent view of a ticket (all events incl. internal). Audit-logged per read. */
export async function getTicketForAgent(db: SupabaseClient, agentUserId: string, ticketId: string) {
  const agent = await requireAgent(db, agentUserId);
  const ticket = await getTicketRow(db, ticketId);
  const isLead = agent.role_tier === 'lead' || agent.role_tier === 'admin';
  if (!isLead && ticket.assigned_agent_id !== agent.id) {
    // Unassigned open queue is visible; anything else needs assignment.
    if (!(ticket.assigned_agent_id === null && ticket.status === 'open')) {
      failWith(ErrorCodes.SCOPE_FORBIDDEN);
    }
  }
  const { data: events } = await db
    .from('ticket_events')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  await auditSupport(db, {
    childId: ticket.child_id,
    actorUserId: agentUserId,
    eventType: 'support.ticket.viewed',
    metadata: { ticket_id: ticketId },
  });
  return { ticket, events: events ?? [], agent };
}

export async function postTicketEvent(
  db: SupabaseClient,
  input: {
    ticketId: string;
    authorType: 'user' | 'agent' | 'ai' | 'system';
    authorId: string | null;
    kind?: string;
    body: string;
    internal?: boolean;
  },
) {
  const ticket = await getTicketRow(db, input.ticketId);
  if (input.authorType === 'user' && ticket.user_id !== input.authorId) {
    failWith(ErrorCodes.SCOPE_FORBIDDEN);
  }
  if (input.authorType === 'agent') {
    await requireAgent(db, input.authorId!);
  }
  const { data, error } = await db
    .from('ticket_events')
    .insert({
      ticket_id: input.ticketId,
      author_type: input.authorType,
      author_id: input.authorId,
      kind: input.kind ?? (input.authorType === 'agent' ? 'agent_reply' : 'message'),
      body: input.body,
      internal: input.internal ?? false,
    })
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  if (input.internal) {
    await auditSupport(db, {
      childId: ticket.child_id,
      actorUserId: input.authorId,
      eventType: 'support.internal_note.created',
      metadata: { ticket_id: input.ticketId },
    });
  }
  return (data as { id: string }).id;
}

/** Claim a ticket (open -> in_progress). Sensitive tickets need a lead. */
export async function claimTicket(db: SupabaseClient, agentUserId: string, ticketId: string) {
  const agent = await requireAgent(db, agentUserId);
  const ticket = await getTicketRow(db, ticketId);
  if (ticket.status !== 'open') failWith(ErrorCodes.TICKET_TRANSITION_INVALID);
  if (ticket.sensitive && agent.role_tier === 'agent') {
    // sol-support §B.4: no self-assign on sensitive tickets (P1 / child-authored).
    failWith(ErrorCodes.AGENT_ACCESS_REQUIRED);
  }
  // Conflict of interest: an agent with a family link to the ticket user
  // can never work the ticket (sol-support §B.4).
  const { data: agentLinks } = await db
    .from('child_access')
    .select('child_id')
    .eq('user_id', agentUserId)
    .limit(50);
  const { data: userChildren } = await db
    .from('child_access')
    .select('child_id')
    .eq('user_id', ticket.user_id)
    .limit(50);
  const agentChildIds = new Set(((agentLinks ?? []) as { child_id: string }[]).map((r) => r.child_id));
  const conflict = ((userChildren ?? []) as { child_id: string }[]).some((r) => agentChildIds.has(r.child_id));
  if (conflict) failWith(ErrorCodes.SCOPE_FORBIDDEN);

  const { error } = await db
    .from('support_tickets')
    .update({ assigned_agent_id: agent.id, status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', ticketId);
  if (error) failWith(ErrorCodes.INTERNAL);
  await db.from('ticket_events').insert({
    ticket_id: ticketId, author_type: 'system', kind: 'status_change',
    body: `${agent.display_name} claimed the ticket`,
    metadata: { from: 'open', to: 'in_progress', agent_id: agent.id },
  });
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: agentUserId,
    eventType: 'support.ticket.assigned', metadata: { ticket_id: ticketId, agent_id: agent.id },
  });
}

/** Validated status transition (sol-support §D.2). */
export async function transitionTicket(
  db: SupabaseClient,
  ticketId: string,
  to: TicketStatus,
  actor: TicketActor,
  actorUserId: string,
) {
  const ticket = await getTicketRow(db, ticketId);
  if (!canTransitionTicket(ticket.status, to, actor)) {
    failWith(ErrorCodes.TICKET_TRANSITION_INVALID);
  }
  if (actor === 'user' && ticket.user_id !== actorUserId) failWith(ErrorCodes.SCOPE_FORBIDDEN);
  if ((actor === 'agent' || actor === 'lead') && !(await getAgentByUserId(db, actorUserId))) {
    failWith(ErrorCodes.AGENT_ACCESS_REQUIRED);
  }
  const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() };
  if (to === 'closed') patch['closed_at'] = new Date().toISOString();
  if (to === 'in_progress' && ticket.status !== 'open') {
    patch['reopened_count'] = ((ticket as Record<string, number>)['reopened_count'] ?? 0) + 1;
  }
  const { error } = await db.from('support_tickets').update(patch).eq('id', ticketId);
  if (error) failWith(ErrorCodes.INTERNAL);
  await db.from('ticket_events').insert({
    ticket_id: ticketId, author_type: actor === 'user' ? 'user' : actor === 'system' ? 'system' : 'agent',
    author_id: actorUserId, kind: 'status_change',
    body: `Status: ${ticket.status} → ${to}`,
    metadata: { from: ticket.status, to },
  });
}

// ---------------------------------------------------------------------------
// Break-glass grants (FR-SUPPORT-005)
// ---------------------------------------------------------------------------

export async function requestSupportGrant(
  db: SupabaseClient,
  input: { ticketId: string; agentUserId: string; scope: string; purpose: string },
) {
  const agent = await requireAgent(db, input.agentUserId);
  if (!isGrantableScope(input.scope)) failWith(ErrorCodes.GRANT_SCOPE_NOT_ALLOWED);
  const ticket = await getTicketRow(db, input.ticketId);
  const { data, error } = await db
    .from('support_grants')
    .insert({
      ticket_id: input.ticketId,
      agent_id: agent.id,
      scope: input.scope as GrantableScope,
      purpose: input.purpose.slice(0, 280),
      requested_by: agent.id,
      status: 'pending',
      expires_at: grantExpiresAt(new Date()).toISOString(),
    })
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: input.agentUserId,
    eventType: 'support.grant.requested',
    metadata: { ticket_id: input.ticketId, grant_id: (data as { id: string }).id, scope: input.scope },
  });
  // The consent card goes to the data owner (the ticket's user_id — the teen
  // for teen-owned data, never the parent; sol-support C2).
  return { grantId: (data as { id: string }).id, consenterUserId: ticket.user_id };
}

/** The data owner (ticket.user_id) approves or denies a grant request. */
export async function decideSupportGrant(
  db: SupabaseClient,
  input: { grantId: string; deciderUserId: string; approve: boolean; ttlHours?: number },
) {
  const { data: grant } = await db.from('support_grants').select('*').eq('id', input.grantId).maybeSingle();
  if (!grant || (grant as { status: string }).status !== 'pending') failWith(ErrorCodes.NOT_FOUND);
  const g = grant as { ticket_id: string; agent_id: string; status: string };
  const ticket = await getTicketRow(db, g.ticket_id);
  if (ticket.user_id !== input.deciderUserId) failWith(ErrorCodes.SCOPE_FORBIDDEN);
  const now = new Date();
  const patch = input.approve
    ? { status: 'active', granted_by_user_id: input.deciderUserId, consented_at: now.toISOString(), expires_at: grantExpiresAt(now, input.ttlHours).toISOString() }
    : { status: 'denied' };
  const { error } = await db.from('support_grants').update(patch).eq('id', input.grantId);
  if (error) failWith(ErrorCodes.INTERNAL);
  const { data: agent } = await db.from('support_agents').select('user_id').eq('id', g.agent_id).maybeSingle();
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: input.deciderUserId,
    eventType: input.approve ? 'support.grant.approved' : 'support.grant.denied',
    subjectUserId: (agent as { user_id: string } | null)?.user_id ?? null,
    metadata: { ticket_id: g.ticket_id, grant_id: input.grantId },
  });
}

/** Validate a grant before a scoped read; audit-log the read on success. */
export async function checkGrantForRead(db: SupabaseClient, grantId: string, agentUserId: string) {
  const { data: grant } = await db.from('support_grants').select('*').eq('id', grantId).maybeSingle();
  if (!grant) failWith(ErrorCodes.NOT_FOUND);
  const g = grant as { id: string; status: string; expires_at: string; revoked_at: string | null; agent_id: string; ticket_id: string; scope: string };
  const agent = await requireAgent(db, agentUserId);
  if (g.agent_id !== agent.id) failWith(ErrorCodes.SCOPE_FORBIDDEN);
  if (!isGrantActive({ status: g.status as 'active', expires_at: g.expires_at, revoked_at: g.revoked_at })) {
    throw new ApiError(ErrorCodes.GRANT_NOT_ACTIVE);
  }
  const ticket = await getTicketRow(db, g.ticket_id);
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: agentUserId,
    eventType: 'support.grant.data_accessed',
    metadata: { ticket_id: g.ticket_id, grant_id: grantId, scope: g.scope },
  });
  return { scope: g.scope as GrantableScope, ticket };
}

/** Cron entrypoint: expire past-TTL grants (also enforced per-read). */
export async function expireSupportGrants(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc('expire_support_grants');
  if (error) failWith(ErrorCodes.INTERNAL);
  return (data as number) ?? 0;
}

// ---------------------------------------------------------------------------
// D4 tiered financial authority
// ---------------------------------------------------------------------------

/**
 * Issue a credit (<= $50) directly in-ticket, or route > $50 to MD approval.
 * Returns { path: 'issued' } or { path: 'approval_requested', approvalId }.
 */
export async function issueOrRequestCredit(
  db: SupabaseClient,
  input: { ticketId: string; agentUserId: string; amountCents: number; reason: string },
) {
  const agent = await requireAgent(db, input.agentUserId);
  const path = creditPathFor(input.amountCents); // throws on invalid amount
  const ticket = await getTicketRow(db, input.ticketId);
  if (ticket.assigned_agent_id !== agent.id && agent.role_tier === 'agent') {
    failWith(ErrorCodes.SCOPE_FORBIDDEN);
  }
  if (path === 'direct') {
    await db.from('ticket_events').insert({
      ticket_id: input.ticketId, author_type: 'agent', author_id: input.agentUserId,
      kind: 'credit_issued', body: input.reason, amount_cents: input.amountCents,
      metadata: { issued_by: agent.id, limit_cents: AGENT_CREDIT_LIMIT_CENTS },
    });
    await auditSupport(db, {
      childId: ticket.child_id, actorUserId: input.agentUserId,
      eventType: 'support.credit.issued', amountCents: input.amountCents,
      metadata: { ticket_id: input.ticketId },
    });
    return { path: 'issued' as const };
  }
  const { data, error } = await db
    .from('support_credit_approvals')
    .insert({
      ticket_id: input.ticketId,
      amount_cents: input.amountCents,
      reason: input.reason.slice(0, 280),
      requested_by: agent.id,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) failWith(ErrorCodes.INTERNAL);
  const approvalId = (data as { id: string }).id;
  await db.from('ticket_events').insert({
    ticket_id: input.ticketId, author_type: 'agent', author_id: input.agentUserId,
    kind: 'approval_requested', body: input.reason, amount_cents: input.amountCents,
    metadata: { approval_id: approvalId },
  });
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: input.agentUserId,
    eventType: 'support.credit.approval_requested', amountCents: input.amountCents,
    metadata: { ticket_id: input.ticketId, approval_id: approvalId },
  });
  return { path: 'approval_requested' as const, approvalId };
}

/** MD (admin tier) decides a pending credit approval. */
export async function decideCreditApproval(
  db: SupabaseClient,
  input: { approvalId: string; deciderUserId: string; approve: boolean; note?: string },
) {
  const agent = await requireAgent(db, input.deciderUserId);
  if (!canDecideCreditApproval(agent.role_tier)) {
    throw new ApiError(ErrorCodes.CREDIT_APPROVAL_REQUIRED);
  }
  const { data: approval } = await db
    .from('support_credit_approvals')
    .select('*')
    .eq('id', input.approvalId)
    .maybeSingle();
  if (!approval || (approval as { status: string }).status !== 'pending') failWith(ErrorCodes.NOT_FOUND);
  const a = approval as { id: string; ticket_id: string; amount_cents: number; reason: string; requested_by: string };
  const ticket = await getTicketRow(db, a.ticket_id);
  const now = new Date().toISOString();
  const { error } = await db
    .from('support_credit_approvals')
    .update({
      status: input.approve ? 'approved' : 'denied',
      decided_by: input.deciderUserId, decided_at: now,
      decision_note: (input.note ?? '').slice(0, 280),
    })
    .eq('id', input.approvalId);
  if (error) failWith(ErrorCodes.INTERNAL);
  await db.from('ticket_events').insert({
    ticket_id: a.ticket_id, author_type: 'agent', author_id: input.deciderUserId,
    kind: 'approval_decided', body: input.approve ? `Credit approved: ${a.reason}` : `Credit denied: ${input.note ?? ''}`,
    amount_cents: a.amount_cents,
    metadata: { approval_id: a.id, approved: input.approve, decided_by: input.deciderUserId },
  });
  await auditSupport(db, {
    childId: ticket.child_id, actorUserId: input.deciderUserId,
    eventType: 'support.credit.approval_decided', amountCents: a.amount_cents,
    metadata: { ticket_id: a.ticket_id, approval_id: a.id, approved: input.approve },
  });
  return { approved: input.approve };
}
