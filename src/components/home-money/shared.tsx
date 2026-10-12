// Squad 4 shared UI — TrustChip, InfoBanner, ImmutableCard, RetentionCountdown
// and the small helpers every Home & Money module builds on. Nebula theme:
// dark cosmos, soft green glows (never harsh), divine-light touches.
"use client";

import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BackButton } from "@/components/ui/back-button";

/* ------------------------------------------------------------------ */
/* api — canonical envelope { ok: true, data } / { ok: false, error }  */
/* ------------------------------------------------------------------ */

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // FormData bodies need the browser's multipart boundary — never force a
  // JSON content-type on them (it silently broke photo uploads).
  const { headers: initHeaders, ...rest } = init ?? {};
  const isForm = rest.body instanceof FormData;
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(isForm ? {} : { "content-type": "application/json" }),
      ...((initHeaders as Record<string, string> | undefined) ?? {}),
    },
  });
  const json = (await res.json().catch(() => null)) as {
    ok: boolean;
    data?: T;
    error?: { code?: string; message?: string };
  } | null;
  if (!json || !json.ok) {
    throw new ApiError(
      json?.error?.code ?? "INTERNAL",
      json?.error?.message ?? "Hold position — request incomplete. Try again in a moment.",
    );
  }
  return json.data as T;
}

/* ------------------------------------------------------------------ */
/* formatting                                                           */
/* ------------------------------------------------------------------ */

export function fmtMoney(n: number | string | null | undefined): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `$${v.toFixed(2)}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${hr}:${m} ${ampm}`;
}

/** Days (ceiling) until an ISO timestamp; negative when past. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "•";
}

/* ------------------------------------------------------------------ */
/* loading + error states                                               */
/* ------------------------------------------------------------------ */

export function LoadVeil({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-nebula-950/60 backdrop-blur-[2px]"
      />
      <div className="relative text-center">
        <div
          aria-hidden="true"
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-nova-500/20 border-t-nova-300"
          style={{ boxShadow: "0 0 24px rgb(52 211 153 / 0.25)" }}
        />
        <p className="mt-4 text-sm text-stardust-300">{label}</p>
      </div>
    </main>
  );
}

export function WarmError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="animate-rise rounded-2xl border border-aurum-400/40 bg-nebula-800/80 p-4"
    >
      <p className="text-sm text-stardust-200">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn-dapple mt-3 rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* trust / info surfaces                                                */
/* ------------------------------------------------------------------ */

export function TrustChip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-nova-500/30 bg-nebula-900/80 p-4 shadow-glow-sm">
      <span
        aria-hidden="true"
        className="text-xl"
        style={{ filter: "drop-shadow(0 0 8px rgb(52 211 153 / 0.6))" }}
      >
        🛡️
      </span>
      <div className="text-sm leading-relaxed text-stardust-200">{children}</div>
    </div>
  );
}

export function InfoBanner({
  icon = "ℹ️",
  children,
  action,
}: {
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg">
          {icon}
        </span>
        <div className="text-sm leading-relaxed text-stardust-200">{children}</div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Calm amber banner for first-class gated states (legal review, disclaimers). */
export function AmberBanner({
  icon = "⏳",
  children,
  action,
}: {
  icon?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="animate-rise rounded-2xl border border-aurum-400/45 bg-nebula-900/80 p-4 shadow-sun-warm">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg">
          {icon}
        </span>
        <div className="text-sm leading-relaxed text-stardust-100">{children}</div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ImmutableBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-nebula-700 bg-nebula-950/70 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-lg text-stardust-400">
          🔒
        </span>
        <div className="text-sm leading-relaxed text-stardust-300">{children}</div>
      </div>
    </div>
  );
}

/** Locked-card visual: flat slate, hairline border, no hover affordances. */
export function ImmutableCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-nebula-700/80 bg-nebula-950/80 p-4">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AvatarChip — first-initial chip; tap opens a tiny who/when sheet     */
/* ------------------------------------------------------------------ */

export function AvatarChip({
  name,
  detail,
}: {
  name: string;
  detail?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${name}${detail ? ` — ${detail}` : ""}`}
        title={`${name}${detail ? ` — ${detail}` : ""}`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-nova-500/40 bg-nebula-800 text-[10px] font-bold text-nova-300 shadow-glow-sm"
      >
        {initials(name)}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={name}>
        <p className="px-1 pb-6 text-sm text-stardust-300">
          {detail ?? name}
        </p>
      </BottomSheet>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Masked4 — last-4 only, always masked, never expandable              */
/* ------------------------------------------------------------------ */

export function Masked4({ last4 }: { last4: string | null | undefined }) {
  if (!last4) return <span className="text-stardust-500">no number on file</span>;
  return (
    <span className="font-mono tracking-wider text-stardust-200">
      ••••&nbsp;{last4}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* RetentionCountdown — the honest window into a legal retention timer */
/* ------------------------------------------------------------------ */

export function RetentionCountdown({
  label,
  startsAt,
  endsAt,
  purged,
  onDeleteNow,
  deleting,
  deleteLabel = "Delete now",
}: {
  label: string;
  startsAt?: string | null;
  endsAt?: string | null;
  purged?: boolean;
  onDeleteNow?: () => void;
  deleting?: boolean;
  deleteLabel?: string;
}) {
  if (purged) {
    return (
      <div className="rounded-xl border border-nebula-700 bg-nebula-950/60 px-3 py-2">
        <p className="text-xs text-stardust-400">
          🗑️ {label} — securely deleted. The extracted details stay in your file.
        </p>
      </div>
    );
  }
  if (!endsAt) {
    return (
      <div className="rounded-xl border border-nebula-700 bg-nebula-950/60 px-3 py-2">
        <p className="text-xs text-stardust-300">
          ♾️ {label} — kept until you delete it. We never share it.
        </p>
      </div>
    );
  }
  const remaining = daysUntil(endsAt) ?? 0;
  const totalMs =
    startsAt != null
      ? new Date(endsAt).getTime() - new Date(startsAt).getTime()
      : 30 * 86_400_000;
  const frac =
    totalMs > 0
      ? Math.min(1, Math.max(0, (new Date(endsAt).getTime() - Date.now()) / totalMs))
      : 0;
  const urgent = remaining <= 7;
  return (
    <div className="rounded-xl border border-nebula-700 bg-nebula-950/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-stardust-300">
          ⏳ {label} — auto-deletes in{" "}
          <span className={urgent ? "font-semibold text-aurum-200" : "font-semibold text-star-100"}>
            {remaining <= 0 ? "under a day" : `${remaining} day${remaining === 1 ? "" : "s"}`}
          </span>
        </p>
        {onDeleteNow && (
          <button
            onClick={onDeleteNow}
            disabled={deleting}
            className="shrink-0 rounded-lg border border-nebula-600 px-2 py-1 text-[11px] font-medium text-stardust-300 hover:border-nova-500 hover:text-star-100 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : deleteLabel}
          </button>
        )}
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-nebula-800"
        role="progressbar"
        aria-valuenow={Math.round(frac * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} retention remaining`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${frac * 100}%`,
            background: urgent
              ? "linear-gradient(90deg, rgb(251 191 36 / 0.9), rgb(251 191 36 / 0.5))"
              : "linear-gradient(90deg, rgb(52 211 153 / 0.9), rgb(52 211 153 / 0.4))",
            boxShadow: urgent
              ? "0 0 8px rgb(251 191 36 / 0.4)"
              : "0 0 8px rgb(52 211 153 / 0.4)",
          }}
        />
      </div>
      <p className="mt-1 text-[11px] text-stardust-500">
        We keep only the extracted details.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LaneTitle — collapsed-section heading with count                     */
/* ------------------------------------------------------------------ */

export function LaneTitle({
  children,
  count,
}: {
  children: ReactNode;
  count?: number;
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-nova-300 capitalize">
      {children}
      {count != null && (
        <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300 shadow-glow-sm">
          {count}
        </span>
      )}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* PageHeader — module eyebrow + title + subtitle                        */
/* ------------------------------------------------------------------ */

export function PageHeader({
  eyebrow,
  icon,
  title,
  subtitle,
  back = false,
}: {
  eyebrow: string;
  icon: string;
  title: string;
  subtitle: string;
  /** Show the shared BackButton above the eyebrow (sub-pages only). */
  back?: boolean;
}) {
  return (
    <header className="animate-rise">
      {back && (
        <div className="mb-3">
          <BackButton />
        </div>
      )}
      <p className="text-xs font-semibold tracking-widest text-aurum-300 capitalize">
        {eyebrow}
      </p>
      <h1 className="text-sunlit mt-1 text-3xl font-bold">
        <span aria-hidden="true" className="mr-2">
          {icon}
        </span>
        {title}
      </h1>
      <p className="mt-1 text-sm text-stardust-300">{subtitle}</p>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* QuietConfirm — in-app confirm sheet (never window.confirm)           */
/* ------------------------------------------------------------------ */

export function QuietConfirm({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  busy,
  danger,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="px-1 pb-6">
        <div className="text-sm leading-relaxed text-stardust-300">{body}</div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-lg px-5 py-2 text-sm font-semibold disabled:opacity-50 ${
              danger
                ? "bg-aurum-400 text-nebula-950 hover:bg-aurum-300"
                : "btn-dapple text-nebula-950"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-nebula-700 px-5 py-2 text-sm text-stardust-300 hover:border-nova-500"
          >
            Keep
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
