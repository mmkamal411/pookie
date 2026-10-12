"use client";

import { useState } from "react";
import { completeOnboarding } from "@/lib/onboarding/actions";
import {
  FieldError,
  InfoLine,
  PrimaryButton,
  QuietButton,
  StepShell,
  inputClass,
  labelClass,
} from "./ui";

/** Friendly copy for machine-readable error codes from completeOnboarding. */
function messageFor(code: string): string {
  switch (code) {
    case "not_signed_in":
      return "You're not signed in anymore. Please sign in again.";
    case "invalid_name":
      return "Please enter a name (up to 80 characters).";
    case "profiles_not_ready":
      return "Pookie is still setting up your profile. Please wait a moment and try again.";
    default:
      return "Couldn't save that. Please try again.";
  }
}

/**
 * Step 1 — display name. Skippable: "Skip for now" completes onboarding
 * immediately (dashboard in "just me" mode, no name stored).
 */
export function StepName({
  initialName,
  onContinue,
  onDone,
}: {
  initialName: string;
  onContinue: (name: string) => void;
  onDone: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function skip() {
    setBusy(true);
    setError(null);
    const result = await completeOnboarding();
    setBusy(false);
    if (result.ok) {
      onDone();
    } else {
      setError(messageFor(result.error));
    }
  }

  return (
    <StepShell
      eyebrow="Welcome"
      title="Meet Pookie"
      sub="The assistant that grows with you. Your day, your family, your plans — in one calm place. It takes 30 seconds to start."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onContinue(name.trim());
        }}
      >
        <label htmlFor="display-name" className={labelClass}>
          What should Pookie call you?
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={80}
          autoComplete="given-name"
          className={inputClass}
        />
        <InfoLine>Just a display name. You can change it anytime.</InfoLine>
        <div className="mt-6">
          <PrimaryButton>Continue</PrimaryButton>
        </div>
      </form>
      <FieldError message={error} />
      <div className="mt-1">
        <QuietButton onClick={skip} disabled={busy}>
          {busy ? "One moment…" : "Skip for now"}
        </QuietButton>
      </div>
    </StepShell>
  );
}
