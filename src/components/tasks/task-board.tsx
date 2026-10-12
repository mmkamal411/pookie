"use client";

// Family Task System — shared to-dos, chores, recurring tasks (Squad Value).
// The #1 daily-use driver. Mobile-first.

import { useCallback, useEffect, useState } from "react";
import type { FamilyTask } from "@/server/services/tasks";
import { ApiError, LoadVeil } from "@/components/home-money/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error?.code ?? "INTERNAL", json.error?.message ?? "Hold position — request incomplete. Try again in a moment.");
  return json.data as T;
}

const BASE = "/api/v1/household/tasks";

const PRIORITY_STYLES: Record<string, string> = {
  low: "text-stardust-400 border-nebula-700",
  normal: "text-nova-300 border-nova-700",
  high: "text-amber-300 border-amber-600",
  urgent: "text-rose-300 border-rose-600",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

function fmtDue(task: FamilyTask): string | null {
  if (!task.due_date) return null;
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(task.due_date + "T12:00:00");
  const label = task.due_date === today
    ? "Today"
    : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const overdue = task.due_date < today && task.status === "open";
  return `${overdue ? "Overdue · " : ""}${label}${task.due_time ? ` ${task.due_time.slice(0, 5)}` : ""}`;
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: FamilyTask;
  onToggle: (t: FamilyTask) => void;
  onDelete: (t: FamilyTask) => void;
}) {
  const done = task.status === "done";
  const due = fmtDue(task);
  const overdue = task.due_date && task.due_date < new Date().toISOString().slice(0, 10) && !done;
  return (
    <div
      className={`glass-pane flex items-start gap-3 p-3 transition-opacity ${done ? "opacity-50" : ""}`}
    >
      <button
        onClick={() => onToggle(task)}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
          done
            ? "border-emerald-400 bg-emerald-400/20 text-emerald-300"
            : "border-nebula-600 text-transparent hover:border-nova-400"
        }`}
      >
        {done && <span aria-hidden>✓</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium text-stardust-100 ${done ? "line-through" : ""}`}>
          {task.title}
        </p>
        {task.notes && (
          <p className="mt-0.5 truncate text-xs text-stardust-400">{task.notes}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {due && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${overdue ? "bg-rose-500/20 text-rose-300" : "bg-nebula-800 text-stardust-300"}`}>
              {due}
            </span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${PRIORITY_STYLES[task.priority]}`}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.recurrence && (
            <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-[11px] text-stardust-300">
              ↻ {task.recurrence}
            </span>
          )}
          {task.assigned_to && (
            <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-[11px] text-stardust-300">
              → {task.assigned_to.startsWith("child:") ? "Family member" : task.assigned_to}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(task)}
        aria-label={`Delete ${task.title}`}
        className="shrink-0 rounded-full p-1.5 text-stardust-500 hover:bg-nebula-800 hover:text-rose-300"
      >
        ✕
      </button>
    </div>
  );
}

export function TaskBoard({ compact = false }: { compact?: boolean }) {
  const [tasks, setTasks] = useState<FamilyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");

  // Add-form state
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [recurrence, setRecurrence] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { tasks } = await api<{ tasks: FamilyTask[] }>(`${BASE}?status=${filter}`);
      setTasks(tasks);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load tasks.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await api(BASE, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          due_date: dueDate || undefined,
          priority,
          recurrence: recurrence || undefined,
        }),
      });
      setTitle(""); setDueDate(""); setPriority("normal"); setRecurrence("");
      setShowAdd(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the task.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (task: FamilyTask) => {
    const next = task.status === "done" ? "open" : "done";
    // Optimistic update
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next as FamilyTask["status"] } : t)));
    try {
      await api(`${BASE}/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      load(); // refresh to pick up recurrence-spawned next occurrence
    } catch {
      load(); // revert on failure
    }
  };

  const handleDelete = async (task: FamilyTask) => {
    setTasks((ts) => ts.filter((t) => t.id !== task.id));
    try {
      await api(`${BASE}/${task.id}`, { method: "DELETE" });
    } catch {
      load();
    }
  };

  const openCount = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold capitalize tracking-wide text-nova-300">
          Family tasks
          {openCount > 0 && (
            <span className="ml-2 rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300">
              {openCount} open
            </span>
          )}
        </h2>
        <div className="flex gap-1">
          {(["open", "done", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-2.5 py-1 text-xs capitalize ${
                filter === f ? "bg-nova-600 text-white" : "text-stardust-400 hover:text-stardust-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadVeil label="Loading tasks" />
      ) : error ? (
        <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
      ) : (
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <div className="glass-pane p-4 text-center">
              <p className="text-sm text-stardust-300">
                {filter === "open" ? "All clear — nothing on the task list." : "Nothing here yet."}
              </p>
              <p className="mt-1 text-xs text-stardust-500">
                Add the first task below to get the household moving.
              </p>
            </div>
          ) : (
            tasks.slice(0, compact ? 5 : undefined).map((t) => (
              <TaskRow key={t.id} task={t} onToggle={handleToggle} onDelete={handleDelete} />
            ))
          )}
        </div>
      )}

      {showAdd ? (
        <div className="glass-pane space-y-2.5 p-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-1.5 text-xs text-stardust-200 focus:border-nova-500 focus:outline-none"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-1.5 text-xs text-stardust-200 focus:border-nova-500 focus:outline-none"
            >
              <option value="low">Low priority</option>
              <option value="normal">Normal priority</option>
              <option value="high">High priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              className="rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-1.5 text-xs text-stardust-200 focus:border-nova-500 focus:outline-none"
            >
              <option value="">One-time</option>
              <option value="daily">Repeats daily</option>
              <option value="weekly">Repeats weekly</option>
              <option value="monthly">Repeats monthly</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!title.trim() || saving}
              className="flex-1 rounded-lg bg-nova-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add task"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-nebula-700 px-3 py-2 text-sm text-stardust-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg border border-dashed border-nebula-600 p-3 text-sm text-stardust-300 hover:border-nova-500 hover:text-nova-300"
        >
          + Add a task
        </button>
      )}
    </div>
  );
}
