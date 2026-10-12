// The S2→S3 handoff contract (§5.2): two steps, inside the chat.
// Step 1: summary card ("what I'll hand them") → [Looks right ✓] / [Add something].
// Step 2: ticket issued synchronously → wait-time from the real SLA timestamp
// (never a fake precise number).

"use client";

import Link from "next/link";
import { Button, Card } from "@/components/ui";

export interface HandoffSummary {
  bullets: string[];
  ticketNumber: string | null;
  ticketId: string | null;
  slaDueAt: string | null;
}

export function summarizeConversation(messages: { role: string; content: string }[]): string[] {
  const userLines = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content.trim().split("\n")[0].slice(0, 90))
    .filter(Boolean)
    .slice(-3);
  if (userLines.length === 0) return ["Asked for help in the support chat"];
  return userLines;
}

/** Honest wait-time copy from the real sla_due_at (window-aware, 9–5 ET). */
export function waitTimeCopy(slaDueAt: string | null): string {
  if (!slaDueAt) return "We'll reply as soon as we can.";
  const due = new Date(slaDueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  if (diffMs <= 0) return "A reply is due right about now.";
  const hours = diffMs / 3600000;
  const when = due.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
  if (hours <= 5) return `Usually replies within a few hours — by about ${when} ET.`;
  const tomorrow = new Date(now.getTime() + 86400000).toDateString() === due.toDateString();
  return `First response by about ${tomorrow ? "tomorrow" : when} — we'll notify you here and by push.`;
}

export function HandoffStep1({
  bullets,
  onConfirm,
  onAdd,
  busy,
}: {
  bullets: string[];
  onConfirm: () => void;
  onAdd: () => void;
  busy: boolean;
}) {
  return (
    <Card className="border-nova-400/30">
      <p className="text-sm font-semibold text-star-100">✨ Handing you to a human</p>
      <p className="mt-1 text-[13px] text-stardust-300">Here&apos;s what I&apos;ll send them — check it over:</p>
      <ul className="mt-2 space-y-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-[13px] text-stardust-200">
            · {b}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onConfirm} loading={busy}>
          Looks right ✓
        </Button>
        <Button size="sm" variant="ghost" onClick={onAdd}>
          Add something
        </Button>
      </div>
    </Card>
  );
}

export function HandoffStep2({
  ticketNumber,
  ticketId,
  slaDueAt,
  childSlug,
}: {
  ticketNumber: string;
  ticketId: string;
  slaDueAt: string | null;
  childSlug: string;
}) {
  return (
    <Card className="border-teal-400/30">
      <p className="text-sm font-semibold text-star-100">🎫 Ticket {ticketNumber} is open.</p>
      <p className="mt-1 text-[13px] leading-relaxed text-stardust-300">
        I&apos;ve attached our whole chat — you don&apos;t have to retype anything.
      </p>
      <p className="mt-1.5 text-[13px] text-stardust-200">⏱️ {waitTimeCopy(slaDueAt)}</p>
      <div className="mt-3">
        <Link
          href={`/c/${childSlug}/support/tickets/${ticketId}`}
          className="inline-block rounded-xl border border-nova-300/40 bg-nova-500/15 px-4 py-2 text-sm font-medium text-star-100"
        >
          View ticket
        </Link>
      </div>
    </Card>
  );
}
