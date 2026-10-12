"use client";

import { useState } from "react";
import type { TeacherMessage } from "@/lib/school/types";
import { ProvenanceLabel } from "./provenance-label";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const SOURCE_LABEL: Record<string, string> = {
  parentvue: "ParentVUE",
  ctls: "CTLS",
  gmail: "Gmail",
  manual: "Pookie",
};

function MessageCard({
  m,
  teacherName,
  role,
  busy,
  onApprove,
  onSend,
  sentIds,
}: {
  m: TeacherMessage;
  teacherName: string | null;
  role: "parent" | "child";
  busy: boolean;
  onApprove: (id: string) => void;
  onSend: (id: string) => void;
  sentIds: Set<string>;
}) {
  const statusChip = (msg: TeacherMessage) => {
    if (msg.status === "received") return "border-nova-400/40 text-nova-300";
    if (msg.status === "sent" || sentIds.has(msg.id)) return "border-nova-400/40 text-nova-300";
    if (msg.status === "approved") return "border-aurum-400/40 text-aurum-300";
    return "border-stardust-500/40 text-stardust-300";
  };

  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        m.direction === "inbound" ? "border-nova-400/15 bg-nebula-800/60" : "border-aurum-400/15 bg-nebula-800/40"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-stardust-300">
          {m.direction === "inbound" ? (teacherName ?? "Teacher") : "You"}
          {m.subject ? ` · ${m.subject}` : ""}
        </p>
        <span className="flex items-center gap-1.5">
          {m.safety_critical && (
            <span className="rounded-full border border-red-400/40 px-2 py-0.5 text-[10px] font-semibold text-red-300">
              Safety — always reaches parents
            </span>
          )}
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusChip(m)}`}>
            {m.status}
          </span>
        </span>
      </div>
      <p className="mt-1.5 text-sm whitespace-pre-wrap text-star-100">{m.body}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <p className="text-[10px] text-stardust-500">{formatDate(m.created_at)}</p>
        <span
          className="text-[10px] text-stardust-500"
          title={`Source system: ${SOURCE_LABEL[m.source ?? "manual"] ?? m.source ?? "Pookie"}${
            m.fetched_at ? ` · pulled ${formatDate(m.fetched_at)}` : ""
          }`}
        >
          via {SOURCE_LABEL[m.source ?? "manual"] ?? "Pookie"}
          {m.fetched_at ? ` · ${formatDate(m.fetched_at)}` : ""}
        </span>
      </div>
      {role === "parent" && m.direction === "outbound" && m.status === "draft" && (
        <button
          type="button"
          onClick={() => onApprove(m.id)}
          disabled={busy}
          className="btn-dapple mt-2 rounded-xl px-4 py-1.5 text-xs font-semibold text-nebula-950 disabled:opacity-50"
        >
          Approve exact text
        </button>
      )}
      {role === "parent" && m.direction === "outbound" && m.status === "approved" && (
        <button
          type="button"
          onClick={() => onSend(m.id)}
          disabled={busy}
          className="btn-dapple mt-2 rounded-xl px-4 py-1.5 text-xs font-semibold text-nebula-950 disabled:opacity-50"
        >
          Send now
        </button>
      )}
    </div>
  );
}

/**
 * Teacher inbox — FR-SCHOOL-002.
 *
 * Counselor mail is SEGREGATED from teacher mail (ASCA B.2: counselor
 * confidentiality is not a parent CC line). Counselor threads render in a
 * visually distinct card; parents see metadata only unless the teen grants
 * the counselor_communications scope. Every message carries its provenance
 * (source system + pulled-at), and safety-critical messages are tagged.
 */
export function TeacherThread({
  thread,
  childId,
  classId,
  teacherName,
  role,
  onChanged,
}: {
  thread: TeacherMessage[];
  childId: string;
  classId: string;
  teacherName: string | null;
  role: "parent" | "child";
  onChanged: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heldNote, setHeldNote] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  async function draft() {
    if (role !== "parent" || !body.trim()) return;
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
    if (role !== "parent") return;
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
    if (role !== "parent") return;
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

  const teacherMsgs = thread.filter((m) => (m.sender_type ?? "teacher") !== "counselor");
  const counselorMsgs = thread.filter((m) => (m.sender_type ?? "teacher") === "counselor");

  return (
    <div className="space-y-4">
      <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-star-100">Teacher Messages</h3>
          <ProvenanceLabel kind="school-of-record" />
        </div>
        <p className="text-xs text-stardust-300">
          {teacherName ? `With ${teacherName}` : "With the teacher"} — nothing sends without your approval.
        </p>

        <div className="mt-4 space-y-3">
          {teacherMsgs.length === 0 && (
            <p className="text-sm text-stardust-300">No messages yet — the thread grows here.</p>
          )}
          {teacherMsgs.map((m) => (
            <MessageCard
              key={m.id}
              m={m}
              teacherName={teacherName}
              role={role}
              busy={busy}
              onApprove={approve}
              onSend={send}
              sentIds={sentIds}
            />
          ))}
        </div>

        {heldNote && (
          <p className="mt-3 rounded-2xl border border-aurum-400/30 bg-nebula-800/60 px-4 py-2.5 text-xs text-aurum-200">
            {heldNote}
          </p>
        )}

        {role === "parent" && (
          <div className="mt-4 space-y-3 border-t border-nova-400/10 pt-4">
            <p className="text-sm font-medium text-nova-300">Write to the teacher</p>
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
              className="btn-dapple rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save as draft"}
            </button>
            <p className="text-[11px] text-stardust-500">
              Drafts stay drafts until you approve the exact words. Sends go out 6:00 AM – 10:00 PM.
            </p>
          </div>
        )}

        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </div>

      {/* Counselor mail — segregated store, ASCA B.2 confidentiality */}
      {counselorMsgs.length > 0 && (
        <div className="animate-rise rounded-3xl border border-stardust-500/25 bg-nebula-900/40 p-5">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-stardust-100">Counselor Conversations</h3>
            <ProvenanceLabel kind="school-of-record" />
          </div>
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">
            Counselor Conversations are confidential to the student (ASCA B.2) — kept
            separate from teacher mail on purpose.
          </p>
          <div className="mt-4 space-y-3">
            {counselorMsgs.map((m) =>
              m.body_withheld ? (
                <div key={m.id} className="rounded-2xl border border-stardust-500/20 bg-nebula-800/40 px-4 py-3">
                  <p className="text-xs font-medium text-stardust-300">
                    A counselor conversation{m.subject ? ` — ${m.subject}` : ""}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-400">
                    Updated {formatDate(m.created_at)}. The words stay private unless your
                    teen shares them — counselor confidentiality isn&apos;t a parent CC line.
                  </p>
                </div>
              ) : (
                <MessageCard
                  key={m.id}
                  m={m}
                  teacherName="Counselor"
                  role={role}
                  busy={busy}
                  onApprove={approve}
                  onSend={send}
                  sentIds={sentIds}
                />
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
