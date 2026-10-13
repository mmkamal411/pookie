"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelShell, PanelNote } from "./panel-shell";
import type { FamilyTask } from "@/server/services/tasks";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "request failed");
  return json.data as T;
}

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-stardust-500",
  normal: "bg-nova-400",
  high: "bg-amber-400",
  urgent: "bg-rose-400",
};

function dueLabel(t: FamilyTask): string | null {
  if (!t.due_date) return null;
  const today = new Date().toISOString().slice(0, 10);
  if (t.due_date === today) return "Today";
  if (t.due_date < today) return "Overdue";
  const d = new Date(t.due_date + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/**
 * TodoPanel — the pilot's own to-do list. Slim by design: today's focus +
 * a quick-add box. Full board lives in the Tasks station.
 * Data: GET/PATCH/POST /api/v1/household/tasks.
 */
export function TodoPanel({
  highlighted,
  bare,
  expandable,
}: {
  highlighted?: boolean;
  bare?: boolean;
  /** In the opening glass pane the todo section expands for details. */
  expandable?: boolean;
}) {
  const [tasks, setTasks] = useState<FamilyTask[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(true);
  // Manual-toggle tracking — the auto-expand behavior below only runs
  // until the pilot touches the control themselves.
  const [touched, setTouched] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<FamilyTask[]>("/api/v1/household/tasks?status=open");
      setTasks(data);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(t: FamilyTask) {
    setTasks((prev) => prev?.filter((x) => x.id !== t.id) ?? prev);
    try {
      await api(`/api/v1/household/tasks/${t.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
    } catch {
      load();
    }
  }

  async function add() {
    const title = draft.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await api("/api/v1/household/tasks", {
        method: "POST",
        body: JSON.stringify({ title }),
      });
      setDraft("");
      await load();
    } catch {
      // The list below shows the honest state; a failed add just stays in the box.
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  // Expandable mode: open by default when something needs attention
  // (overdue / due today), collapsed to a calm summary otherwise.
  useEffect(() => {
    if (!expandable || touched || !tasks) return;
    const needsAttention = tasks.some(
      (t) => t.due_date != null && t.due_date <= today,
    );
    setExpanded(needsAttention);
  }, [expandable, touched, tasks, today]);

  const sorted = [...(tasks ?? [])].sort((a, b) => {
    const rank = (t: FamilyTask) =>
      !t.due_date ? 2 : t.due_date < today ? 0 : t.due_date === today ? 1 : 3;
    return rank(a) - rank(b) || a.created_at.localeCompare(b.created_at);
  });
  const visible = sorted.slice(0, 6);
  const attentionCount = sorted.filter((t) => t.due_date != null && t.due_date <= today).length;

  function flip() {
    setTouched(true);
    setExpanded((e) => !e);
  }

  return (
    <PanelShell
      bare={bare}
      eyebrow="Focus"
      title="To-do"
      highlighted={highlighted}
      action={
        expandable && tasks !== null && !failed ? (
          <button
            type="button"
            onClick={flip}
            aria-expanded={expanded}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-stardust-300 transition hover:border-nova-400/40 hover:text-star-100"
          >
            {expanded ? "Hide details ↑" : `Show details (${sorted.length}) ↓`}
          </button>
        ) : undefined
      }
    >
      {failed || tasks === null ? (
        <PanelNote>
          {failed ? "Your list is unreachable right now — check back in a bit." : "Loading your list…"}
        </PanelNote>
      ) : expandable && !expanded ? (
        <button
          type="button"
          onClick={flip}
          className="block w-full rounded-2xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
        >
          <PanelNote>
            {sorted.length === 0
              ? "All clear — nothing on the list."
              : attentionCount > 0
                ? `${attentionCount} need${attentionCount === 1 ? "s" : ""} attention · ${sorted.length} open total — tap for details.`
                : `${sorted.length} open · none due — tap for details.`}
          </PanelNote>
        </button>
      ) : (
        <>
          <ul className="space-y-1">
            {visible.map((t) => {
              const label = dueLabel(t);
              const overdue = t.due_date != null && t.due_date < today;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="group flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-stardust-500 transition group-hover:border-nova-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-star-100">{t.title}</span>
                      {label && (
                        <span className={`mt-0.5 block text-[11px] ${overdue ? "text-rose-300" : "text-stardust-400"}`}>
                          {label}
                        </span>
                      )}
                    </span>
                    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority] ?? PRIORITY_DOT.normal}`} />
                  </button>
                </li>
              );
            })}
            {visible.length === 0 && (
              <li>
                <PanelNote>All clear — nothing on the list.</PanelNote>
              </li>
            )}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a to-do…"
              maxLength={280}
              aria-label="Add a to-do"
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="shrink-0 rounded-2xl border border-nova-400/40 bg-nova-500/15 px-4 py-2.5 text-sm font-medium text-star-100 transition hover:bg-nova-500/25 disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {sorted.length > visible.length && (
            <p className="mt-2 text-[11px] text-stardust-500">
              +{sorted.length - visible.length} more on the list
            </p>
          )}
        </>
      )}
    </PanelShell>
  );
}
