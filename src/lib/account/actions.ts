"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Self-service deletion server actions (migration 063).
 *
 * SAFETY — the never-event: a user must NEVER delete another user's data.
 * Every action below derives the user ID EXCLUSIVELY from the session
 * (supabase.auth.getUser()). No action accepts a user ID parameter — there
 * is nothing for a caller to spoof. The RPCs re-derive auth.uid() from the
 * JWT server-side and scope every write with WHERE <col> = auth.uid().
 * A null/missing session aborts BEFORE any database call (fail-closed).
 *
 * The childId in removeChild is a *selector*, not an identity: the RPC
 * verifies ownership (parent_user_id = auth.uid() OR parent grant) and
 * raises not_child_owner otherwise.
 */

export type DeletionResult =
  | { ok: true; permanentDeleteAfter: string; childrenMarked?: number }
  | { ok: false; error: string };

export type ChildDeletionResult =
  | {
      ok: true;
      mode: "deletion_scheduled" | "access_removed";
      childFirstName: string;
      permanentDeleteAfter?: string;
      reason?: string;
    }
  | { ok: false; error: string };

type RpcRow = {
  permanent_delete_after?: string;
  already_requested?: boolean;
  children_marked?: number;
  mode?: "deletion_scheduled" | "access_removed";
  child_first_name?: string;
  reason?: string;
};

/** Fail-closed session guard. Returns the user ID or null. */
async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Request account deletion (soft-delete, 30-day grace).
 * Takes NO arguments — the account deleted is always the caller's.
 */
export async function requestAccountDeletion(): Promise<DeletionResult> {
  const uid = await sessionUserId();
  if (!uid) return { ok: false, error: "not_signed_in" };

  const supabase = await createClient();
  // The RPC takes no user ID: it deletes auth.uid() and nothing else.
  const { data, error } = await supabase.rpc("request_account_deletion");
  if (error) return { ok: false, error: "deletion_failed" };

  const row = data as RpcRow | null;
  const purgeDate = row?.permanent_delete_after ?? "";

  // Sessions are revoked: the account is hidden from UI immediately.
  await supabase.auth.signOut();
  redirect(
    `/login?fresh=1&purgeDate=${encodeURIComponent(purgeDate)}`
  );
}

/**
 * Cancel a pending account deletion (grace-period recovery).
 * Scoped by the RPC to the caller's own rows — user A cannot cancel
 * user B's deletion.
 */
export async function cancelAccountDeletion(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const uid = await sessionUserId();
  if (!uid) return { ok: false, error: "not_signed_in" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_account_deletion");
  if (error) {
    const code = error.message.includes("no_deletion_pending")
      ? "no_deletion_pending"
      : "cancel_failed";
    return { ok: false, error: code };
  }
  return { ok: true };
}

/**
 * Request child deletion (soft-delete, 30-day grace) or, when the child
 * has independent holders, remove only the caller's access.
 * childId is a selector; ownership is verified server-side via the session.
 */
export async function requestChildDeletion(
  childId: string
): Promise<ChildDeletionResult> {
  const uid = await sessionUserId();
  if (!uid) return { ok: false, error: "not_signed_in" };
  if (!childId) return { ok: false, error: "child_id_required" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_child_deletion", {
    p_child_id: childId,
  });
  if (error) {
    const code = error.message.includes("not_child_owner")
      ? "not_child_owner"
      : "deletion_failed";
    return { ok: false, error: code };
  }

  const row = data as RpcRow | null;
  return {
    ok: true,
    mode: row?.mode ?? "deletion_scheduled",
    childFirstName: row?.child_first_name ?? "your child",
    permanentDeleteAfter: row?.permanent_delete_after,
    reason: row?.reason,
  };
}

/**
 * Cancel a pending child deletion. Scoped by the RPC to caller-owned
 * children in deletion-pending state.
 */
export async function cancelChildDeletion(
  childId: string
): Promise<{ ok: boolean; error?: string }> {
  const uid = await sessionUserId();
  if (!uid) return { ok: false, error: "not_signed_in" };
  if (!childId) return { ok: false, error: "child_id_required" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_child_deletion", {
    p_child_id: childId,
  });
  if (error) {
    const code = error.message.includes("no_deletion_pending")
      ? "no_deletion_pending"
      : "cancel_failed";
    return { ok: false, error: code };
  }
  return { ok: true };
}

/**
 * Read-only: is the CALLER's account pending deletion? Used by the root
 * router to show the recovery page instead of the app.
 */
export async function getAccountDeletionStatus(): Promise<{
  pending: boolean;
  permanentDeleteAfter?: string;
} | null> {
  const uid = await sessionUserId();
  if (!uid) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("permanent_delete_after")
    .eq("id", uid)
    .maybeSingle();
  const row = data as { permanent_delete_after?: string } | null;
  if (!row?.permanent_delete_after) return { pending: false };
  return {
    pending: true,
    permanentDeleteAfter: row.permanent_delete_after,
  };
}
