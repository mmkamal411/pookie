"use client";

// W2 — Health hub. Vitals dashboard with provenance labels, persistent
// "not a medical device" footer, tier-badged sections.
// Contract: docs/solutions/sol-health.md section 4.

import { useCallback, useEffect, useState } from "react";
import { getHealthHub, disconnectDeviceSync } from "@/lib/health/actions";
import type { HealthContext, HealthHubData, HealthTier } from "@/lib/health/types";
import { TIER_DESCRIPTIONS, COPY, provenanceLabel } from "@/lib/health/types";
import {
  TierBadge,
  ProvenanceLine,
  MedicalDisclaimerHeader,
  MedicalDisclaimerFooter,
  HealthPageHeader,
  CollapseRow,
  BackendNotReady,
  ActionError,
} from "./ui";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function DeviceSyncCard({
  childId,
  state,
  onChanged,
}: {
  childId: string;
  state: NonNullable<HealthHubData["deviceSync"]>;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function disconnect() {
    setBusy(true);
    setError(null);
    const res = await disconnectDeviceSync(childId);
    setBusy(false);
    if (!res.ok) setError(res.message);
    else onChanged();
  }

  return (
    <div className="card-living rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-star-100">
            <span aria-hidden="true">🔒</span> Health app connection
          </p>
          {/* WINDOW-NOT-VAULT: device data never leaves the phone. */}
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">
            Your health app data stays on your phone. Pookie reads it there and
            shows it to you — nothing is ever uploaded to our servers. Not even
            we can see it.
          </p>
          <p className="mt-2 text-xs text-stardust-500">
            {state.status === "connected" &&
              `On-device access${state.deviceName ? `, ${state.deviceName}` : ""}. Read locally, never uploaded.`}
            {state.status === "never_connected" && "No health app connected yet."}
            {state.status === "disconnected" && "Disconnected."}
            {state.status === "suspended_pending_reauth" &&
              "Paused. Reconnect it here after the privacy review to resume."}
          </p>
        </div>
      </div>
      {error && (
        <div className="mt-3">
          <ActionError message={error} onDismiss={() => setError(null)} />
        </div>
      )}
      <div className="mt-3">
        {state.status !== "connected" ? (
          <p className="rounded-xl border border-nova-400/20 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
            To connect: open Pookie on your phone, open Health, and follow the steps there. Your
            phone asks for permission first. Data is read on your phone only — nothing
            connects from this screen, nothing uploads.
          </p>
        ) : (
          <button
            type="button"
            onClick={disconnect}
            disabled={busy}
            className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm font-medium text-stardust-300 hover:text-star-100 disabled:opacity-50"
          >
            {busy ? "Disconnecting." : "Disconnect"}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-stardust-500">
        Under 13, Pookie never connects a health app directly. Teens connect it themselves on their
        own phone. Entries you type here are separate — those you choose to share with Pookie.
      </p>
    </div>
  );
}

export function HealthHub({ childId, ctx }: { childId: string; ctx: HealthContext }) {
  const [data, setData] = useState<HealthHubData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getHealthHub(childId);
    setLoading(false);
    if (!res.ok) {
      if (res.code === "backend_not_ready") setData(null);
      else setError(res.message);
      return;
    }
    setData(res.data);
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const tierOrder: HealthTier[] = ["H1", "H2", "H3"];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      <HealthPageHeader
        eyebrow="W2 · Health"
        title="Health"
        sub="Vitals, trends, and gentle glanceables. The body you live in."
      />
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.08s" }}>
        <MedicalDisclaimerHeader />
      </div>

      {!ctx.schemaReady && !loading ? (
        <div className="mt-6">
          <BackendNotReady feature="Health" />
        </div>
      ) : (
        <div className="animate-bloom mt-6 space-y-4" style={{ animationDelay: "0.14s" }}>
          {error && <ActionError message={error} onDismiss={() => setError(null)} />}
          {loading && !data && (
            <p className="py-8 text-center text-sm text-stardust-500">Loading your health space.</p>
          )}

          {data &&
            tierOrder.map((tier) => {
              const section = data.sections.find((s) => s.tier === tier);
              if (!section || section.access === "hidden") return null;
              return (
                <div key={tier} className="card-living rounded-3xl px-5 py-2">
                  <CollapseRow
                    title={tier === "H1" ? "Everyday wellness" : tier === "H2" ? "Private health" : "Most personal"}
                    badge={
                      <>
                        <TierBadge tier={tier} />
                        {section.access === "locked" && (
                          <span className="text-xs text-stardust-500">Private</span>
                        )}
                        {section.access === "full" && section.readingCount != null && (
                          <span className="text-xs text-stardust-500">
                            {section.readingCount} readings
                          </span>
                        )}
                      </>
                    }
                  >
                    <p className="text-xs leading-relaxed text-stardust-300">{TIER_DESCRIPTIONS[tier]}</p>
                    {section.access === "locked" && (
                      <p className="mt-3 rounded-xl border border-violet-400/20 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
                        This group stays private. It opens only if {ctx.displayName} chooses to share
                        it in Sharing.
                      </p>
                    )}
                    {section.access === "full" && section.readings.length === 0 && (
                      <p className="mt-3 text-xs text-stardust-500">
                        No readings yet. Connect a health app below to start.
                      </p>
                    )}
                    {section.access === "full" && section.readings.length > 0 && (
                      <ul className="mt-3 divide-y divide-nova-400/10">
                        {section.readings.map((r) => (
                          <li key={r.id} className="py-2.5">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-sm text-star-100">{r.metricLabel}</span>
                              <span className="text-sm font-semibold text-star-100">
                                {r.value}
                                {r.unit ? <span className="ml-1 text-xs font-normal text-stardust-500">{r.unit}</span> : null}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <ProvenanceLine
                                text={provenanceLabel(r.provenance, r.deviceName, r.enteredByLabel)}
                              />
                              <span className="shrink-0 text-xs text-stardust-500">
                                {formatTime(r.recordedAt)}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-3 text-xs text-stardust-500">{COPY.medicalDisclaimerFooter}</p>
                  </CollapseRow>
                </div>
              );
            })}

          {data?.deviceSync && (
            <DeviceSyncCard childId={childId} state={data.deviceSync} onChanged={load} />
          )}
        </div>
      )}

      <MedicalDisclaimerFooter />
    </div>
  );
}
