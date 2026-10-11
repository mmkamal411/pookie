"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_CHILD_COOKIE,
  type TenantMembership,
  type TenantRole,
} from "./types";

/**
 * The logged-in user's tenant memberships, resolved from child_access.
 * This is the single source of truth for "which children can this user see".
 */
export async function getMemberships(): Promise<TenantMembership[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

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
