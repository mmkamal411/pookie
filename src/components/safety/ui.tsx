"use client";

import { useId, type ReactNode } from "react";

/* Squad 1 shared primitives — Nebula-Neutral / Nebula-Boring.
   Nothing here animates except the opt-in bloom class, which the global
   prefers-reduced-motion rule freezes. BoringSheet renders no starfield
   accent, no pink, no emoji, no motion — ever. */

export function PrimaryButton({
  children,
  onClick,
  disabled,
  tone = "glow",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "glow" | "neutral";
  type?: "button" | "submit";
}) {
  const toneClass =
    tone === "glow"
      ? "btn-dapple text-white"
      : "border border-stardust-500/50 bg-nebula-700/60 text-star-100 hover:bg-nebula-700";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[48px] w-full rounded-2xl px-5 py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function QuietButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-[48px] w-full rounded-2xl px-5 py-3 text-sm font-medium text-stardust-300 underline-offset-4 hover:text-star-100 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Two equal-weight buttons — the anti-dark-pattern core (§1.5, §3). */
export function EqualWeightButtons({
  first,
  firstLabel,
  second,
  secondLabel,
  secondDisabled,
}: {
  first: () => void;
  firstLabel: string;
  second: () => void;
  secondLabel: string;
  secondDisabled?: boolean;
}) {
  const cls =
    "min-h-[48px] flex-1 rounded-2xl border border-stardust-500/50 bg-nebula-700/60 px-5 py-3 text-base font-semibold text-star-100 transition-colors hover:bg-nebula-700 disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <button type="button" onClick={first} className={cls}>
        {firstLabel}
      </button>
      <button type="button" onClick={second} disabled={secondDisabled} className={cls}>
        {secondLabel}
      </button>
    </div>
  );
}

/** Nebula-Neutral wizard shell: centered, dim static starfield, calm slate card. */
export function FullPageFlow({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-[560px]"}`}>
        <div className="card-living animate-bloom rounded-3xl p-6 sm:p-8">{children}</div>
      </div>
    </main>
  );
}

/** Nebula-Boring: plain system sheet for decline / safe-exit / quiet exits.
    "Boring" means no glow, no motion — the sheet still follows the active
    theme via tokens so it never renders as a stray dark slab. */
export function BoringSheet({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full items-center justify-center bg-nebula-950 px-4 py-10">
      <div className="w-full max-w-[520px] rounded-xl border border-nebula-700 bg-nebula-900 p-6 text-star-200">
        {children}
      </div>
    </main>
  );
}

/** Neutral sheet for cooling-off Steps 1-5: flat slate, no glow buttons. */
export function NeutralSheet({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-[560px] rounded-3xl border border-nova-400/15 bg-nebula-900/80 p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}

export function PlainList({ items }: { items: (string | ReactNode)[] }) {
  return (
    <ul className="space-y-2.5 text-[15px] leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-stardust-300">
            •
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Always unchecked by default — hard requirement, never pre-checked. */
export function AcknowledgmentCheckbox({
  label,
  checked,
  onChange,
  boring,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  boring?: boolean;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
        boring ? "border-nebula-700 bg-nebula-950" : "border-nova-400/20 bg-nebula-800/60"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-6 w-6 shrink-0 accent-teal-400"
      />
      <span className="text-[15px] leading-relaxed">{label}</span>
    </label>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-star-200">
        {label}
      </label>
      <div id={id}>{children}</div>
      {hint ? <p className="mt-1.5 text-xs leading-relaxed text-stardust-300">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  "w-full min-h-[48px] rounded-xl border border-nova-400/25 bg-nebula-950/70 px-4 py-3 text-base text-star-100 placeholder:text-stardust-500 focus:border-nova-400/60 focus:outline-none";

export function RelationshipChips({
  value,
  onChange,
  options,
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Relationship">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-nova-400/60 bg-nova-400/15 text-nova-200"
                : "border-nova-400/15 bg-nebula-900/60 text-stardust-300 hover:border-nova-400/30 hover:text-star-100"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Static progress dots — no animation, ever. */
export function StaticProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`Step ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full ${i + 1 === current ? "bg-nova-400" : "bg-stardust-500/40"}`}
        />
      ))}
      <span className="sr-only">
        {current} of {total}
      </span>
    </div>
  );
}

export function PendingStatusCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-5">
      <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-nebula-700" aria-hidden="true">
        <div className="h-full w-1/2 rounded-full bg-nova-400/70" />
      </div>
      {children}
    </div>
  );
}

/** High-contrast one-tap help buttons. Never neon-on-neon. */
export function OneTapHelpButtons({ compact }: { compact?: boolean }) {
  const btn =
    "flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-base font-bold text-slate-900 transition-colors hover:bg-slate-100";
  return (
    <div className={`grid ${compact ? "grid-cols-1 gap-2" : "grid-cols-1 gap-3 sm:grid-cols-3"}`}>
      <a href="tel:988" className={btn} aria-label="Call or text 988, Suicide and Crisis Lifeline">
        <span aria-hidden="true">📞</span> Call or text 988
      </a>
      <a
        href="sms:741741?body=HOME"
        className={btn}
        aria-label="Text HOME to 741741, Crisis Text Line"
      >
        <span aria-hidden="true">💬</span> Text 741741
      </a>
      <a href="tel:911" className={btn} aria-label="Call 911">
        <span aria-hidden="true">🚨</span> Call 911
      </a>
    </div>
  );
}

/** 988 / 741741 / local-help block reused in safe-exit, decline, quiet exits. */
export function CrisisResourceBlock({ boring }: { boring?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 ${
        boring ? "border border-nebula-700 bg-nebula-950 text-star-200" : "bg-white text-slate-900"
      }`}
    >
      <p className={`text-sm font-semibold ${boring ? "text-star-200" : "text-slate-900"}`}>
        Help, whenever you need it
      </p>
      <ul className="mt-2 space-y-1.5 text-[15px] leading-relaxed">
        <li>
          <a href="tel:988" className="font-bold underline underline-offset-2">
            Call or text 988
          </a>{" "}
          <span className={boring ? "text-stardust-300" : "text-slate-600"}>(Suicide and Crisis Lifeline)</span>
        </li>
        <li>
          <a href="sms:741741?body=HOME" className="font-bold underline underline-offset-2">
            Text HOME to 741741
          </a>{" "}
          <span className={boring ? "text-stardust-300" : "text-slate-600"}>(Crisis Text Line)</span>
        </li>
      </ul>
    </div>
  );
}

/** Two-tap confirm: one extra tap, no typing, no password — speed matters. */
export function TwoTapConfirm({
  question,
  confirmLabel,
  onConfirm,
  onBack,
  busy,
}: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onBack: () => void;
  busy?: boolean;
}) {
  return (
    <div className="space-y-6">
      <p className="text-lg font-semibold leading-relaxed text-star-100">{question}</p>
      <EqualWeightButtons
        first={onBack}
        firstLabel="Go back"
        second={onConfirm}
        secondLabel={busy ? "Working…" : confirmLabel}
        secondDisabled={busy}
      />
    </div>
  );
}

/** Actionable error line with retry. Never a bare "something went wrong". */
export function FormError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-400/40 bg-red-950/40 p-4 text-sm leading-relaxed text-red-200"
    >
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-[44px] rounded-xl border border-red-400/40 px-4 py-2 font-semibold text-red-100 hover:bg-red-900/40"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

/** Static loading state — no spinner animation. */
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-3" aria-live="polite">
      <p className="text-sm text-stardust-300">{label}</p>
      <div className="space-y-2" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 rounded-2xl bg-nebula-800/70" />
        ))}
      </div>
    </div>
  );
}

/** Stepper for Screen Time propose form. */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-nova-400/15 bg-nebula-950/60 px-4 py-3">
      <span className="text-sm font-medium text-star-200">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Less ${label}`}
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-nova-400/25 text-xl text-star-100 hover:bg-nebula-800"
        >
          −
        </button>
        <span className="w-16 text-center text-sm font-semibold text-star-100" aria-live="polite">
          {format(value)}
        </span>
        <button
          type="button"
          aria-label={`More ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-nova-400/25 text-xl text-star-100 hover:bg-nebula-800"
        >
          +
        </button>
      </div>
    </div>
  );
}
