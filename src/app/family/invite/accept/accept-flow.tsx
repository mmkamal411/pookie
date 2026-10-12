"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NebulaBackground } from "@/components/nebula-background";
import { PookieOrb } from "@/components/pookie-orb";

interface Preview {
  inviter_name: string | null;
  expires_at: string;
}

/**
 * Parent B's redeem screen. The preview discloses nothing about the child
 * (FR-AUTH-009) — just who invited you. Accept requires sign-in; the accept
 * call is single-use and fails identically for bad/expired/used tokens.
 */
export function AcceptFlow({
  token,
  preview,
  previewError,
  signedIn,
}: {
  token: string | null;
  preview: Preview | null;
  previewError: boolean;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  async function accept() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/family/invites/${encodeURIComponent(token)}/accept`,
        { method: "POST" },
      );
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
      if (!res.ok || !json.ok) throw new Error(json.error?.message ?? "accept_failed");
      setAccepted(true);
    } catch {
      setError("This invite isn't available anymore. Ask the other parent for a fresh one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen w-full overflow-hidden bg-nebula-950">
      <NebulaBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12">
        <div className="w-full">
          <div className="flex items-center gap-3">
            <PookieOrb size={48} />
            <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
              Family invite
            </p>
          </div>

          {previewError || !preview ? (
            <div className="card-living animate-rise mt-6 rounded-3xl border border-nova-400/20 p-6">
              <h1 className="text-sunlit text-2xl font-semibold">This invite isn&apos;t available</h1>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                It may have expired, already been used, or the link was copied
                wrong. Ask the other parent to generate a fresh one from their
                Family settings.
              </p>
            </div>
          ) : accepted ? (
            <div className="card-living animate-rise mt-6 rounded-3xl border border-nova-400/20 p-6">
              <h1 className="text-sunlit text-2xl font-semibold">You&apos;re linked ✓</h1>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                You&apos;re now connected as a parent. Grades, school, and
                sharing work the way your family set them up.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="btn-dapple mt-6 w-full rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950"
              >
                Go to my Pookie
              </button>
            </div>
          ) : (
            <div className="card-living animate-rise mt-6 rounded-3xl border border-nova-400/20 p-6">
              <h1 className="text-sunlit text-2xl font-semibold">You&apos;ve been invited to Pookie</h1>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                {preview.inviter_name
                  ? `${preview.inviter_name} invited you to connect as a co-parent on Pookie.`
                  : "Another parent invited you to connect as a co-parent on Pookie."}{" "}
                Accepting links you as a parent — you&apos;ll see what the family
                shares with you, under your teen&apos;s privacy settings.
              </p>
              <p className="mt-3 text-xs text-stardust-500">
                This invite is single-use
                {preview.expires_at
                  ? ` and expires ${new Date(preview.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
                  : ""}
                .
              </p>
              {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
              <div className="mt-6 flex flex-col gap-2">
                {signedIn ? (
                  <button
                    type="button"
                    onClick={accept}
                    disabled={busy}
                    className="btn-dapple w-full rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
                  >
                    {busy ? "Accepting…" : "Accept invite"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/login?next=/family/invite/accept?token=${encodeURIComponent(token ?? "")}`)
                    }
                    className="btn-dapple w-full rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950"
                  >
                    Sign in to accept
                  </button>
                )}
                <p className="text-center text-[11px] text-stardust-500">
                  {signedIn
                    ? "Accepting uses the account you're signed in with."
                    : "You'll need a Pookie account — sign in or create one, then accept."}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
