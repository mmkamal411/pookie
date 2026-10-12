// Shared Travel UI — page shell, coarse-location gate, and data-state
// cards. Every travel module renders the same four data states:
// loading / loaded / empty / error (NO-PLACEHOLDERS §3).
//
// MD D7: the only location input is a user-typed ZIP (city-level coarse
// location). No precise-GPS code exists anywhere in this directory.

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Card, Button, EmptyState } from "@/components/ui";

export const ZIP_KEY = "pookie.travel.zip";

export function readStoredZip(): string {
  try {
    return window.localStorage.getItem(ZIP_KEY) ?? "";
  } catch {
    return "";
  }
}

export function storeZip(zip: string): void {
  try {
    window.localStorage.setItem(ZIP_KEY, zip);
  } catch {
    // private mode — the zip just won't persist
  }
}

/** Envelope-aware fetch for /api/v1 routes ({ ok, data } / { ok:false, error }). */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error?.message ?? "Hold position — request incomplete. Try again in a moment.") as Error & {
      code?: string;
      status?: number;
    };
    err.code = json.error?.code;
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

/** Page header: back link + sigil + title + subtitle. */
export function TravelPageShell({
  sigil,
  title,
  subtitle,
  backHref,
  children,
}: {
  sigil: string;
  title: string;
  subtitle: string;
  backHref: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <Link
        href={backHref}
        className="neon-hover neon-pink inline-block text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Back
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">
          {sigil}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">{title}</h1>
          <p className="text-sm text-stardust-300">{subtitle}</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </main>
  );
}

/** Coarse-location picker: ZIP only, with the D7 honesty line. */
export function ZipGate({
  value,
  onChange,
  label = "Where should Pookie look?",
}: {
  value: string;
  onChange: (zip: string) => void;
  label?: string;
}) {
  const [draft, setDraft] = useState(value);
  const valid = /^\d{5}$/.test(draft.trim());
  return (
    <Card>
      <label htmlFor="travel-zip" className="block text-sm font-medium text-star-100">
        {label}
      </label>
      <p className="mt-1 text-xs leading-relaxed text-stardust-400">
        Pookie only uses your ZIP code — a city-level area, never your precise location.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="travel-zip"
          inputMode="numeric"
          pattern="\d{5}"
          maxLength={5}
          placeholder="30064"
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valid) onChange(draft.trim());
          }}
          className="w-32 rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
        />
        <Button size="sm" disabled={!valid || draft.trim() === value} onClick={() => onChange(draft.trim())}>
          Look up
        </Button>
      </div>
    </Card>
  );
}

export function LoadingRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-xl border border-nova-400/10 bg-nebula-900/50"
        />
      ))}
    </div>
  );
}

export function ErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-amber-400/25">
      <p className="text-sm font-medium text-amber-200">Hmm, that didn't load.</p>
      <p className="mt-1 text-sm leading-relaxed text-stardust-300">{message}</p>
      {onRetry && (
        <div className="mt-3">
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Honest "not connected yet" card — complete code path, no fake data. */
export function InitializingCard({ title, message }: { title: string; message: string }) {
  return (
    <EmptyState
      icon="🔌"
      title={title}
      message={message}
    />
  );
}

/** Honest "credential missing" card — the integration code is complete. */
export function ConfigNeededCard({ title, message }: { title: string; message: string }) {
  return (
    <EmptyState
      icon="🔑"
      title={title}
      message={message}
    />
  );
}
