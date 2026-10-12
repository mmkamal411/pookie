import type { ReactNode } from "react";
import { PookieOrb } from "@/components/pookie-orb";

/**
 * Shared onboarding UI atoms — Nebula theme, ≤8th-grade copy, no legalese.
 * Matches the verify-invite visual language (card-living, nova buttons).
 */

export function StepShell({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <div className="card-living w-full rounded-3xl p-8">
      <div className="mx-auto flex w-fit">
        <PookieOrb size={64} />
      </div>
      <p className="mt-4 text-center text-xs font-medium capitalize tracking-[0.18em] text-nova-300">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-center text-2xl font-semibold text-star-100">
        {title}
      </h1>
      {sub && (
        <p className="mt-2 text-center text-sm leading-relaxed text-stardust-300">
          {sub}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function PrimaryButton({
  children,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-2xl bg-nova-500 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-2xl px-6 py-3 text-sm font-medium text-stardust-300 transition hover:text-star-100 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/** Small plain-English explainer line (sol-ux InfoLine). */
export function InfoLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 rounded-2xl border border-nebula-700 bg-nebula-900/60 p-3 text-xs leading-relaxed text-stardust-300">
      {children}
    </p>
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-stardust-200"
    >
      {message}
    </p>
  );
}

export const inputClass =
  "w-full rounded-2xl border border-nebula-700 bg-nebula-900/80 px-4 py-3 text-sm text-star-100 placeholder:text-stardust-500 outline-none transition focus:border-nova-400/70";

export const labelClass =
  "mb-1.5 block text-xs font-medium text-stardust-200";
