"use client";

import { useRouter } from "next/navigation";
import {
  InfoLine,
  PrimaryButton,
  StepShell,
} from "./ui";
import type { ChildAdded } from "./step-children";

export type DoneVariant =
  | { kind: "justMe" }
  | { kind: "skipped" }
  | { kind: "child"; result: ChildAdded };

/**
 * Step 3 — Done. Onboarding is already marked complete server-side by the
 * time this renders; this screen confirms and hands off to the dashboard.
 */
export function StepDone({ variant }: { variant: DoneVariant }) {
  const router = useRouter();

  return (
    <StepShell
      eyebrow="Cleared for launch"
      title={
        variant.kind === "child"
          ? `${variant.result.childName} is aboard`
          : variant.kind === "justMe"
            ? "Solo flight confirmed"
            : "You're aboard"
      }
      sub={
        variant.kind === "justMe"
          ? "Your cockpit is all yours. You can bring crew aboard anytime from Ship systems → Family."
          : variant.kind === "child"
            ? "Pookie grows with your child — from full command, to shared flight, to their own independent ship."
            : "Your cockpit is ready. You can bring crew aboard anytime from Ship systems → Family."
      }
    >
      {variant.kind === "child" && variant.result.ageTier === "under13" && (
        <InfoLine>
          {variant.result.childName} is under 13, so this is a
          parent-managed profile — no login for them. You&apos;ll manage
          everything from your Pookie.
        </InfoLine>
      )}
      {variant.kind === "child" &&
        variant.result.ageTier !== "under13" &&
        variant.result.inviteSent &&
        variant.result.verifyUrl && (
          <InfoLine>
            Invite link for {variant.result.childName} — share it with them
            so they can claim their own login:
            <span className="mt-2 block break-all font-mono text-[11px] text-nova-300">
              {variant.result.verifyUrl}
            </span>
          </InfoLine>
        )}
      {variant.kind === "child" &&
        variant.result.ageTier !== "under13" &&
        !variant.result.inviteSent && (
          <InfoLine>
            No email was added, so this is parent-managed for now. You can
            invite {variant.result.childName} to their own login later from
            Ship systems → Family.
          </InfoLine>
        )}
      {variant.kind === "child" && variant.result.emailIgnored && (
        <InfoLine>
          The email you entered was ignored — children under 13 don&apos;t
          get logins. Nothing was sent anywhere.
        </InfoLine>
      )}
      <div className="mt-6">
        <PrimaryButton type="button" onClick={() => router.push("/")}>
          Take the helm
        </PrimaryButton>
      </div>
    </StepShell>
  );
}
