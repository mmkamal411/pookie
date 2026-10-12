// W12 Babysitters — directory + time-boxed grants (D6 tiered caps).
// The vetting disclaimer is a data-model constant, exported here so the UI
// and the API use the exact same string as the DB default:
//
//   'parent-vetted, not background-checked by Pookie'
//
// Grant enforcement (caps, installment detection, teen co-approval, scope
// allowlist, block propagation) lives in the request_sitter_grant() RPC —
// the API never re-implements it. This service is the typed wrapper.
import { createClient } from '@/lib/supabase/server';
import { ErrorCodes, failWith } from '@/server/errors';

export const SITTER_VETTING_DISCLAIMER =
  'parent-vetted, not background-checked by Pookie';

export type GranteeTier = 'first_time' | 'trusted';
export type TeenCoapprovalStatus = 'not_required' | 'required' | 'approved' | 'installment_review';
export type GrantStatus = 'pending_approval' | 'active' | 'expired' | 'revoked' | 'flagged';

export interface Babysitter {
  id: string;
  owner_user_id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  vetted_by: string | null;
  vetted_at: string | null;
  trust_tier: GranteeTier;
  block_on_record: boolean;
  vetting_disclaimer: string;
  created_at: string;
}

export interface SitterGrant {
  id: string;
  child_id: string;
  sitter_id: string;
  granted_by: string;
  purpose: string;
  scope: string[];
  starts_at: string;
  expires_at: string;
  grantee_tier: GranteeTier;
  teen_coapproval_status: TeenCoapprovalStatus;
  status: GrantStatus;
  created_at: string;
}

type Db = Awaited<ReturnType<typeof createClient>>;

const SITTER_COLS =
  'id, owner_user_id, name, contact, notes, vetted_by, vetted_at, trust_tier, block_on_record, vetting_disclaimer, created_at';
const GRANT_COLS =
  'id, child_id, sitter_id, granted_by, purpose, scope, starts_at, expires_at, grantee_tier, teen_coapproval_status, status, created_at';

function toSitter(row: Record<string, unknown>): Babysitter {
  return {
    id: row.id as string,
    owner_user_id: row.owner_user_id as string,
    name: row.name as string,
    contact: (row.contact as string) ?? null,
    notes: (row.notes as string) ?? null,
    vetted_by: (row.vetted_by as string) ?? null,
    vetted_at: (row.vetted_at as string) ?? null,
    trust_tier: row.trust_tier as GranteeTier,
    block_on_record: row.block_on_record as boolean,
    vetting_disclaimer: row.vetting_disclaimer as string,
    created_at: row.created_at as string,
  };
}

function toGrant(row: Record<string, unknown>): SitterGrant {
  return {
    id: row.id as string,
    child_id: row.child_id as string,
    sitter_id: row.sitter_id as string,
    granted_by: row.granted_by as string,
    purpose: row.purpose as string,
    scope: (row.scope as string[]) ?? [],
    starts_at: row.starts_at as string,
    expires_at: row.expires_at as string,
    grantee_tier: row.grantee_tier as GranteeTier,
    teen_coapproval_status: row.teen_coapproval_status as TeenCoapprovalStatus,
    status: row.status as GrantStatus,
    created_at: row.created_at as string,
  };
}

export interface AddSitterInput {
  name: string;
  contact?: string;
  notes?: string;
}

export async function listSitters(supabase: Db, ownerUserId: string): Promise<Babysitter[]> {
  const { data, error } = await supabase
    .from('babysitters')
    .select(SITTER_COLS)
    .eq('owner_user_id', ownerUserId)
    .order('name', { ascending: true });
  if (error) failWith(ErrorCodes.INTERNAL);
  return ((data ?? []) as Record<string, unknown>[]).map(toSitter);
}

export async function addSitter(
  supabase: Db,
  ownerUserId: string,
  userId: string,
  input: AddSitterInput,
): Promise<Babysitter> {
  const { data, error } = await supabase
    .from('babysitters')
    .insert({
      owner_user_id: ownerUserId,
      name: input.name,
      contact: input.contact ?? null,
      notes: input.notes ?? null,
      vetted_by: userId,
      vetted_at: new Date().toISOString(),
    })
    .select(SITTER_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toSitter(data as Record<string, unknown>);
}

export async function getSitter(supabase: Db, ownerUserId: string, sitterId: string): Promise<Babysitter> {
  const { data, error } = await supabase
    .from('babysitters')
    .select(SITTER_COLS)
    .eq('id', sitterId)
    .eq('owner_user_id', ownerUserId)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return toSitter(data as Record<string, unknown>);
}

export async function updateSitter(
  supabase: Db,
  ownerUserId: string,
  sitterId: string,
  patch: { contact?: string; notes?: string },
): Promise<Babysitter> {
  const { data, error } = await supabase
    .from('babysitters')
    .update({
      ...(patch.contact !== undefined ? { contact: patch.contact } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    })
    .eq('id', sitterId)
    .eq('owner_user_id', ownerUserId)
    .select(SITTER_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.NOT_FOUND);
  return toSitter(data as Record<string, unknown>);
}

export interface RequestGrantInput {
  purpose: string;
  starts_at: string;
  expires_at: string;
  scope?: string[];
}

/**
 * Request a time-boxed grant. D6 enforcement (tiered caps, installment
 * detection, teen co-approval for new grantees 13–15, scope allowlist, block
 * propagation) runs inside request_sitter_grant(); RPC exceptions map to API
 * error codes. Returns the grant — check teen_coapproval_status for
 * 'required' (teen must approve) or 'installment_review' (flagged).
 */
export async function requestGrant(
  supabase: Db,
  sitterId: string,
  childId: string,
  input: RequestGrantInput,
): Promise<SitterGrant> {
  const { data, error } = await supabase.rpc('request_sitter_grant', {
    p_sitter_id: sitterId,
    p_child_id: childId,
    p_purpose: input.purpose,
    p_starts_at: input.starts_at,
    p_expires_at: input.expires_at,
    p_scope: input.scope ?? ['schedule', 'pickup', 'emergency_medical'],
  });
  if (error) {
    const m = error.message;
    if (m.includes('grant_cap_exceeded')) failWith(ErrorCodes.RATE_LIMITED);
    if (m.includes('sitter_blocked')) failWith(ErrorCodes.CONFLICT);
    if (m.includes('scope_not_allowed') || m.includes('invalid_grant_window')) {
      failWith(ErrorCodes.VALIDATION_FAILED);
    }
    if (m.includes('parent_membership_required')) failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
    if (m.includes('sitter_not_found')) failWith(ErrorCodes.NOT_FOUND);
    failWith(ErrorCodes.INTERNAL);
  }
  return toGrant(data as Record<string, unknown>);
}

/** List grants for a sitter (parent view). */
export async function listGrants(supabase: Db, sitterId: string): Promise<SitterGrant[]> {
  const { data, error } = await supabase
    .from('sitter_grants')
    .select(GRANT_COLS)
    .eq('sitter_id', sitterId)
    .order('created_at', { ascending: false });
  if (error) failWith(ErrorCodes.INTERNAL);
  return ((data ?? []) as Record<string, unknown>[]).map(toGrant);
}

/**
 * Teen co-approval (13–15, new grantees): the teen approves a 'required' grant.
 * Instant — no cooling-off (safety action). Also clears 'installment_review'
 * flags after a parent reviews the flagged chain.
 */
export async function approveGrant(
  supabase: Db,
  grantId: string,
  approverUserId: string,
  asTeen: boolean,
): Promise<SitterGrant> {
  const { data: grant, error: readError } = await supabase
    .from('sitter_grants')
    .select(GRANT_COLS)
    .eq('id', grantId)
    .single();
  if (readError || !grant) failWith(ErrorCodes.NOT_FOUND);
  const g = toGrant(grant as Record<string, unknown>);
  if (asTeen && g.teen_coapproval_status !== 'required') failWith(ErrorCodes.CONFLICT);
  if (!asTeen && g.teen_coapproval_status !== 'installment_review') failWith(ErrorCodes.CONFLICT);
  const { data, error } = await supabase
    .from('sitter_grants')
    .update({
      teen_coapproval_status: 'approved',
      teen_coapproved_by: asTeen ? approverUserId : null,
      teen_coapproved_at: asTeen ? new Date().toISOString() : null,
      status: 'active',
    })
    .eq('id', grantId)
    .select(GRANT_COLS)
    .single();
  if (error || !data) failWith(ErrorCodes.INTERNAL);
  return toGrant(data as Record<string, unknown>);
}

/** Close out a grant; promote the sitter to 'trusted' on clean completion (D6 tier source), or record a block. */
export async function closeGrant(supabase: Db, grantId: string, blocked: boolean): Promise<Babysitter> {
  const { data, error } = await supabase.rpc('record_sitter_grant_outcome', {
    p_grant_id: grantId,
    p_blocked: blocked,
  });
  if (error) {
    if (error.message.includes('parent_membership_required')) failWith(ErrorCodes.PARENT_ROLE_REQUIRED);
    if (error.message.includes('grant_not_found')) failWith(ErrorCodes.NOT_FOUND);
    failWith(ErrorCodes.INTERNAL);
  }
  return toSitter(data as Record<string, unknown>);
}

/** Revoke a grant (parent or teen — instant, no cooling-off). */
export async function revokeGrant(
  supabase: Db,
  grantId: string,
  revokedBy: 'parent' | 'teen',
): Promise<void> {
  const { error } = await supabase
    .from('sitter_grants')
    .update({ status: 'revoked', revoked_by: revokedBy })
    .eq('id', grantId)
    .in('status', ['active', 'pending_approval', 'flagged']);
  if (error) failWith(ErrorCodes.INTERNAL);
}
