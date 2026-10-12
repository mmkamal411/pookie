"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeOnboarding,
  createChildProfile,
  type CreateChildResult,
} from "@/lib/onboarding/actions";
import { childErrorMessage } from "@/lib/onboarding/error-messages";
import {
  FieldError,
  InfoLine,
  PrimaryButton,
  QuietButton,
  StepShell,
  inputClass,
  labelClass,
} from "./ui";

/** Full years between a YYYY-MM-DD date and today (client-side preview). */
function previewAge(birthdate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthdate);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d)) {
    age -= 1;
  }
  return age;
}

export type ChildAdded = Extract<CreateChildResult, { ok: true }> & {
  childName: string;
};

/**
 * Step 2 — "Do you want to track children in Pookie?"
 * Three plain-English cards: Add a child / Just me / Skip for now.
 * The add-child branch carries the required legal gates: guardian
 * attestation (unchecked by default, cannot continue until checked),
 * birthdate (drives age tiering), the school-transparency disclosure,
 * and the under-13 COPPA notice when the DOB shows <13.
 */
export function StepChildren({
  displayName,
  onJustMe,
  onSkip,
  onChildAdded,
}: {
  displayName: string;
  onJustMe: () => void;
  onSkip: () => void;
  onChildAdded: (result: ChildAdded) => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"choice" | "form">("choice");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function connectFamily() {
    // The claim flow lives on its own page — the wizard stays resumable
    // via the back button; onboarding completes from the connect page.
    router.push("/onboarding/connect");
  }

  // Add-child form state.
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [attested, setAttested] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const age = previewAge(birthdate);
  const isUnder13 = age !== null && age >= 0 && age < 13;
  const isTeen = age !== null && age >= 13 && age < 18;

  async function finishOnboarding(): Promise<boolean> {
    const result = await completeOnboarding(displayName || undefined);
    if (!result.ok) {
      setError(childErrorMessage(result.error));
      return false;
    }
    return true;
  }

  async function justMe() {
    setBusy(true);
    setError(null);
    if (await finishOnboarding()) onJustMe();
    setBusy(false);
  }

  async function skip() {
    setBusy(true);
    setError(null);
    if (await finishOnboarding()) onSkip();
    setBusy(false);
  }

  async function submitChild(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await createChildProfile({
      name: name.trim(),
      birthdate,
      email: email.trim() || undefined,
      attested,
    });
    if (!result.ok) {
      setError(childErrorMessage(result.error));
      setBusy(false);
      return;
    }
    if (!(await finishOnboarding())) {
      setBusy(false);
      return;
    }
    setBusy(false);
    onChildAdded({ ...result, childName: name.trim().split(/\s+/)[0] });
  }

  if (mode === "choice") {
    return (
      <StepShell
        eyebrow="Crew manifest"
        title="Bring your crew aboard?"
        sub="Pookie adapts as your child takes command — from full command, to shared flight, to their own independent ship."
      >
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode("form")}
            disabled={busy}
            className="rounded-2xl border border-nebula-700 bg-nebula-900/60 p-5 text-left transition hover:border-nova-400/60 hover:bg-nebula-900 disabled:opacity-60"
          >
            <span className="block text-sm font-semibold text-star-100">
              Add a child
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
              School, grades, and daily rhythm — all on your console.
            </span>
          </button>
          <button
            type="button"
            onClick={justMe}
            disabled={busy}
            className="rounded-2xl border border-nebula-700 bg-nebula-900/60 p-5 text-left transition hover:border-nova-400/60 hover:bg-nebula-900 disabled:opacity-60"
          >
            <span className="block text-sm font-semibold text-star-100">
              Just me
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
              {busy
                ? "One moment…"
                : "Solo flight. Your Pookie is all yours."}
            </span>
          </button>
          <button
            type="button"
            onClick={connectFamily}
            disabled={busy}
            className="rounded-2xl border border-nebula-700 bg-nebula-900/60 p-5 text-left transition hover:border-nova-400/60 hover:bg-nebula-900 disabled:opacity-60"
          >
            <span className="block text-sm font-semibold text-star-100">
              Connect to my family
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
              Your child is already on Pookie — link yourself as their other
              parent. Approval required, no invite needed.
            </span>
          </button>
        </div>
        <FieldError message={error} />
        <div className="mt-2">
          <QuietButton onClick={skip} disabled={busy}>
            Skip for now
          </QuietButton>
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      eyebrow="Crew manifest"
      title="Tell us about your young astronaut"
      sub="Birthdate sets the right shields for their age. You can add more crew later from Ship Systems → Family."
    >
      <form onSubmit={submitChild} className="flex flex-col gap-4">
        <div>
          <label htmlFor="child-name" className={labelClass}>
            Child&apos;s Name
          </label>
          <input
            id="child-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            maxLength={120}
            autoComplete="off"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="child-dob" className={labelClass}>
            Birthdate
          </label>
          <input
            id="child-dob"
            type="date"
            value={birthdate}
            max={today}
            onChange={(e) => setBirthdate(e.target.value)}
            className={inputClass}
          />
          {isUnder13 && (
            <InfoLine>
              Children under 13 get a parent-managed profile — no login for
              them.
            </InfoLine>
          )}
          {isTeen && (
            <InfoLine>
              Teens 13–17 get their own login with built-in shields —
              they control what Pookie shares.
            </InfoLine>
          )}
        </div>
        <div>
          <label htmlFor="child-email" className={labelClass}>
            Child&apos;s Email <span className="text-stardust-500">(optional)</span>
          </label>
          <input
            id="child-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="For their own login (ages 13+)"
            maxLength={254}
            autoComplete="off"
            className={inputClass}
          />
          <InfoLine>
            If your child is 13 or older, we&apos;ll send an invite link to
            this email so they can claim their own login. Under 13, the email
            is ignored — they get a parent-managed profile instead.
          </InfoLine>
        </div>

        <InfoLine>
          Heads up: schools share grades and attendance with parents
          directly. Pookie settings only control what Pookie shares — not
          what the school shares.
        </InfoLine>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-nebula-700 bg-nebula-900/60 p-4">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-pink-500"
          />
          <span className="text-sm leading-relaxed text-stardust-200">
            I am this child&apos;s parent or legal guardian.
          </span>
        </label>

        <FieldError message={error} />
        <PrimaryButton disabled={busy || !attested}>
          {busy ? "Adding…" : "Add child"}
        </PrimaryButton>
      </form>
      <div className="mt-1">
        <QuietButton onClick={() => setMode("choice")} disabled={busy}>
          Back
        </QuietButton>
      </div>
    </StepShell>
  );
}
