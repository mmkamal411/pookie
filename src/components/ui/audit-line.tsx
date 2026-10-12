// AuditLine — one timestamped audit row: "who did what, when". Used in the
// Settings → Privacy "Who's looked at my stuff" view and ticket system rows.
// Always plain language, never blame.

export function AuditLine({
  actor,
  action,
  at,
  detail,
}: {
  actor: string;
  action: string;
  at: string | Date;
  detail?: string;
}) {
  const when =
    typeof at === "string" ? at : at.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="flex items-start gap-2 py-1.5 text-[13px] text-stardust-300">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-nova-300">
        •
      </span>
      <p className="min-w-0 leading-relaxed">
        <span className="font-medium text-star-100">{actor}</span> {action}
        {detail ? <span className="text-stardust-400"> · {detail}</span> : null}
        <span className="block text-xs text-stardust-500">{when}</span>
      </p>
    </div>
  );
}
