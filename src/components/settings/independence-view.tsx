"use client";

// Settings → Family — the independence ("graduate") flow, visible to
// child-role users. 18+ only (gated on children.date_of_birth); under-18
// sees the "when you turn 18" message. Type-to-confirm + double-confirm;
// irreversible; nothing is deleted.
//
// The graduation mutation is the backend's graduateToIndependence server
// action (@/lib/tenant/actions) — it enforces the age check in the
// graduate_child_access RPC and redirects to /?graduated=1 on success.
// This view owns the gating and the confirmation UX.

import { useEffect, useState } from "react";
import { graduateToIndependence } from "@/lib/tenant/actions";
import { getIndependenceStatus } from "@/lib/family/actions";
import type { IndependenceStatus } from "@/lib/family/types";
import { SettingsCard, PrimaryButton, inputClass } from "./settings-ui";

const CONFIRM_WORD = "INDEPENDENT";

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Thrown by redirect() inside a server action — let it navigate. */
function isRedirectError(e: unknown): boolean {
  return (
    e instanceof Error &&
    "digest" in e &&
    typeof (e as { digest?: unknown }).digest === "string" &&
    (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function graduationErrorMessage(message: string): string {
  if (message.includes("not_a_child_member"))
    return "Only a child account can take ownership this way.";
  if (message.includes("18") || message.toLowerCase().includes("birthday") || message.toLowerCase().includes("age"))
    return "This is only available from your 18th birthday.";
  return "Couldn't complete the change — try again.";
}

export function IndependenceView() {
  const [status, setStatus] = useState<IndependenceStatus | null>(null);
  const [pending, setPending] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Confirmation flow
  const [started, setStarted] = useState(false);
  const [typed, setTyped] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await getIndependenceStatus();
        if (!cancelled) setStatus(s);
      } catch {
        if (!cancelled) setLoadError("Couldn't load your account — check your connection and try again.");
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGraduate() {
    if (!status?.childId) return;
    setWorking(true);
    setError(null);
    try {
      // Redirects to /?graduated=1 on success — the throw below is the
      // navigation itself; anything else is a real failure.
      await graduateToIndependence(status.childId);
    } catch (e) {
      if (isRedirectError(e)) return;
      setError(graduationErrorMessage(e instanceof Error ? e.message : ""));
      setWorking(false);
    }
  }

  if (pending) {
    return (
      <div className="space-y-4" aria-label="Loading your account">
        {[0, 1].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <SettingsCard title="Your account">
        <p className="text-sm text-red-300">{loadError}</p>
        <div className="mt-4">
          <PrimaryButton onClick={() => window.location.reload()}>Try again</PrimaryButton>
        </div>
      </SettingsCard>
    );
  }

  if (!status || !status.isChild) {
    return (
      <SettingsCard title="Your account">
        <p className="text-sm leading-relaxed text-stardust-300">
          This page is for child accounts. Parent accounts manage the family from the
          Family tab instead.
        </p>
      </SettingsCard>
    );
  }

  // Under 18 — the gate message.
  if (!status.eligible) {
    return (
      <SettingsCard
        title="Your account"
        description={`Signed in as ${status.childName ?? "you"}.`}
      >
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-center">
          <p className="text-4xl" aria-hidden="true">🛸</p>
          <p className="mt-3 text-sm font-medium text-star-100">Not quite yet</p>
          {status.dateOfBirth ? (
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
              When you turn 18
              {status.turnsEighteenOn ? ` on ${formatDate(status.turnsEighteenOn)}` : ""}, you&apos;ll
              be able to take ownership of your account here.
            </p>
          ) : (
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
              Once your birthday is saved to your profile, this option appears on your
              18th birthday — ask your parent to add it from the Profile tab.
            </p>
          )}
        </div>
      </SettingsCard>
    );
  }

  // 18+ — the flow.
  const canConfirm = understood && typed.trim().toUpperCase() === CONFIRM_WORD && !working;

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Your account"
        description={`Signed in as ${status.childName ?? "you"}.`}
      >
        <div className="rounded-2xl border border-nova-400/25 bg-nova-500/8 p-5">
          <p className="text-base font-semibold text-star-100">
            You&apos;re 18 now. You can take full ownership of your Pookie account.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stardust-300">
            This moves your account out from under your parent&apos;s login and makes you
            its owner. It&apos;s a one-way step — take a moment with what changes below.
          </p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium tracking-wide text-stardust-400 capitalize">
            What changes
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {[
              "Your parent will no longer see your dashboard.",
              "All your grades, check-ins, and history stay with you — nothing is deleted.",
              "You become the account owner: settings, invites, and school logins are yours to manage.",
              "This can't be undone from inside the app.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-sm text-stardust-200">
                <span
                  aria-hidden="true"
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-nova-400 shadow-glow-sm"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        {!started ? (
          <div className="mt-6">
            <PrimaryButton onClick={() => setStarted(true)}>I want to take ownership</PrimaryButton>
          </div>
        ) : (
          <div className="animate-bloom mt-6 space-y-4 rounded-2xl border border-red-400/25 bg-red-500/[0.06] p-5">
            <p className="text-sm font-semibold text-star-100">Last check — this is permanent</p>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-stardust-200">
              <input
                type="checkbox"
                checked={understood}
                onChange={(e) => setUnderstood(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 accent-pink-500"
              />
              <span>
                I understand my parent will lose access to my account and this can&apos;t be
                undone.
              </span>
            </label>
            <div>
              <label
                htmlFor="independence-confirm"
                className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 capitalize"
              >
                Type <span className="font-bold text-nova-300">{CONFIRM_WORD}</span> to confirm
              </label>
              <input
                id="independence-confirm"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                className={`${inputClass} max-w-xs tracking-[0.2em] uppercase`}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => void handleGraduate()}
                disabled={!canConfirm}
                className="rounded-xl bg-nova-500 px-4 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] hover:shadow-glow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {working ? "Finishing up…" : "Take ownership of my account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStarted(false);
                  setTyped("");
                  setUnderstood(false);
                  setError(null);
                }}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/30"
              >
                Not yet
              </button>
            </div>
          </div>
        )}
      </SettingsCard>
    </div>
  );
}
