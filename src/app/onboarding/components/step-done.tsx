"use client";

import { useRouter } from "next/navigation";
import {
  InfoLine,
  PrimaryButton,
  StepShell,
} from "./ui";

export type DoneVariant = { kind: "named" } | { kind: "skipped" };

/**
 * Done. Onboarding is already marked complete server-side by the time this
 * renders; this screen confirms and hands off to the pilot's own bridge.
 * No children questions were asked — the Crew menu is where that lives.
 */
export function StepDone({ variant }: { variant: DoneVariant }) {
  const router = useRouter();

  return (
    <StepShell
      eyebrow="Cleared for launch"
      title={variant.kind === "named" ? "You're aboard" : "Welcome aboard"}
      sub="Your cockpit is ready — your day, your money, your plans, one calm bridge. If kids are part of your life, the Crew station is waiting whenever you are."
    >
      <InfoLine>
        Pookie works quietly in the background — handling the small stuff,
        and speaking up only when something needs you.
      </InfoLine>
      <div className="mt-6">
        <PrimaryButton type="button" onClick={() => router.push("/")}>
          Take the helm
        </PrimaryButton>
      </div>
    </StepShell>
  );
}
