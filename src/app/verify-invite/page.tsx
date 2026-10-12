import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { PookieOrb } from "@/components/pookie-orb";
import { AcceptInviteButton } from "./accept-button";

export const dynamic = "force-dynamic";

/**
 * Post-054 (CRITICAL-1) preview shape: validity + inviting adult only.
 * Never carries child identity or the invited email.
 */
interface InvitePreview {
  valid: boolean;
  expired: boolean;
  used: boolean;
  inviter_name: string | null;
  inviter_email: string | null;
  // Legacy pre-054 fields: present only until 054 applies live. Used as a
  // fallback so this page keeps working across the DB apply boundary.
  child_id?: string;
  invite_email?: string;
  child_first_name?: string;
  child_nickname?: string | null;
  expires_at?: string;
}

/**
 * Post-054 post-auth enrichment: child fields only when the caller's auth
 * email matches the invite (email-ownership proof, enforced in SQL).
 * Zero rows when unauthenticated, unknown token, or email mismatch.
 */
interface InviteDetail {
  child_id: string;
  invite_email: string;
  child_first_name: string;
  child_nickname: string | null;
  expires_at: string;
}

interface InviteIdentity {
  child_id: string;
  invite_email: string;
  child_first_name: string;
  child_nickname: string | null;
}

/**
 * Public invite landing: /verify-invite?token=xxx
 *
 * No login is required to VIEW this page. The invite token is an
 * unguessable capability. CRITICAL-1 (FR-AUTH-009/NFR-PRIVACY-005): pre-auth
 * viewers learn validity + the inviting adult's display name ONLY — never
 * the child's name, never the invited email. Child identity comes from
 * get_invite_detail(), which the DB gates on email ownership.
 *
 * The anti-abuse gate is two-layered:
 *  1. Accept is only shown after sign-in, and the detail RPC returns rows
 *     only when the signed-in email matches the invite.
 *  2. consume_invite() (SECURITY DEFINER) re-checks the email match
 *     server-side, case-insensitively, and is the final authority — a
 *     parent cannot accept on the child's behalf, and the UI check can't
 *     be bypassed because the RPC check is independent of it.
 */
export default async function VerifyInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error: inviteError } = await searchParams;
  const supabase = await createClient();

  let preview: InvitePreview | null = null;
  if (token) {
    const { data } = await supabase.rpc("get_invite_preview", {
      p_token: token,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) preview = row as InvitePreview;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Post-auth enrichment (054). Pre-054 the preview row itself carried the
  // identity fields — detect that legacy shape and use it as the fallback
  // so the page works on both sides of the live DB apply.
  let detail: InviteDetail | null = null;
  const legacyIdentity: InviteIdentity | null =
    preview && preview.child_id && preview.invite_email
      ? {
          child_id: preview.child_id,
          invite_email: preview.invite_email,
          child_first_name: preview.child_first_name ?? "",
          child_nickname: preview.child_nickname ?? null,
        }
      : null;
  if (user && token && preview?.valid && !legacyIdentity) {
    const { data } = await supabase.rpc("get_invite_detail", {
      p_token: token,
    });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) detail = row as InviteDetail;
  }
  const identity: InviteIdentity | null = legacyIdentity ?? detail;

  const childName =
    user && identity
      ? (identity.child_nickname ?? identity.child_first_name) || null
      : null;
  // Pre-auth: the inviting adult's display name only — never their email,
  // and never anything about the child (CRITICAL-1).
  const preAuthInviter = preview?.inviter_name ?? "your parent";

  let state: "invalid" | "signin" | "mismatch" | "ready" | "joined" = "invalid";
  if (preview?.valid) {
    if (!user) {
      state = "signin";
    } else if (!identity) {
      // Valid token, signed in, but the detail RPC returned no rows: the
      // signed-in email does not own this invite (054 gates on match).
      state = "mismatch";
    } else {
      const memberships = await getMemberships();
      if (memberships.some((m) => m.child_id === identity.child_id)) {
        state = "joined";
      } else if (
        // Legacy path only: the detail RPC already proves ownership.
        legacyIdentity &&
        (!user.email ||
          user.email.trim().toLowerCase() !==
            identity.invite_email.toLowerCase())
      ) {
        state = "mismatch";
      } else {
        state = "ready";
      }
    }
  }

  if (state === "joined") redirect("/");

  const returnUrl = `/verify-invite?token=${encodeURIComponent(token ?? "")}`;
  const invitedEmail = identity?.invite_email ?? null;

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-nebula-950">
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 items-center px-6 py-16">
        <div className="card-living mx-auto w-full rounded-3xl p-8 text-center">
          <div className="mx-auto flex w-fit">
            <PookieOrb size={72} />
          </div>

          {state === "invalid" && (
            <>
              <h1 className="mt-5 text-xl font-semibold text-star-100">
                This invite link isn&apos;t valid
              </h1>
              <p className="mt-2 text-sm text-stardust-300">
                It may have expired or already been used. Ask your parent to
                send a fresh invite.
              </p>
            </>
          )}

          {inviteError === "underage" && state !== "invalid" && (
            <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-stardust-200">
              Pookie accounts are for ages 13 and up. A parent or guardian
              can create a family profile for you instead.
            </div>
          )}

          {state !== "invalid" && (
            <>
              <h1 className="mt-5 text-xl font-semibold text-star-100">
                You&apos;re invited!
              </h1>
              {user ? (
                <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                  {preAuthInviter} invited you to join{" "}
                  <span className="font-medium text-star-100">
                    {childName ?? "their family"}
                  </span>{" "}
                  on Pookie.
                </p>
              ) : (
                <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                  {preAuthInviter} invited you to join their family on Pookie.
                  Sign in to see the invite details.
                </p>
              )}

              {state === "signin" && (
                <a
                  href={`/login?next=${encodeURIComponent(returnUrl)}`}
                  className="mt-6 inline-block rounded-2xl bg-nova-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Sign in to accept
                </a>
              )}

              {state === "mismatch" && (
                <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-stardust-200">
                  This invite was sent to a different email address.
                  {invitedEmail ? (
                    <> Sign in with {invitedEmail} to accept it.</>
                  ) : (
                    <> Sign in with the email address the invite was sent to.</>
                  )}
                  <a
                    href={`/login?next=${encodeURIComponent(returnUrl)}`}
                    className="mt-3 block font-medium text-nova-300 underline"
                  >
                    Sign in with a different account
                  </a>
                </div>
              )}

              {state === "ready" && (
                <div className="mt-6">
                  <p className="mb-4 text-xs text-stardust-300">
                    Signed in as {user!.email}
                  </p>
                  <AcceptInviteButton token={token!} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
