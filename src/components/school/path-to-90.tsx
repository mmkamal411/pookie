"use client";

import { useState } from "react";
import type { StudyPlan } from "@/lib/school/types";
import { ProvenanceLabel } from "./provenance-label";

/**
 * Path-to-90 — the ranked action checklist for one class.
 * Checkboxes persist to Supabase (PATCH plans/[planId]) so progress syncs
 * across devices and feeds guidance.
 *
 * FR-SCHOOL-007: the TEEN owns the checkboxes. Parent viewers are read-only —
 * checkboxes render disabled with a plain-English explanation. Parents keep
 * the draft-a-plan + review (safety_status) powers; those write a different
 * field and are role-gated server-side too.
 */
export function PathTo90({
  plan,
  childId,
  classId,
  childName,
  role,
  onChanged,
}: {
  plan: StudyPlan | null;
  childId: string;
  classId: string;
  childName: string;
  role: "parent" | "child";
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [weekStart, setWeekStart] = useState(
    new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(rank: number, done: boolean) {
    if (!plan || role !== "child") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ rank, done }] }),
      });
      if (!res.ok) throw new Error("update_failed");
      onChanged();
    } catch {
      setError("Couldn't save that step — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function review(status: "approved" | "rejected") {
    if (!plan || role !== "parent") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/plans/${plan.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ safety_status: status }),
      });
      if (!res.ok) throw new Error("review_failed");
      onChanged();
    } catch {
      setError("Couldn't record the review — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (role !== "parent") return;
    const actions = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (actions.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          week_start: weekStart,
          plan: actions.map((action, i) => ({ rank: i + 1, action, done: false })),
        }),
      });
      if (!res.ok) throw new Error("create_failed");
      setDraft("");
      onChanged();
    } catch {
      setError("Couldn't save the plan — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const safetyBadge =
    plan?.safety_status === "approved"
      ? "border-nova-400/40 text-nova-300"
      : plan?.safety_status === "rejected"
        ? "border-red-400/40 text-red-300"
        : "border-aurum-400/40 text-aurum-300";

  const isTeen = role === "child";

  return (
    <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-star-100">Path to 90</h3>
            <ProvenanceLabel kind="app-generated" />
          </div>
          <p className="mt-1 text-xs text-stardust-300">
            {plan
              ? `Week of ${plan.week_start} · ${plan.plan.filter((a) => a.done).length} of ${plan.plan.length} steps underway`
              : "No flight plan plotted for this week yet."}
          </p>
        </div>
        {plan && role === "parent" && (
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${safetyBadge}`}>
            {plan.safety_status === "approved"
              ? "Reviewed"
              : plan.safety_status === "rejected"
                ? "Rejected"
                : "Pending review"}
          </span>
        )}
      </div>

      {plan && role === "parent" && plan.plan.length > 0 && (
        <p className="mt-3 rounded-2xl border border-stardust-500/20 bg-nebula-800/40 px-4 py-2.5 text-xs leading-relaxed text-stardust-300">
          These steps are {childName}&apos;s — only they can check them off. You&apos;re
          seeing their plan read-only; your review (below) is what counts as the parent
          voice here.
        </p>
      )}

      {plan && plan.plan.length > 0 && (
        <ol className="mt-4 space-y-2">
          {plan.plan
            .slice()
            .sort((a, b) => a.rank - b.rank)
            .map((a) => (
              <li key={a.rank}>
                <label
                  className={`flex items-start gap-3 rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-3 ${
                    isTeen ? "cursor-pointer" : "cursor-default"
                  } ${a.done ? "opacity-60" : ""}`}
                  title={isTeen ? undefined : "Only your teen can check steps off — this is their plan."}
                >
                  <input
                    type="checkbox"
                    checked={a.done}
                    disabled={!isTeen || busy}
                    onChange={(e) => toggle(a.rank, e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-nova-400 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Step ${a.rank}: ${a.action}`}
                  />
                  <span className="flex-1">
                    <span className={`block text-sm ${a.done ? "text-stardust-300 line-through" : "text-star-100"}`}>
                      <span className="mr-2 font-semibold text-aurum-300 tabular-nums">{a.rank}</span>
                      {a.action}
                    </span>
                    {a.why && <span className="mt-0.5 block text-xs text-stardust-300">{a.why}</span>}
                  </span>
                </label>
              </li>
            ))}
        </ol>
      )}

      {plan && role === "parent" && plan.safety_status === "pending" && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => review("approved")}
            disabled={busy}
            className="btn-dapple rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            Approve plan
          </button>
          <button
            type="button"
            onClick={() => review("rejected")}
            disabled={busy}
            className="rounded-2xl border border-red-400/30 px-5 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}

      {role === "parent" && (
        <details className="mt-4 rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-nova-300">
            Draft a new weekly plan
          </summary>
          <div className="mt-3 space-y-3">
            <label className="block text-xs text-stardust-300">
              Week starting
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                className="input-rooted mt-1 block rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-stardust-300">
              Steps — one per line, in order
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder={"Finish the missing study guide\nRedo the two lowest quizzes\n20 minutes of practice nightly"}
                className="input-rooted mt-1 w-full rounded-2xl px-4 py-3 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={create}
              disabled={busy}
              className="btn-dapple rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save plan"}
            </button>
          </div>
        </details>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
