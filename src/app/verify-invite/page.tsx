import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { PookieOrb } from "@/components/pookie-orb";
import { AcceptInviteButton } from "./accept-button";

export const dynamic = "force-dynamic";

interface InvitePreview {
  child_id: string;
  invite_email: string;
  child_first_name: string;
  child_nickname: string | null;
  inviter_name: string | null;
  inviter_email: string | null;
  expires_at: string;
}

/**
 * Public invite landing: /verify-invite?token=xxx
 *
 * No login is required to VIEW this page. The invite token is an
 * unguessable capability, and the preview RPC discloses only identity
 * fields (who invited whom) — no grades, no access rows.
 *
 * The anti-abuse gate is two-layered:
 *  1. Accept is only shown after sign-in, and the Accept button warns when
 *     the signed-in email doesn't match the invited email.
 *  2. consume_invite() (SECURITY DEFINER) re-checks the email match
 *     server-side, case-insensitively, and is the final authority — a
 *     parent cannot accept on the child's behalf, and the UI check can't
 *     be bypassed because the RPC check is independent of it.
 */
export default async function VerifyInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
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

  const childName = preview
    ? preview.child_nickname ?? preview.child_first_name
    : null;
  const inviterLabel =
    preview?.inviter_name ?? preview?.inviter_email ?? "your parent";

  let state: "invalid" | "signin" | "mismatch" | "ready" | "joined" = "invalid";
  if (preview) {
    if (!user) {
      state = "signin";
    } else {
      const memberships = await getMemberships();
      if (memberships.some((m) => m.child_id === preview.child_id)) {
        state = "joined";
      } else if (
        user.email &&
        user.email.trim().toLowerCase() === preview.invite_email.toLowerCase()
      ) {
        state = "ready";
      } else {
        state = "mismatch";
      }
    }
  }

  if (state === "joined") redirect("/");

  const returnUrl = `/verify-invite?token=${encodeURIComponent(token ?? "")}`;

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

          {state !== "invalid" && (
            <>
              <h1 className="mt-5 text-xl font-semibold text-star-100">
                You&apos;re invited!
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                {inviterLabel} invited{" "}
                <span className="font-medium text-star-100">
                  {preview!.invite_email}
                </span>{" "}
                to join {childName}&apos;s family on Pookie.
              </p>

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
                  This invite was sent to a different email address. Sign in
                  with {preview!.invite_email} to accept it.
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
