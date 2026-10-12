"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getDemoMemberships, isDemoRequest } from "@/lib/demo";
import {
  ACTIVE_CHILD_COOKIE,
  type TenantMembership,
  type TenantRole,
} from "./types";

/**
 * The logged-in user's tenant memberships, resolved from child_access.
 * This is the single source of truth for "which children can this user see".
 *
 * Demo mode short-circuits to mock memberships — the RLS flow below is
 * untouched and runs exactly as before on every non-demo deploy.
 */
export async function getMemberships(): Promise<TenantMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Real authenticated user always wins — demo mode only applies to guests.
  // (Fix 2026-10-12: a stale demo cookie was overriding real sessions,
  // showing "Demo Parent" / parent@example.com to logged-in users.)
  if (user) {
    const { data, error } = await supabase
      .from("child_access")
      .select(
        "child_id, role, children!inner(id, slug, first_name, nickname, avatar_url, school_name, grade_level)",
      )
      .eq("user_id", user.id);

    if (error || !data) return [];

    return data.map((row) => {
      // Supabase types the !inner join as an array; the inner join guarantees one row.
      const child = Array.isArray(row.children) ? row.children[0] : row.children;
      return {
        child_id: row.child_id,
        role: row.role as TenantRole,
        child: {
          id: child.id,
          slug: child.slug,
          first_name: child.first_name,
          nickname: child.nickname,
          avatar_url: child.avatar_url,
          school_name: child.school_name,
          grade_level: child.grade_level,
        },
      };
    });
  }

  // No session — fall back to demo mode if the demo cookie is present.
  if (await isDemoRequest()) return getDemoMemberships();

  return [];
}

/** Read the session's active tenant from the HttpOnly cookie. */
export async function getActiveChildId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTIVE_CHILD_COOKIE)?.value ?? null;
}

/**
 * Set the session's active tenant. Rejects any child_id outside the
 * caller's membership set — RLS enforces this server-side regardless.
 */
export async function setActiveChild(childId: string): Promise<void> {
  const memberships = await getMemberships();
  const match = memberships.find((m) => m.child_id === childId);
  if (!match) throw new Error("not_a_member_of_child");

  const store = await cookies();
  store.set(ACTIVE_CHILD_COOKIE, childId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Clear the active tenant (used on sign-out). */
export async function clearActiveChild(): Promise<void> {
  const store = await cookies();
  store.delete(ACTIVE_CHILD_COOKIE);
}

/**
 * Consume an invite token after OTP login (0-membership case).
 * Calls the SECURITY DEFINER rpc consume_invite, then redirects home.
 */
export async function consumeInvite(token: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_invite", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  if (data) await setActiveChild(data as string);
  redirect("/");
}

/** Sign out: clear Supabase session + tenant cookie. */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActiveChild();
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Child invite management (Parent-Facing Child Account Management)
// ---------------------------------------------------------------------------

const childEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("invalid_email")
  .max(254, "invalid_email");

/** Max pending child invites one parent may create per rolling 24h window. */
const MAX_PENDING_INVITES_PER_DAY = 5;

/** Invite links stay valid for 7 days. */
const INVITE_TTL_DAYS = 7;

export type SendInviteResult =
  | { ok: true; verifyUrl: string }
  | { ok: false; error: string };

/**
 * Parent-only: invite a child to claim their own account on an existing
 * child record.
 *
 * Fail-closed gates, in order:
 *  1. caller must hold role='parent' on childId (via getMemberships)
 *  2. childEmail must be a syntactically valid address
 *  3. childEmail must differ from the caller's own auth email (no self-invite)
 *  4. no existing pending, unexpired invite for (childEmail, childId)
 *  5. caller must be under the daily pending-invite rate limit
 *
 * The email-ownership proof happens later: the child must sign in with the
 * invited address before consume_invite() will grant access — a parent
 * cannot accept on the child's behalf.
 *
 * Depends on migration 015 (invites.invited_by_user_id).
 */
export async function sendChildInvite(
  childId: string,
  childEmail: string,
): Promise<SendInviteResult> {
  const parsed = childEmailSchema.safeParse(childEmail);
  if (!parsed.success) return { ok: false, error: "invalid_email" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "not_signed_in" };

  const memberships = await getMemberships();
  const isParent = memberships.some(
    (m) => m.child_id === childId && m.role === "parent",
  );
  if (!isParent) return { ok: false, error: "not_parent_of_child" };

  const normalized = parsed.data;
  if (normalized === user.email.trim().toLowerCase()) {
    return { ok: false, error: "cannot_invite_self" };
  }

  const { data: existing, error: existingError } = await supabase
    .from("invites")
    .select("id")
    .eq("email", normalized)
    .eq("child_id", childId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .limit(1);
  if (existingError) return { ok: false, error: "invite_lookup_failed" };
  if (existing && existing.length > 0) {
    return { ok: false, error: "duplicate_pending_invite" };
  }

  const { count, error: countError } = await supabase
    .from("invites")
    .select("id", { count: "exact", head: true })
    .eq("invited_by_user_id", user.id)
    .eq("status", "pending")
    .gt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  if (countError) return { ok: false, error: "invite_lookup_failed" };
  if ((count ?? 0) >= MAX_PENDING_INVITES_PER_DAY) {
    return { ok: false, error: "rate_limit_exceeded" };
  }

  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data: invite, error: insertError } = await supabase
    .from("invites")
    .insert({
      email: normalized,
      role: "child",
      child_id: childId,
      invited_by_user_id: user.id,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("token")
    .single();
  if (insertError || !invite?.token) {
    return { ok: false, error: "invite_create_failed" };
  }

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const verifyUrl = `${proto}://${host}/verify-invite?token=${invite.token}`;

  // TODO(email): no transactional email provider is wired up yet. Send
  // verifyUrl to the child's address via Resend (or a Supabase Edge
  // Function) here before returning, and surface delivery failures as
  // { ok: false, error: "email_send_failed" }. Until then the caller must
  // deliver the link out-of-band.
  return { ok: true, verifyUrl };
}

export type AcceptInviteResult = { ok: true } | { ok: false; error: string };

/**
 * Child action: accept a child invite AFTER proving email ownership by
 * signing in with the invited address (magic-link / OAuth both resolve the
 * auth email, and magic-link issuance proves ownership of that address).
 *
 * The consume_invite RPC is the anti-abuse gate: it raises
 * invite_email_mismatch (fail-closed, case-insensitive) when the signed-in
 * email differs from the invite email. Errors are mapped to friendly
 * messages here; the RPC remains the single source of truth.
 */
export async function acceptInvite(token: string): Promise<AcceptInviteResult> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "invalid_invite" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_signed_in" };

  const { data: childId, error } = await supabase.rpc("consume_invite", {
    p_token: trimmed,
  });

  if (error) {
    const code = error.message;
    if (code.includes("invite_not_found_or_expired")) {
      return { ok: false, error: "This invite link is invalid or has expired." };
    }
    if (code.includes("invite_email_mismatch")) {
      return {
        ok: false,
        error: "This invite was sent to a different email address.",
      };
    }
    if (code.includes("already_provisioned")) {
      return {
        ok: false,
        error: "This account already has access — you're all set.",
      };
    }
    if (code.includes("role_conflict_requires_admin")) {
      return {
        ok: false,
        error: "This account can't hold both roles. Please contact support.",
      };
    }
    return { ok: false, error: "Something went wrong accepting the invite." };
  }

  if (childId) await setActiveChild(childId as string);
  redirect("/");
}

/**
 * Child action (18+): graduate to an independent account. The
 * graduate_child_access RPC (migration 015) enforces the age check
 * (>=18 via children.date_of_birth), removes parent access rows, and
 * promotes the child to the parent role. Caller must hold role='child'
 * on childId — parents and non-members are rejected before the RPC.
 */
export async function graduateToIndependence(childId: string): Promise<void> {
  const memberships = await getMemberships();
  const isChild = memberships.some(
    (m) => m.child_id === childId && m.role === "child",
  );
  if (!isChild) throw new Error("not_a_child_member");

  const supabase = await createClient();
  const { error } = await supabase.rpc("graduate_child_access", {
    p_child_id: childId,
  });
  if (error) throw new Error(error.message);

  await clearActiveChild();
  redirect("/?graduated=1");
}
