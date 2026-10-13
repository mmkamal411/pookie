"use client";

import { useEffect, useState } from "react";
import { openApplet } from "@/lib/applet-bus";
import { bannerNudges, type Nudge } from "@/lib/nudges";

/**
 * NudgeBanner — the banner lane (visual spec §7, time-critical only).
 *
 * Max ONE visible banner; the rest queue behind a quiet count dot.
 * Auto-collapses after 12s (session-only — the nudge stays in the feed);
 * the ✕ dismisses for real (PATCH dismissed, ledger-like).
 * Motion: slides down 200ms; never shifts panel layout (overlays, no reflow).
 */

async function patchNudge(id: string | undefined, status: "acted" | "dismissed") {
  if (!id) return;
  try {
    await fetch("/api/v1/me/nudges", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  } catch {
    // Offline — the local hide below still keeps the UI honest.
  }
}

async function runAction(nudge: Nudge): Promise<void> {
  const action = nudge.action;
  if (!action) return;
  try {
    if (action.kind === "bill.mark-paid" && action.params.billId) {
      await fetch(`/api/v1/household/bills/${action.params.billId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
    } else if (action.kind === "task.complete" && action.params.taskId) {
      await fetch(`/api/v1/household/tasks/${action.params.taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
    } else if (action.kind === "shopping.add-item") {
      openApplet("W20");
    } else if (action.kind === "mail.confirm-draft") {
      openApplet("W21");
    } else if (action.kind === "layout.open-module" && action.params.moduleId) {
      openApplet(action.params.moduleId);
    }
  } finally {
    await patchNudge(nudge.id, "acted");
  }
}

export function NudgeBanner({ nudges }: { nudges: Nudge[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState(false);

  const queue = bannerNudges(nudges).filter((n) => !dismissed.has(n.id ?? ""));
  const current = collapsed ? null : queue[0] ?? null;

  // Auto-collapse after 12s (spec §7) — session-only, the feed keeps it.
  useEffect(() => {
    if (!current) return;
    const t = window.setTimeout(() => setCollapsed(true), 12000);
    return () => window.clearTimeout(t);
  }, [current?.id]);

  async function dismiss(nudge: Nudge) {
    if (nudge.id) setDismissed((prev) => new Set(prev).add(nudge.id!));
    await patchNudge(nudge.id, "dismissed");
  }

  if (!current && queue.length === 0) return null;

  return (
    <div role="status" aria-label="Pookie's time-critical notes">
      {current ? (
        <div className="nudge-banner">
          <span aria-hidden="true" className="nudge-banner-hairline" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-star-100">{current.title}</p>
            {current.detail && (
              <p className="mt-0.5 text-xs leading-relaxed text-stardust-300">{current.detail}</p>
            )}
            {current.action && (
              <button
                type="button"
                onClick={() => runAction(current).then(() => dismiss(current))}
                className="mt-1.5 text-xs font-medium text-nova-300 hover:text-nova-200"
              >
                {current.action.label} →
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(current)}
            aria-label="Dismiss this note"
            className="shrink-0 rounded-full px-2 py-1 text-xs text-stardust-400 transition hover:bg-white/10 hover:text-stardust-200"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="nudge-banner nudge-banner-queued"
          aria-label={`${queue.length} notes from Pookie — tap to read`}
        >
          <span aria-hidden="true" className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
          </span>
          <span className="text-xs text-stardust-300">
            {queue.length} note{queue.length === 1 ? "" : "s"} from Pookie
          </span>
        </button>
      )}
      <style>{NUDGE_BANNER_CSS}</style>
    </div>
  );
}

const NUDGE_BANNER_CSS = `
.nudge-banner {
  display: flex; align-items: flex-start; gap: 12px;
  border-radius: 16px;
  border: 1px solid rgb(255 255 255 / 0.1);
  background: linear-gradient(180deg, rgb(10 16 28 / 0.82), rgb(6 10 20 / 0.86));
  backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  padding: 12px 16px;
  animation: nudge-slide-down 200ms ease;
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.4);
}
.nudge-banner-hairline {
  width: 3px; align-self: stretch; border-radius: 9999px;
  background: linear-gradient(180deg, #fbbf24, rgb(251 191 36 / 0.2));
}
.nudge-banner-queued { align-items: center; width: 100%; cursor: pointer; }
@keyframes nudge-slide-down {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .nudge-banner { animation: none; }
}
`;
