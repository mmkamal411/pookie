"use client";

/**
 * Squad Village — the mentor's window into a child's school life.
 *
 * Read-only: classes, current grades, upcoming/missing work, and a way to
 * send encouragement. No grade changes, no teacher messages, no health data.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/components/home-money/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok)
    throw new ApiError(
      json.error?.code ?? "INTERNAL",
      json.error?.message ?? "Hold position — request incomplete. Try again in a moment.",
    );
  return json.data as T;
}

interface Overview {
  child: { first_name: string; nickname: string | null } | null;
  relationship: string;
  classes: { id: string; name: string; teacher_name: string | null; period: string | null }[];
  grades: { class_id: string; term: string; numeric: number | null }[];
  assignments: {
    id: string;
    class_id: string;
    title: string;
    due_date: string | null;
    status: string;
  }[];
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  sibling: "Sibling",
  uncle: "Uncle",
  aunt: "Aunt",
  grandparent: "Grandparent",
  tutor: "Tutor",
  coach: "Coach",
  other: "Mentor",
};

function gradeFor(overview: Overview, classId: string): number | null {
  const g = overview.grades.find((x) => x.class_id === classId);
  return g?.numeric ?? null;
}

function dueLabel(due: string | null): string {
  if (!due) return "No due date";
  const d = new Date(due);
  const today = new Date();
  const days = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days}d`;
}

export function MentorOverview({ childId }: { childId: string }) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [kudos, setKudos] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await api<Overview>(`/api/v1/village/overview?child_id=${childId}`));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load this view. Your crew access may have changed.",
      );
    }
  }, [childId]);

  useEffect(() => {
    load();
  }, [load]);

  const sendKudos = async () => {
    const trimmed = kudos.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await api("/api/v1/village/kudos", {
        method: "POST",
        body: JSON.stringify({ child_id: childId, message: trimmed }),
      });
      setKudos("");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send encouragement.");
    } finally {
      setSending(false);
    }
  };

  if (error && !overview) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
        <p className="text-sm text-stardust-400">Opening the viewport…</p>
      </main>
    );
  }

  const name = overview.child?.nickname ?? overview.child?.first_name ?? "Your student";
  const attention = overview.assignments.filter((a) => a.status !== "upcoming");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pt-10 pb-8">
      <div>
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          The crew · {RELATIONSHIP_LABEL[overview.relationship] ?? "Mentor"} view
        </p>
        <h1 className="text-sunlit mt-2 text-3xl font-semibold tracking-tight">
          Helping {name} win
        </h1>
        <p className="mt-1 text-sm text-stardust-300">
          Classes, due dates, and missing work — so you know exactly where to help.
        </p>
      </div>

      {attention.length > 0 && (
        <section className="card-living rounded-3xl p-6">
          <h2 className="text-lg font-semibold text-star-100">Needs attention first</h2>
          <ul className="mt-3 space-y-2">
            {attention.slice(0, 8).map((a) => {
              const cls = overview.classes.find((c) => c.id === a.class_id);
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl bg-nebula-950/60 px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-star-100">{a.title}</p>
                    <p className="text-xs text-stardust-400">
                      {cls?.name ?? "A class"} · {a.status}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium ${a.status === "missing" ? "text-red-300" : "text-amber-300"}`}
                  >
                    {dueLabel(a.due_date)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card-living rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-star-100">Classes</h2>
        <ul className="mt-3 space-y-2">
          {overview.classes.map((c) => {
            const g = gradeFor(overview, c.id);
            const upcoming = overview.assignments.filter(
              (a) => a.class_id === c.id && a.status === "upcoming",
            ).length;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-nebula-950/60 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-star-100">{c.name}</p>
                  <p className="text-xs text-stardust-400">
                    {c.teacher_name ?? ""}
                    {upcoming > 0 ? ` · ${upcoming} upcoming` : ""}
                  </p>
                </div>
                {g !== null && (
                  <span className="rounded-full border border-nova-400/30 px-3 py-1 text-sm font-semibold text-nova-200">
                    {g}
                  </span>
                )}
              </li>
            );
          })}
          {overview.classes.length === 0 && (
            <p className="text-sm text-stardust-400">No classes in view yet.</p>
          )}
        </ul>
      </section>

      <section className="card-living rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-star-100">Send encouragement</h2>
        <p className="mt-1 text-sm text-stardust-300">
          A few words from the crew go a long way.
        </p>
        {sent && (
          <p className="mt-2 text-sm text-emerald-300">Sent — they&apos;ll see it.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            value={kudos}
            onChange={(e) => setKudos(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendKudos()}
            placeholder="You've got this…"
            maxLength={500}
            className="input-rooted flex-1 rounded-xl px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={sendKudos}
            disabled={sending || !kudos.trim()}
            className="btn-dapple rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </section>
    </main>
  );
}
