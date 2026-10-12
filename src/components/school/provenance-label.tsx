"use client";

/**
 * ProvenanceLabel — FR-SCHOOL-001.
 *
 * Every school surface shows, subtly, WHERE the data came from so the teen
 * understands what parents can and can't see:
 *  - "school-of-record"  → grades, attendance, official school comms.
 *    Under FERPA a custodial parent can get this from the school no matter
 *    what Pookie's settings say. We never promise otherwise.
 *  - "app-generated"     → check-ins, reflections, sparks, forecasts the
 *    teen configures. Child-authority data, governed by visibility scopes.
 *  - "mixed"             → a surface blending both (rendered inline labels
 *    identify each row).
 */
export type ProvenanceKind = "school-of-record" | "app-generated" | "mixed";

const COPY: Record<ProvenanceKind, { short: string; title: string }> = {
  "school-of-record": {
    short: "From your school",
    title:
      "School-of-record data: your school shares grades, attendance, and official notices with your parents directly. Pookie settings can't change that — it happens outside this app.",
  },
  "app-generated": {
    short: "Made in Pookie",
    title:
      "App-generated data: this is governed by your Sharing settings. What you choose here controls what Pookie shares — not what your school shares.",
  },
  mixed: {
    short: "Mixed sources",
    title:
      "This view mixes school records and things made in Pookie. Each item is labeled with where it came from.",
  },
};

export function ProvenanceLabel({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const c = COPY[kind];
  return (
    <span
      title={c.title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide ${
        kind === "school-of-record"
          ? "border-stardust-500/30 text-stardust-300"
          : kind === "app-generated"
            ? "border-nova-400/30 text-nova-300"
            : "border-aurum-400/30 text-aurum-300"
      } ${className ?? ""}`}
    >
      <span aria-hidden="true">{kind === "school-of-record" ? "🏫" : kind === "app-generated" ? "✨" : "🔀"}</span>
      {c.short}
    </span>
  );
}

/** One-line plain-English provenance explainer for section headers. */
export function ProvenanceLine({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  const c = COPY[kind];
  return (
    <p className={`text-[11px] text-stardust-500 ${className ?? ""}`}>
      {c.short} · <span title={c.title}>{kind === "school-of-record" ? "your school also shares this with your parents" : kind === "app-generated" ? "your Sharing settings control who sees this" : "each item is labeled"}</span>
    </p>
  );
}
