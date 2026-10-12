"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import type {
  FamilyMember,
  FamilyRole,
  IndependenceStatus,
  PendingInvite,
} from "./types";

/**
 * Family read + invite-maintenance actions (Settings → Family).
 *
 * This module covers what the backend workstream's tenant actions don't:
 * listing members/invites, resend, revoke, and the 18+ status check.
 * Sending and accepting invites, and the graduation mutation itself, live
 * in @/lib/tenant/actions (sendChildInvite, acceptInvite,
 * graduateToIndependence) — this file never duplicates them.
 *
 * Style matches the tenant actions: fail-closed RLS on the anon-key
 * client, union results with machine-readable error codes, and
 * plain-English mapping left to the UI.
 */

const INVITE_TTL_DAYS = 7;

export type FamilyResult<T> = { ok: true; data: T } | { ok: false; error: string };

function newToken(): string {
  return randomBytes(24).toString("hex");
}

function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000).toISOString();
}

/** Full years between a YYYY-MM-DD date and today. */
function ageYears(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

/**
 * Every active child the caller can see, each with its linked logins
 * (email + role), plus the pending invites addressed to those children.
 * Parent-only in practice: the members list needs the parent-readable
 * users join (F12 policy); child-role callers see only their own row.
 */
export async function getFamilyOverview(): Promise<FamilyResult<{
  members: FamilyMember[];
  pendingInvites: PendingInvite[];
}>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: children, error: childrenError } = await supabase
    .from("children")
    .select("id, first_name, nickname, slug, avatar_url, school_name, grade_level, date_of_birth")
    .eq("status", "active")
    .order("created_at");
  if (childrenError) return { ok: false, error: "load_failed" };
  const childIds = (children ?? []).map((c) => c.id);

  const members: FamilyMember[] = (children ?? []).map((c) => ({
    childId: c.id,
    firstName: c.first_name,
    nickname: c.nickname,
    slug: c.slug,
    avatarUrl: c.avatar_url,
    schoolName: c.school_name,
    gradeLevel: c.grade_level,
    dateOfBirth: c.date_of_birth,
    logins: [],
  }));
  const nameById = new Map(members.map((m) => [m.childId, m.nickname ?? m.firstName]));

  if (childIds.length > 0) {
    // Linked logins: child_access rows joined to users. The users F12 policy
    // lets a parent read emails of users sharing a child.
    const { data: access, error: accessError } = await supabase
      .from("child_access")
      .select("child_id, role, created_at, users(email, display_name)")
      .in("child_id", childIds);
    if (accessError) return { ok: false, error: "load_failed" };

    const byChild = new Map<string, FamilyMember["logins"]>();
    for (const row of access ?? []) {
      const u = Array.isArray(row.users) ? row.users[0] : row.users;
      if (!u?.email) continue;
      const list = byChild.get(row.child_id) ?? [];
      list.push({
        email: u.email,
        displayName: u.display_name,
        role: row.role as FamilyRole,
        linkedAt: row.created_at,
      });
      byChild.set(row.child_id, list);
    }
    for (const m of members) {
      m.logins =
        byChild.get(m.childId)?.sort((a, b) =>
          a.role === b.role ? a.email.localeCompare(b.email) : a.role === "parent" ? -1 : 1
        ) ?? [];
    }

    // Pending invites the parent can see (invites_parent_read RLS).
    const { data: invites, error: inviteError } = await supabase
      .from("invites")
      .select("id, email, child_id, token, expires_at, created_at")
      .eq("status", "pending")
      .in("child_id", childIds)
      .order("created_at", { ascending: false });
    if (inviteError) return { ok: false, error: "load_failed" };

    const pendingInvites: PendingInvite[] = (invites ?? []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      childId: inv.child_id,
      childName: nameById.get(inv.child_id) ?? "your child",
      sentAt: inv.created_at,
      expiresAt: inv.expires_at,
      token: inv.token,
    }));
    return { ok: true, data: { members, pendingInvites } };
  }

  return { ok: true, data: { members, pendingInvites: [] } };
}

/**
 * Resend a pending invite: mint a fresh token + 7-day window.
 * The old link stops working. Parent-only via invites_parent_update RLS.
 */
export async function resendChildInvite(
  inviteId: string
): Promise<FamilyResult<{ token: string; expiresAt: string; email: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: invite, error: readError } = await supabase
    .from("invites")
    .select("id, email")
    .eq("id", inviteId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError || !invite) return { ok: false, error: "invite_not_available" };

  const { data, error } = await supabase
    .from("invites")
    .update({ token: newToken(), expires_at: inviteExpiry(), status: "pending" })
    .eq("id", inviteId)
    .select("token, expires_at")
    .single();
  if (error) return { ok: false, error: "resend_failed" };

  return { ok: true, data: { token: data.token, expiresAt: data.expires_at, email: invite.email } };
}

/**
 * Revoke a pending invite. Ledger-style: the row stays as
 * status='revoked' (there is no DELETE policy by design).
 */
export async function revokeChildInvite(
  inviteId: string
): Promise<FamilyResult<{ email: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: invite, error: readError } = await supabase
    .from("invites")
    .select("id, email")
    .eq("id", inviteId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError || !invite) return { ok: false, error: "invite_not_available" };

  const { error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", inviteId);
  if (error) return { ok: false, error: "revoke_failed" };

  return { ok: true, data: { email: invite.email } };
}

/**
 * 18+ gate for the "take ownership" flow. Drives the IndependenceView:
 * eligible only when the caller holds a child role and
 * children.date_of_birth proves 18+. Missing birthday → not eligible,
 * with a nudge to have the parent save it.
 */
export async function getIndependenceStatus(): Promise<IndependenceStatus> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isChild: false };

  const { data: access } = await supabase
    .from("child_access")
    .select("child_id, role")
    .eq("user_id", user.id);
  const childRow = (access ?? []).find((a) => a.role === "child");
  if (!childRow) return { isChild: false };

  const { data: child } = await supabase
    .from("children")
    .select("first_name, nickname, date_of_birth")
    .eq("id", childRow.child_id)
    .maybeSingle();
  if (!child) return { isChild: false };

  const dob: string | null = child.date_of_birth;
  const age = dob ? ageYears(dob) : null;
  const eligible = age !== null && age >= 18;
  let turnsEighteenOn: string | null = null;
  if (dob && age !== null && age < 18) {
    const [y, m, d] = dob.split("-").map(Number);
    turnsEighteenOn = `${y + 18}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return {
    isChild: true,
    childId: childRow.child_id,
    childName: child.nickname ?? child.first_name,
    dateOfBirth: dob,
    age,
    eligible,
    turnsEighteenOn,
  };
}
