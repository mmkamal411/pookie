"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChildProfile } from "@/lib/onboarding/actions";
import { childErrorMessage } from "@/lib/onboarding/error-messages";
import {
  FieldError,
  InfoLine,
  PrimaryButton,
  QuietButton,
  StepShell,
  inputClass,
  labelClass,
} from "@/app/onboarding/components/ui";

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

/**
 * Add-a-child form — the legal-gated door (guardian attestation, birthdate
 * age shields, under-13 COPPA notice). Used by the standalone /add-child
 * page and embedded in the Crew hub applet.
 *
 * It calls the same createChildProfile server action, which routes through
 * the provision_onboarding_child RPC (052) — the only child-creation path
 * that works without an existing parent membership. create_child() would
 * raise parent_membership_required for these users, so this form never
 * touches it.
 *
 * onAdded (optional): called with the new child's name after a successful
 * add. When absent, the form navigates home ("/") itself.
 */
export function AddChildForm({ onAdded }: { onAdded?: (childName: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [email, setEmail] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const age = previewAge(birthdate);
  const isUnder13 = age !== null && age >= 0 && age < 13;
  const isTeen = age !== null && age >= 13 && age < 18;

  async function submit(e: React.FormEvent) {
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
    const firstName = name.trim().split(/\s+/)[0];
    if (onAdded) {
      onAdded(firstName);
    } else {
      router.push("/");
    }
  }

  return (
    <StepShell
      eyebrow="Add a child"
      title="Tell us about your child"
      sub="Birthdate sets up the right protections for their age. You can manage your crew anytime from the Crew hub."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
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
              Teens 13–17 get their own login with built-in privacy
              protections — they control what Pookie shares.
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
        <QuietButton onClick={() => router.push("/me")} disabled={busy}>
          Back
        </QuietButton>
      </div>
    </StepShell>
  );
}
