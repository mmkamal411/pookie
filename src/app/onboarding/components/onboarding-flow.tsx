"use client";

import { useState } from "react";
import { NebulaBackground } from "@/components/nebula-background";
import { StepName } from "./step-name";
import { StepChildren, type ChildAdded } from "./step-children";
import { StepDone, type DoneVariant } from "./step-done";

type Step = "name" | "children" | "done";

/**
 * The /onboarding wizard shell. Skippable at every step: "Skip for now"
 * (step 1) and "Skip for now" (step 2) both complete onboarding server-side
 * and land on the Done screen — dashboard in "just me" mode.
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
      <NebulaBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12">
        {step === "name" && (
          <StepName
            initialName={displayName}
            onContinue={(name) => {
              setDisplayName(name);
              setStep("children");
            }}
            onDone={() => goDone({ kind: "skipped" })}
          />
        )}
        {step === "children" && (
          <StepChildren
            displayName={displayName}
            onJustMe={() => goDone({ kind: "justMe" })}
            onSkip={() => goDone({ kind: "skipped" })}
            onChildAdded={(result: ChildAdded) =>
              goDone({ kind: "child", result })
            }
          />
        )}
        {step === "done" && done && <StepDone variant={done} />}
      </div>
    </main>
  );
}
