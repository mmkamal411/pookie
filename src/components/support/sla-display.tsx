// SLA display (§6.2) — window-aware copy from the real sla_due_at.
// Concrete times, never fake precise minutes: "First response by ~1 PM
// tomorrow". Breach → the honest red copy + lead-notified line.

"use client";

function fmtET(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export function SlaDisplay({
  slaDueAt,
  slaBreached,
}: {
  slaDueAt: string | null;
  slaBreached: boolean;
}) {
  if (slaBreached) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-200">
        We&apos;re late — sorry. A lead has been notified.
      </span>
    );
  }
  if (!slaDueAt) return null;
  const msLeft = new Date(slaDueAt).getTime() - Date.now();
  const hoursLeft = msLeft / 3600000;
  const tone =
    hoursLeft < 0
      ? "border-red-400/40 bg-red-500/10 text-red-200"
      : hoursLeft < 6
        ? "border-amber-400/40 bg-amber-500/10 text-amber-200"
        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  const left =
    hoursLeft < 0
      ? "due now"
      : hoursLeft < 1
        ? `${Math.max(1, Math.round(hoursLeft * 60))}m left`
        : `${Math.round(hoursLeft)}h left`;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}
      title={`First response due ${fmtET(slaDueAt)} ET`}
    >
      First response by ~{fmtET(slaDueAt)} · {left}
    </span>
  );
}
