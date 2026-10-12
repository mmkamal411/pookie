"use client";

import { useState } from "react";
import {
  errorMessage,
  missingActions,
  type SafetyActions,
  type CrisisLevel,
  type TrustedAdult,
} from "./types";
import { Field, FormError, OneTapHelpButtons, inputClass } from "./ui";

/* CrisisCard — high-contrast, always reachable (Settings → Safety →
   "Get help now"). No neon-on-neon: solid white card, dark text.
   Never a modal. L3 dismisses per session (sessionStorage); L4 stays
   until 988 or 911 is tapped or the session ends. [DV] */

function crisisSessionKey(level: CrisisLevel): string {
  return `pookie-crisis-dismissed-l${level}`;
}

function wasDismissedThisSession(level: CrisisLevel): boolean {
  try {
    return window.sessionStorage.getItem(crisisSessionKey(level)) === "1";
  } catch {
    return false;
  }
}

function dismissForSession(level: CrisisLevel): void {
  try {
    window.sessionStorage.setItem(crisisSessionKey(level), "1");
  } catch {
    /* session storage unavailable: card simply stays up */
  }
}

export function CrisisCard({
  level,
  context,
  trustedAdults,
  childProfileId,
  actions,
  onTellAdultSent,
}: {
  level: CrisisLevel;
  /** Where the card is placed: wellbeing | chat | checkin | settings */
  context: "wellbeing" | "chat" | "checkin" | "settings";
  trustedAdults?: TrustedAdult[];
  childProfileId?: string;
  actions?: SafetyActions;
  onTellAdultSent?: () => void;
}) {
  // Dismissal is per-session: read once at mount (lazy initializer, no effect).
  const [dismissed, setDismissed] = useState(() => level === 3 && wasDismissedThisSession(3));
  const [helpTapped, setHelpTapped] = useState(false);
  const [showTellAdult, setShowTellAdult] = useState(false);

  const dismissible = level === 3;
  if (dismissed && dismissible) return null;

  return (
    <section
      aria-label="Crisis help"
      data-context={context}
      className="rounded-2xl bg-white p-5 text-slate-900 shadow-lg sm:p-6"
    >
      <p className="text-[15px] leading-relaxed">
        If you&apos;re thinking about hurting yourself, you don&apos;t have to face it alone.
      </p>
      {/* Link activations bubble here: marks 988/911 as tapped for the L4 rule. */}
      <div className="mt-4" onClick={() => setHelpTapped(true)}>
        <OneTapHelpButtons compact />
      </div>
      <ul className="mt-4 space-y-1.5 text-sm leading-relaxed text-slate-700">
        <li>
          <a href="tel:988" className="font-bold text-slate-900 underline underline-offset-2">
            Call or text 988
          </a>{" "}
          — free, 24/7, confidential.
        </li>
        <li>
          <a href="sms:741741?body=HOME" className="font-bold text-slate-900 underline underline-offset-2">
            Text HOME to 741741
          </a>{" "}
          — Crisis Text Line.
        </li>
        <li>
          If you might act right now,{" "}
          <a href="tel:911" className="font-bold text-slate-900 underline underline-offset-2">
            call 911
          </a>
          .
        </li>
      </ul>

      {trustedAdults && trustedAdults.length > 0 && childProfileId ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          {showTellAdult ? (
            <TellAdultAction
              adults={trustedAdults}
              actions={actions ?? missingActions}
              onSent={() => {
                setShowTellAdult(false);
                onTellAdultSent?.();
              }}
              onCancel={() => setShowTellAdult(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowTellAdult(true)}
              className="min-h-[48px] w-full rounded-2xl border-2 border-slate-900 px-5 py-3 text-base font-bold text-slate-900 hover:bg-slate-100"
            >
              Let {trustedAdults[0].displayName.split(" ")[0]} know I&apos;m having a hard time
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {level === 4
            ? "This stays here until you tap 988 or 911, or this session ends."
            : "You can close this. It will be here again next time."}
        </p>
        {dismissible ? (
          <button
            type="button"
            onClick={() => {
              dismissForSession(3);
              setDismissed(true);
            }}
            aria-label="Close crisis help for this session"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        ) : !helpTapped ? (
          <span className="shrink-0 text-xs font-medium text-slate-500">Stays until 988 or 911 is tapped</span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Teen-controlled "tell a trusted adult": pick message tier → preview
 * exactly what the adult receives → send. Logged teen-visible.
 */
export function TellAdultAction({
  adults,
  actions,
  onSent,
  onCancel,
}: {
  adults: TrustedAdult[];
  actions: SafetyActions;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [adultId, setAdultId] = useState(adults[0]?.id ?? "");
  const [tier, setTier] = useState<"presence" | "with_note">("presence");
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adult = adults.find((x) => x.id === adultId) ?? adults[0];
  const noteValid = tier === "presence" || note.trim().length > 0;

  async function send() {
    if (!adult || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.tellTrustedAdult({
        trustedAdultId: adult.id,
        tier,
        note: tier === "with_note" ? note.trim().slice(0, 280) : undefined,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("send_failed"));
      setBusy(false);
    }
  }

  if (preview && adult) {
    const message =
      tier === "presence"
        ? "I'm having a hard time"
        : `I'm having a hard time. ${note.trim().slice(0, 280)}`;
    return (
      <div className="rounded-2xl border-2 border-slate-900 p-4">
        <p className="text-sm font-semibold text-slate-900">This is exactly what they get:</p>
        <blockquote className="mt-2 rounded-xl bg-slate-100 p-3 text-[15px] leading-relaxed text-slate-900">
          Pookie safety note: {message}
        </blockquote>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          This sends a text from Pookie to {adult.displayName}. It won&apos;t share your check-ins
          or chats.
        </p>
        {error ? (
          <div className="mt-3">
            <FormError message={error} onRetry={send} />
          </div>
        ) : null}
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] flex-1 rounded-2xl border border-slate-400 px-4 py-3 text-sm font-semibold text-slate-700"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy}
            className="min-h-[48px] flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send it"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Who should hear from you">
        <select
          value={adultId}
          onChange={(e) => setAdultId(e.target.value)}
          className={`${inputClass} !border-slate-300 !bg-white !text-slate-900`}
        >
          {adults.map((x) => (
            <option key={x.id} value={x.id}>
              {x.displayName}
            </option>
          ))}
        </select>
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-900">What to send</span>
        <div className="space-y-2" role="radiogroup" aria-label="Message">
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-4 py-2">
            <input
              type="radio"
              name="tier"
              checked={tier === "presence"}
              onChange={() => setTier("presence")}
              className="h-5 w-5 accent-slate-900"
            />
            <span className="text-sm text-slate-900">Just: “I&apos;m having a hard time”</span>
          </label>
          <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-4 py-2">
            <input
              type="radio"
              name="tier"
              checked={tier === "with_note"}
              onChange={() => setTier("with_note")}
              className="h-5 w-5 accent-slate-900"
            />
            <span className="text-sm text-slate-900">Add my own note</span>
          </label>
        </div>
      </div>
      {tier === "with_note" ? (
        <Field label="Your note (280 characters max)">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            rows={3}
            className={`${inputClass} !border-slate-300 !bg-white !text-slate-900`}
            placeholder="Say it in your own words"
          />
        </Field>
      ) : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[48px] flex-1 rounded-2xl border border-slate-400 px-4 py-3 text-sm font-semibold text-slate-700"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setPreview(true)}
          disabled={!noteValid}
          className="min-h-[48px] flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
        >
          Preview
        </button>
      </div>
    </div>
  );
}

/**
 * "How safety works" explainer — "private spaces are not safety-monitored"
 * copy verbatim. One-time, dismissible, re-findable in Settings → Safety.
 */
export function SafetyHowItWorks({
  storageKey,
  onDismiss,
}: {
  storageKey: string;
  onDismiss?: () => void;
}) {
  // One-time explainer: read the dismissal flag once at mount (lazy initializer).
  const [visible, setVisible] = useState(() => {
    try {
      return window.localStorage.getItem(storageKey) !== "1";
    } catch {
      return true;
    }
  });

  if (!visible) return null;
  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      /* private mode: stays visible, harmless */
    }
    setVisible(false);
    onDismiss?.();
  }

  return (
    <section
      aria-label="How safety works"
      className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5"
    >
      <h2 className="text-base font-semibold text-star-100">How Safety Works Here</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-stardust-200">
        <p>
          <strong className="text-star-100">Your private spaces are yours.</strong> Your moods,
          check-ins, and chats with Pookie are private to you, not even your parents can see them.
        </p>
        <p>
          <strong className="text-star-100">But they&apos;re not watched over.</strong> Pookie
          doesn&apos;t read everything you write looking for problems. If you use words that sound
          like you might hurt yourself, Pookie will show you help options and, only then, may alert
          the trusted adult you chose. Nothing else you write is ever sent to anyone.
        </p>
        <p>
          <strong className="text-star-100">If you need help now:</strong>{" "}
          <a href="tel:988" className="font-bold text-nova-300 underline underline-offset-2">
            call or text 988
          </a>
          .
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="mt-4 min-h-[44px] rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100"
      >
        Got it
      </button>
    </section>
  );
}

/** Collapsed check-in footer: "Want support options?" expands to the full card. */
export function CheckInSafetyFooter({
  trustedAdults,
  childProfileId,
  actions,
}: {
  trustedAdults?: TrustedAdult[];
  childProfileId?: string;
  actions?: SafetyActions;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[48px] w-full rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-medium text-stardust-300 hover:text-star-100"
      >
        Want support options?
      </button>
    );
  }
  return (
    <CrisisCard
      level={3}
      context="checkin"
      trustedAdults={trustedAdults}
      childProfileId={childProfileId}
      actions={actions}
    />
  );
}
