"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { NebulaBackground } from "@/components/nebula-background";
import { PookieOrb } from "@/components/pookie-orb";

/**
 * Invite-from-inside: Parent A picks a child → gets a deep link + QR for
 * Parent B. The token is unguessable and single-use; the link itself is the
 * only thing that leaves this screen. Show it to the other parent in person
 * or send it through a channel you trust.
 */
export function InviteGenerator({
  children,
}: {
  children: Array<{ child_id: string; name: string }>;
}) {
  const [childId, setChildId] = useState(children[0]?.child_id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ token: string; expires_at: string } | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const deepLink =
    invite && typeof window !== "undefined"
      ? `${window.location.origin}/family/invite/accept?token=${invite.token}`
      : "";

  async function generate() {
    if (!childId) return;
    setBusy(true);
    setError(null);
    setQrUrl(null);
    try {
      const res = await fetch("/api/v1/family/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ child_id: childId }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        data?: { token: string; expires_at: string };
        error?: { message?: string };
      };
      if (!res.ok || !json.ok || !json.data) {
        throw new Error(json.error?.message ?? "generate_failed");
      }
      setInvite(json.data);
      const origin = window.location.origin;
      const url = await QRCode.toDataURL(
        `${origin}/family/invite/accept?token=${json.data.token}`,
        { margin: 2, width: 240 },
      );
      setQrUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the invite — try again.");
    } finally {
      setBusy(false);
    }
  }

  function copyLink() {
    if (!deepLink) return;
    void navigator.clipboard?.writeText(deepLink).then(
      () => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      },
      () => setCopied(false),
    );
  }

  const childName = children.find((c) => c.child_id === childId)?.name ?? "your child";
  const expiry = invite
    ? new Date(invite.expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "";

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-nebula-950">
      <NebulaBackground />
      <div className="relative z-10 mx-auto w-full max-w-lg px-6 py-12">
        <div className="flex items-center gap-3">
          <PookieOrb size={40} />
          <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
            Invite a co-parent
          </p>
        </div>
        <h1 className="text-sunlit mt-4 text-3xl font-semibold tracking-tight">
          Bring the other parent in
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
          Generate a private invite link for {children.length > 1 ? "one of your children" : childName}.
          They sign up (or sign in), open the link, and accept — you&apos;ll both be
          linked as parents. The link works once and expires {expiry || "in 7 days"}.
        </p>

        {children.length === 0 ? (
          <p className="card-living mt-6 rounded-2xl px-5 py-4 text-sm text-stardust-300">
            No eligible children right now. Invites are only available where
            self-serve linking applies.
          </p>
        ) : (
          <div className="card-living animate-rise mt-6 rounded-3xl border border-nova-400/20 p-5">
            {children.length > 1 && (
              <label className="block text-xs text-stardust-300">
                Child
                <select
                  value={childId}
                  onChange={(e) => {
                    setChildId(e.target.value);
                    setInvite(null);
                    setQrUrl(null);
                  }}
                  className="input-rooted mt-1 block w-full rounded-xl px-3 py-2 text-sm"
                >
                  {children.map((c) => (
                    <option key={c.child_id} value={c.child_id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {!invite ? (
              <button
                type="button"
                onClick={generate}
                disabled={busy || !childId}
                className="btn-dapple mt-2 w-full rounded-2xl px-6 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
              >
                {busy ? "Creating…" : `Create invite${children.length === 1 ? ` for ${childName}` : ""}`}
              </button>
            ) : (
              <div className="animate-rise mt-2">
                {qrUrl && (
                  <div className="flex justify-center rounded-2xl bg-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="Invite QR code" width={240} height={240} />
                  </div>
                )}
                <p className="mt-3 text-xs text-stardust-300">
                  Or share the link — it opens Pookie and walks them through accepting:
                </p>
                <p className="mt-1 break-all rounded-2xl border border-nova-400/20 bg-nebula-800/60 px-4 py-3 font-mono text-[11px] text-nova-300">
                  {deepLink}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={copyLink}
                    className="btn-dapple flex-1 rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950"
                  >
                    {copied ? "Copied ✓" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInvite(null);
                      setQrUrl(null);
                    }}
                    className="rounded-2xl border border-stardust-500/30 px-5 py-2 text-sm font-medium text-stardust-300"
                  >
                    New invite
                  </button>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-stardust-500">
                  Single use, expires {expiry}. Show it to the other parent in
                  person or send it through a channel you trust — anyone with
                  this link can request parent access.
                </p>
              </div>
            )}
            {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          </div>
        )}
      </div>
    </main>
  );
}
