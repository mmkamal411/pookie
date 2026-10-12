"use client";

// Squad 2 — Health Track: shared presentational primitives.
// Nebula theme, no exceptions. Collapsed by default, expandable on tap.
// Copy: <= 8th grade, plain tier names (never H1/H2/H3 codes), no em dashes.

import { useState } from "react";
import type { HealthTier } from "@/lib/health/types";
import { TIER_NAMES, COPY, CRISIS_RESOURCES } from "@/lib/health/types";

const TIER_STYLES: Record<HealthTier, { chip: string; dot: string }> = {
  H1: { chip: "border-sky-400/30 bg-sky-400/10 text-sky-200", dot: "bg-sky-300" },
  H2: { chip: "border-violet-400/30 bg-violet-400/10 text-violet-200", dot: "bg-violet-300" },
  H3: { chip: "border-nova-400/40 bg-nova-400/10 text-nova-200", dot: "bg-nova-300" },
  H0: { chip: "border-stardust-500/30 bg-nebula-800/60 text-stardust-300", dot: "bg-stardust-500" },
};

/** Plain-language tier badge. The only tier label the UI may render. */
export function TierBadge({ tier }: { tier: HealthTier }) {
  const s = TIER_STYLES[tier];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${s.chip}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {TIER_NAMES[tier]}
      {(tier === "H2" || tier === "H3") && (
        <span aria-label="private" role="img" className="text-[10px]">
          🔒
        </span>
      )}
    </span>
  );
}

/** Every reading carries its source. No reading ever appears sourceless. */
export function ProvenanceLine({ text }: { text: string }) {
  return <p className="mt-1 text-xs text-stardust-500">{text}</p>;
}

/** Persistent header disclaimer (sol-health section 4.2). */
export function MedicalDisclaimerHeader() {
  return (
    <p className="rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
      {COPY.medicalDisclaimerHeader}
    </p>
  );
}

/** Persistent footer (sol-health section 4.2). Render on every health page. */
export function MedicalDisclaimerFooter() {
  return (
    <footer className="mt-10 border-t border-nova-400/10 pt-4 pb-2">
      <p className="text-center text-xs text-stardust-500">{COPY.medicalDisclaimerFooter}</p>
    </footer>
  );
}

/** NEDA resources card (sol-health section 6.5). Always one tap away, never a blocking modal. */
export function NedaCard() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="text-xs text-stardust-500 underline decoration-dotted underline-offset-2 hover:text-stardust-300"
      >
        Show support resources
      </button>
    );
  }
  return (
    <div className="card-living rounded-2xl border-nova-400/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-star-100">{COPY.nedaTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-stardust-300">{COPY.nedaBody}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="tel:+18009312237"
              className="rounded-full border border-nova-400/30 px-3 py-1.5 text-xs font-medium text-nova-300 hover:bg-nova-400/10"
            >
              Call 1-800-931-2237
            </a>
            <a
              href="sms:741741?&body=NEDA"
              className="rounded-full border border-nova-400/30 px-3 py-1.5 text-xs font-medium text-nova-300 hover:bg-nova-400/10"
            >
              Text NEDA to 741741
            </a>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide support resources"
          className="shrink-0 rounded-full px-2 py-1 text-xs text-stardust-500 hover:text-stardust-300"
        >
          Hide
        </button>
      </div>
    </div>
  );
}

/** One-tap crisis resources (sol-ux section 11). Never a link wall. */
export function CrisisResources({
  trustedAdultName,
  onTellTrustedAdult,
}: {
  trustedAdultName?: string | null;
  onTellTrustedAdult?: () => void;
}) {
  return (
    <div className="space-y-2">
      {CRISIS_RESOURCES.map((r) => (
        <a
          key={r.label}
          href={r.href}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-nova-400/25 bg-nebula-900/70 px-4 py-3 text-left transition-colors hover:border-nova-400/50"
        >
          <span>
            <span className="block text-sm font-semibold text-star-100">{r.label}</span>
            <span className="block text-xs text-stardust-300">{r.detail}</span>
          </span>
          <span aria-hidden="true" className="text-nova-300">
            →
          </span>
        </a>
      ))}
      {trustedAdultName && onTellTrustedAdult && (
        <button
          type="button"
          onClick={onTellTrustedAdult}
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-comet-400/25 bg-nebula-900/70 px-4 py-3 text-left transition-colors hover:border-comet-400/50"
        >
          <span>
            <span className="block text-sm font-semibold text-star-100">Tell my trusted adult</span>
            <span className="block text-xs text-stardust-300">{trustedAdultName}. One tap.</span>
          </span>
          <span aria-hidden="true" className="text-comet-300">
            →
          </span>
        </button>
      )}
    </div>
  );
}

/** Accessible toggle switch (Nebula). */
export function HealthToggle({
  checked,
  onChange,
  disabled,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-sm font-medium text-star-100">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-stardust-300">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-nova-500 shadow-glow-sm" : "bg-nebula-700"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-star-100 transition-all ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

/** Collapsed-by-default expandable row (Dawson dashboard pattern). */
export function CollapseRow({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-nova-400/10 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-star-100">{title}</span>
          {badge}
        </span>
        <span
          aria-hidden="true"
          className={`text-lg leading-none text-nova-300 transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {open && <div className="animate-rise pb-4">{children}</div>}
    </section>
  );
}

/** What a parent sees on the teen-private W8 route. Zero content, zero counts. */
export function TeenPrivateNotice({ teenName }: { teenName: string }) {
  return (
    <div className="card-living mx-auto max-w-lg rounded-3xl p-6 text-center">
      <p className="text-3xl" aria-hidden="true">
        🔒
      </p>
      <h2 className="text-sunlit mt-3 text-xl font-semibold">{COPY.teenPrivateTitle}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
        {COPY.teenPrivateBody.replace("the teen", teenName)}
      </p>
      <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-stardust-500">
        {COPY.noAggregatesLine}
      </p>
    </div>
  );
}

/**
 * Honest dependency state: the screens are fully built against the spec'd
 * contracts; the health tables are still in legal review. This is an error
 * path for a real dependency, not a placeholder.
 */
export function BackendNotReady({ feature }: { feature: string }) {
  return (
    <div className="card-living mx-auto max-w-lg rounded-3xl p-6 text-center">
      <p className="text-sm font-medium text-star-100">
        {feature}: {COPY.backendNotReadyTitle}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
        {COPY.backendNotReadyBody}
      </p>
    </div>
  );
}

/** Inline action error. */
export function ActionError({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3">
      <p className="text-sm text-red-200">{message}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-red-300 hover:text-red-100"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Page header shared by health surfaces. */
export function HealthPageHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <header className="animate-bloom">
      <p className="text-xs font-medium tracking-[0.2em] text-nova-400 uppercase">{eyebrow}</p>
      <h1 className="text-sunlit mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-xl text-sm text-stardust-300">{sub}</p>
    </header>
  );
}
