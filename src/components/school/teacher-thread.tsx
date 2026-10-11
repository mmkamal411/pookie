"use client";

import { useState } from "react";
import type { TeacherMessage } from "@/lib/school/types";

/**
 * Per-class teacher thread + parent draft flow.
 * Draft → approve → send, all parent-gated (role enforced server-side too).
 * Quiet-hour approvals are HELD — the approve response says when it may go.
 * In demo mode everything is read-only — demo never calls /api/v1/*.
 */
export function TeacherThread({
  thread,
  childId,
  classId,
  teacherName,
  role,
  demo = false,
  onChanged,
}: {
  thread: TeacherMessage[];
  childId: string;
  classId: string;
  teacherName: string | null;
  role: "parent" | "child";
  demo?: boolean;
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heldNote, setHeldNote] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  async function draft() {
    if (role !== "parent" || demo || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/teacher-messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          class_id: classId,
          subject: subject.trim() || undefined,
          body: body.trim(),
        }),
      });
      if (!res.ok) throw new Error("draft_failed");
      setSubject("");
      setBody("");
      onChanged();
    } catch {
      setError("Couldn't save the draft — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    if (role !== "parent" || demo) return;
    setBusy(true);
    setError(null);
    setHeldNote(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/teacher-messages/${id}/approve`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("approve_failed");
      const json = (await res.json()) as { data: { held: boolean; send_after_date: string | null } };
      if (json.data.held) {
        setHeldNote(
          `Approved and held for the send window — it can go out after 6:00 AM${
            json.data.send_after_date ? ` on ${json.data.send_after_date}` : ""
          }.`,
        );
      }
      onChanged();
    } catch {
      setError("Couldn't approve that message — try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function send(id: string) {
    if (role !== "parent" || demo) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/teacher-messages/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("send_failed");
      setSentIds((prev) => new Set(prev).add(id));
      onChanged();
    } catch {
      setError("Couldn't send that message — it may be outside the send window.");
    } finally {
      setBusy(false);
    }
  }

  const statusChip = (m: TeacherMessage) => {
    if (m.status === "received") return "border-leaf-400/40 text-leaf-300";
    if (m.status === "sent" || sentIds.has(m.id)) return "border-leaf-400/40 text-leaf-300";
    if (m.status === "approved") return "border-sunlight-400/40 text-sunlight-300";
    return "border-bark-500/40 text-bark-300";
  };

  return (
    <div className="card-living animate-rise rounded-3xl border border-leaf-400/20 p-5">
      <h3 className="font-medium text-dew-100">Teacher messages</h3>
      <p className="text-xs text-bark-300">
        {teacherName ? `With ${teacherName}` : "With the teacher"} — nothing sends without your approval.
      </p>

      <div className="mt-4 space-y-3">
        {thread.length === 0 && (
          <p className="text-sm text-bark-300">No messages yet — the thread grows here.</p>
        )}
        {thread.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl border px-4 py-3 ${
              m.direction === "inbound" ? "border-leaf-400/15 bg-canopy-800/60" : "border-sunlight-400/15 bg-canopy-800/40"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-bark-300">
                {m.direction === "inbound" ? (teacherName ?? "Teacher") : "You"}
                {m.subject ? ` · ${m.subject}` : ""}
              </p>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusChip(m)}`}>
                {m.status}
              </span>
            </div>
            <p className="mt-1.5 text-sm whitespace-pre-wrap text-dew-100">{m.body}</p>
            <p className="mt-1.5 text-[10px] text-bark-500">
              {new Date(m.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
            {role === "parent" && !demo && m.direction === "outbound" && m.status === "draft" && (
              <button
                type="button"
                onClick={() => approve(m.id)}
                disabled={busy}
                className="btn-dapple mt-2 rounded-xl px-4 py-1.5 text-xs font-semibold text-canopy-950 disabled:opacity-50"
              >
                Approve exact text
              </button>
            )}
            {role === "parent" && !demo && m.direction === "outbound" && m.status === "approved" && (
              <button
                type="button"
                onClick={() => send(m.id)}
                disabled={busy}
                className="btn-dapple mt-2 rounded-xl px-4 py-1.5 text-xs font-semibold text-canopy-950 disabled:opacity-50"
              >
                Send now
              </button>
            )}
          </div>
        ))}
      </div>

      {heldNote && (
        <p className="mt-3 rounded-2xl border border-sunlight-400/30 bg-canopy-800/60 px-4 py-2.5 text-xs text-sunlight-200">
          {heldNote}
        </p>
      )}

      {role === "parent" && !demo && (
        <div className="mt-4 space-y-3 border-t border-leaf-400/10 pt-4">
          <p className="text-sm font-medium text-leaf-300">Write to the teacher</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="Subject (optional)"
            className="input-rooted w-full rounded-2xl px-4 py-2.5 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={4}
            placeholder="Start with gratitude, keep it short and specific…"
            className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
          />
          <button
            type="button"
            onClick={draft}
            disabled={busy || !body.trim()}
            className="btn-dapple rounded-2xl px-5 py-2 text-sm font-semibold text-canopy-950 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save as draft"}
          </button>
          <p className="text-[11px] text-bark-500">
            Drafts stay drafts until you approve the exact words. Sends go out 6:00 AM – 10:00 PM.
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
    </div>
  );
}
