"use client";

// Settings -> Sharing -> Health. Per-tier, per-parent toggles for the adult
// user (the teen, the 18+ adult, or the steward parent under 13). Includes
// the "hide my past too" FERPA lever and the "who has looked" audit.
// Contract: docs/solutions/sol-health.md sections 1.6, 2.3, 3.1, 3.2.

import { useCallback, useEffect, useState } from "react";
import {
  getHealthGrants,
  setHealthGrant,
  hidePastHealth,
  getHealthAudit,
  requestHealthDeletion,
} from "@/lib/health/actions";
import type { HealthAuditEvent, HealthContext, HealthGrantState } from "@/lib/health/types";
import { TIER_DESCRIPTIONS, COPY } from "@/lib/health/types";
import {
  HealthToggle,
  TierBadge,
  CollapseRow,
  BackendNotReady,
  ActionError,
} from "./ui";

function formatDay(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function SharingHealthView({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [grants, setGrants] = useState<HealthGrantState[]>([]);
  const [audit, setAudit] = useState<HealthAuditEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [confirmHide, setConfirmHide] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [g, a] = await Promise.all([getHealthGrants(childId), getHealthAudit(childId)]);
    setLoading(false);
    if (!g.ok) {
      if (g.code !== "backend_not_ready") setError(g.message);
      return;
    }
    setGrants(g.data);
    if (a.ok) setAudit(a.data.events);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  async function flip(granteeUserId: string, tier: "H1" | "H2", next: boolean) {
    const key = `${granteeUserId}:${tier}`;
    setBusyKey(key);
    setError(null);
    const res = await setHealthGrant(childId, { granteeUserId, tier, enabled: next });
    setBusyKey(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    load();
  }

  async function doHidePast() {
    setError(null);
    const res = await hidePastHealth(childId);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setConfirmHide(false);
    load();
  }

  async function doDeleteAll() {
    setError(null);
    const res = await requestHealthDeletion(childId, { kind: "all" });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setConfirmDelete(false);
    load();
  }

  const canHidePast = ctx.isSubject && ctx.band !== "under13" && ctx.band !== "unknown";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-star-100">Who Can See My Health Stuff?</h2>
        <p className="mt-1 text-sm text-stardust-300">
          You decide. Change anything, anytime. Pookie never tells anyone when you change a setting
          here.
        </p>
      </div>

      {!ctx.schemaReady && !loading ? (
        <BackendNotReady feature="Health sharing" />
      ) : (
        <>
          {error && <ActionError message={error} onDismiss={() => setError(null)} />}
          {loading && <p className="text-xs text-stardust-500">Loading.</p>}

          {!loading && grants.length === 0 && (
            <p className="text-sm text-stardust-500">No linked parents found.</p>
          )}

          {grants.map((g) => (
            <div key={g.granteeUserId} className="card-living rounded-3xl px-5 py-2">
              <CollapseRow
                title={g.granteeLabel}
                badge={
                  <span className="text-xs text-stardust-500">
                    {g.h1 || g.h2 ? (
                      <>Sees: {[g.h1 && "Everyday wellness", g.h2 && "Private health"].filter(Boolean).join(" · ")}</>
                    ) : (
                      "Sees nothing right now"
                    )}
                  </span>
                }
              >
                <div className="divide-y divide-nova-400/10">
                  <HealthToggle
                    checked={g.h1}
                    disabled={busyKey != null}
                    onChange={(n) => flip(g.granteeUserId, "H1", n)}
                    label="Everyday wellness"
                    description={TIER_DESCRIPTIONS.H1}
                  />
                  <HealthToggle
                    checked={g.h2}
                    disabled={busyKey != null}
                    onChange={(n) => flip(g.granteeUserId, "H2", n)}
                    label="Private health"
                    description="Weight, medications, allergies, doctor notes, food diary. Off unless you choose it."
                  />
                </div>
                <div className="mt-3 rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3">
                  <TierBadge tier="H3" />
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    {TIER_DESCRIPTIONS.H3}
                  </p>
                </div>
                {g.graceUntil && (
                  <p className="mt-3 text-xs leading-relaxed text-stardust-300">
                    {g.granteeLabel} can still see records from before the change until{" "}
                    {formatDay(g.graceUntil)}. Nothing new goes to them.
                  </p>
                )}
                <p className="mt-3 text-xs leading-relaxed text-stardust-500">{COPY.h3FirewallParent}</p>
              </CollapseRow>
            </div>
          ))}

          {canHidePast && (
            <div className="card-living rounded-3xl p-5">
              <h3 className="text-sm font-semibold text-star-100">Hide My Past Health Data Too</h3>
              {!confirmHide ? (
                <>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    This ends the 30-day lookback right away. Your parents keep nothing new, and the
                    old window closes now.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmHide(true)}
                    className="mt-3 rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm font-medium text-stardust-300 hover:text-star-100"
                  >
                    Hide My Past Health Data Too
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">{COPY.hidePastConfirm}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={doHidePast}
                      className="rounded-xl bg-nova-500 px-4 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
                    >
                      Yes, hide it now
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmHide(false)}
                      className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm text-stardust-300"
                    >
                      Keep as is
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="card-living rounded-3xl px-5 py-2">
            <CollapseRow title="Who has looked at my health info">
              {audit.length === 0 && (
                <p className="text-xs text-stardust-500">No sharing changes recorded yet.</p>
              )}
              <ul className="divide-y divide-nova-400/10">
                {audit.map((e) => (
                  <li key={e.id} className="py-2.5">
                    <p className="text-sm text-star-100">{e.summary}</p>
                    <p className="mt-0.5 text-xs text-stardust-500">
                      {e.actorLabel} · {formatDay(e.at)}
                    </p>
                  </li>
                ))}
              </ul>
            </CollapseRow>
          </div>

          {ctx.isSubject && (
            <div className="card-living rounded-3xl p-5">
              <h3 className="text-sm font-semibold text-star-100">Delete My Health Data</h3>
              {!confirmDelete ? (
                <>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    Ask Pookie to delete your health records. Deletion is honored within 30 days.
                    This cannot be undone.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="mt-3 rounded-xl border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/10"
                  >
                    Delete My Health Data
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    This asks Pookie to delete all of your health records within 30 days. There is no
                    undo.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={doDeleteAll}
                      className="rounded-xl border border-red-400/40 bg-red-400/10 px-4 py-2.5 text-sm font-semibold text-red-200"
                    >
                      Yes, delete everything
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm text-stardust-300"
                    >
                      Keep my data
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
