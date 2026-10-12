"use client";

import { useCallback, useEffect, useState } from "react";
import { NebulaBackground } from "@/components/nebula-background";
import { PookieOrb } from "@/components/pookie-orb";

interface Claim {
  id: string;
  status: string;
  approver: "parent_a" | "teen" | null;
  created_at: string;
  decided_at: string | null;
  escalated: boolean;
  child_name?: string;
}

function claimAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * Incoming-claims inbox (FR-AUTH-011, D5 open signup).
 *
 * Lists the claims routed to the CALLER for a decision — Parent A sees the
 * under-13 queue, the teen sees their own 13+ queue. Each claim shows when it
 * arrived (plus an escalation flag past 14 days) with Approve / Reject.
 * Approving connects them right away; rejecting locks re-requests for 30
 * days. No one is ever connected automatically. The claimant's form data
 * (name/DOB/email) is never re-displayed.
 */
export function ClaimsInbox() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/family/claims/incoming");
      const json = (await res.json()) as { ok: boolean; data?: { claims: Claim[] } };
      if (!res.ok || !json.ok) throw new Error("load_failed");
      setClaims(json.data?.claims ?? []);
    } catch {
      setError("Couldn't load the requests — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(claimId: string, decision: "approved" | "rejected") {
    setBusy(claimId);
    setError(null);
    try {
      const res = await fetch(`/api/v1/family/claims/${claimId}/decide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error("decide_failed");
      await load();
    } catch {
      setError("Couldn't record that decision — try again in a moment.");
    } finally {
      setBusy(null);
    }
  }

  const groups = new Map<string, Claim[]>();
  for (const c of claims) {
    const key = c.child_name ?? "your family";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden bg-nebula-950">
      <NebulaBackground />
      <div className="relative z-10 mx-auto w-full max-w-2xl px-6 py-12">
        <div className="flex items-center gap-3">
          <PookieOrb size={40} />
          <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
            Family requests
          </p>
        </div>
        <h1 className="text-sunlit mt-4 text-3xl font-semibold tracking-tight">
          Requests to connect
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-stardust-300">
          Someone asked to link as a parent. Approving connects them right away;
          rejecting is final for 30 days. No one is ever connected automatically.
        </p>

        {loading ? (
          <p className="animate-pulse mt-8 text-sm text-stardust-300">Loading requests…</p>
        ) : claims.length === 0 ? (
          <div className="card-living mt-8 rounded-3xl border border-nova-400/20 px-5 py-6 text-center">
            <p className="text-sm font-medium text-star-100">Nothing waiting</p>
            <p className="mt-1 text-xs text-stardust-300">
              New requests from a second parent will show up here for your review.
            </p>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {[...groups.entries()].map(([childName, group]) => (
              <section key={childName}>
                <h2 className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
                  For {childName}
                </h2>
                <div className="mt-3 space-y-3">
                  {group.map((claim) => (
                    <div
                      key={claim.id}
                      className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-star-100">
                            Parent connection request
                          </p>
                          <p className="mt-0.5 text-xs text-stardust-300">
                            Sent {claimAge(claim.created_at)}
                            {claim.escalated && (
                              <span className="ml-2 rounded-full border border-aurum-400/40 px-2 py-0.5 text-[10px] font-semibold text-aurum-300">
                                Waiting 14+ days — needs review
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-stardust-300">
                        {claim.approver === "teen"
                          ? "This person says they're your other parent and wants to connect. Only you can approve this."
                          : `This person says they're ${childName}'s other parent and wants to connect. As the parent on record, you decide.`}
                      </p>
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => decide(claim.id, "approved")}
                          disabled={busy !== null}
                          className="btn-dapple rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
                        >
                          {busy === claim.id ? "Saving…" : "Approve"}
                        </button>
                        <button
                          type="button"
                          onClick={() => decide(claim.id, "rejected")}
                          disabled={busy !== null}
                          className="rounded-2xl border border-red-400/30 px-5 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
      </div>
    </main>
  );
}
