// Nudge feed — "Overnight by Pookie".
// Renders what the background AI noticed, drafted, or handled while the
// pilot was away. Every item is plain English with, at most, one tap.
// No blank panels: loading, error, and empty states all say something.

"use client";

import { useCallback, useEffect, useState } from "react";
import { openApplet } from "@/lib/applet-bus";
import type { Nudge, NudgeTier } from "@/lib/automation/types";

type LoadState = "loading" | "ready" | "error";

async function actOnNudge(nudge: Nudge): Promise<void> {
  // Execute the nudge's one-tap action, then record it as acted.
  if (nudge.action?.kind === "bill.mark-paid" && nudge.action.params.billId) {
    await fetch(`/api/v1/household/bills/${nudge.action.params.billId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid" }),
    });
  }
  if (nudge.action?.kind === "layout.open-module" && nudge.action.params.moduleId) {
    openApplet(nudge.action.params.moduleId);
  }
  await fetch("/api/v1/me/nudges", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: nudge.id, status: "acted" }),
  });
}

async function dismissNudge(nudge: Nudge): Promise<void> {
  await fetch("/api/v1/me/nudges", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: nudge.id, status: "dismissed" }),
  });
}

function tierAccent(tier: NudgeTier): string {
  if (tier === "banner") return "hull-amber";
  if (tier === "feed") return "hull-cyan";
  return "";
}

export function NudgeFeed() {
  const [state, setState] = useState<LoadState>("loading");
  const [nudges, setNudges] = useState<Nudge[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/me/nudges");
        const json = (await res.json()) as {
          ok?: boolean;
          data?: { nudges?: Nudge[] };
        };
        if (!json.ok || !Array.isArray(json.data?.nudges)) throw new Error("bad shape");
        if (!cancelled) {
          setNudges(json.data.nudges);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback((id: string | undefined) => {
    setNudges((prev) => prev.filter((n) => n.id !== id));
  }, []);

  if (state === "loading") {
    return (
      <div className="hull-panel animate-bloom mt-6 p-4" style={{ animationDelay: "0.16s" }}>
        <p className="hull-readout text-sm text-hull-text-dim">Checking what Pookie handled overnight…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="hull-panel animate-bloom mt-6 p-4" style={{ animationDelay: "0.16s" }}>
        <p className="hull-title">Overnight by Pookie</p>
        <p className="hull-readout mt-1 text-sm text-hull-text-dim">
          Pookie&apos;s overnight check didn&apos;t run — your data is still here.
        </p>
      </div>
    );
  }

  if (nudges.length === 0) {
    return (
      <div className="hull-panel hull-green animate-bloom mt-6 p-4" style={{ animationDelay: "0.16s" }}>
        <p className="hull-title">Overnight by Pookie</p>
        <p className="hull-readout mt-1 text-sm text-neon-green">
          All quiet — Pookie checked overnight and found nothing needing you.
        </p>
      </div>
    );
  }

  return (
    <div className="hull-panel hull-panel-accent hull-cyan animate-bloom mt-6 p-4" style={{ animationDelay: "0.16s" }}>
      <p className="hull-title">Overnight by Pookie</p>
      <ul className="mt-3 space-y-3">
        {nudges.map((nudge) => (
          <li key={nudge.id} className={`hull-panel ${tierAccent(nudge.tier)} p-3`}>
            <p className="text-sm font-medium text-hull-text">{nudge.title}</p>
            <p className="hull-readout mt-1 text-sm text-hull-text-dim">{nudge.detail}</p>
            <div className="mt-2 flex items-center gap-2">
              {nudge.action && (
                <button
                  type="button"
                  className="rounded border border-neon-cyan/40 px-3 py-1.5 text-xs font-medium text-neon-cyan"
                  onClick={() =>
                    actOnNudge(nudge)
                      .then(() => remove(nudge.id))
                      .catch(() => {})
                  }
                >
                  {nudge.action.label}
                </button>
              )}
              <button
                type="button"
                className="rounded border border-hull-text-dim/30 px-3 py-1.5 text-xs text-hull-text-dim"
                onClick={() =>
                  dismissNudge(nudge)
                    .then(() => remove(nudge.id))
                    .catch(() => {})
                }
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
