"use client";

import { useState } from "react";
import { StepName } from "./step-name";
import { StepDone, type DoneVariant } from "./step-done";

type Step = "name" | "done";

/**
 * The /onboarding wizard shell — user-first (Meheldi 2026-10-12).
 *
 * Registration asks ZERO children questions: the pilot sets up their own
 * life (name) and they're in. Adding children lives in the Crew feature
 * menu (legal gates intact there), never in registration.
 *
 * Skippable at every step: "Skip for now" completes onboarding server-side
 * and lands on the Done screen.
 */
export function OnboardingFlow({
  initialDisplayName,
}: {
  initialDisplayName: string;
}) {
  const [step, setStep] = useState<Step>("name");
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [done, setDone] = useState<DoneVariant | null>(null);

  function goDone(variant: DoneVariant) {
    setDone(variant);
    setStep("done");
  }

  return (
    <main className="relative flex min-h-screen min-h-dvh w-full overflow-hidden bg-nebula-950">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12">
        {step === "name" && (
          <StepName
            initialName={displayName}
            onContinue={(name) => {
              setDisplayName(name);
              goDone({ kind: "named" });
            }}
            onDone={() => goDone({ kind: "skipped" })}
          />
        )}
        {step === "done" && done && <StepDone variant={done} />}
      </div>
    </main>
  );
}
