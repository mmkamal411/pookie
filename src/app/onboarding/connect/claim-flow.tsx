"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeOnboarding } from "@/lib/onboarding/actions";
import {
  FieldError,
  InfoLine,
  PrimaryButton,
  QuietButton,
  StepShell,
  inputClass,
  labelClass,
} from "../components/ui";

type ClaimStatus = "pending" | "approved" | "rejected" | "human_review";
interface Claim {
  id: string;
  status: ClaimStatus;
  approver: "parent_a" | "teen" | null;
  created_at: string;
  decided_at: string | null;
  escalated: boolean;
}

type View = "loading" | "form" | "waiting" | "rejected" | "approved";

const DISMISS_KEY = (id: string) => `pookie-claim-dismissed-${id}`;

/**
 * "Connect to my family" — the D5 open-signup claim flow.
 *
 * Verified sign-in (page gate) → corroborated claim (child name/DOB +
 * creating-parent email + perjury-style attestation + custody attestation) →
 * uniform waiting state → approval (Parent A <13 / teen 13+) → connected.
 * Rejection = one-time dismissible card, no reason given. No enumeration
 * anywhere: the waiting copy is identical whether or not a child matched.
 */
export function ClaimFlow({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [view, setView] = useState<View>("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claim, setClaim] = useState<Claim | null>(null);

  const [childName, setChildName] = useState("");
  const [childDob, setChildDob] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [perjury, setPerjury] = useState(false);
  const [custodyOrders, setCustodyOrders] = useState<"yes" | "no" | "">("");
  const [custodyDetails, setCustodyDetails] = useState("");

  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/family/claims");
      const json = (await res.json()) as { ok: boolean; data?: { claims: Claim[] } };
      if (!res.ok || !json.ok) throw new Error("load_failed");
      const latest = json.data?.claims?.[0] ?? null;
      setClaim(latest);
      if (!latest) {
        setView("form");
      } else if (latest.status === "approved") {
        setView("approved");
      } else if (latest.status === "rejected") {
        // One-time dismissible card: once dismissed, don't show again.
        const dismissed =
          typeof window !== "undefined" && window.localStorage.getItem(DISMISS_KEY(latest.id));
        setView(dismissed ? "form" : "rejected");
      } else {
        // pending + human_review share the uniform waiting copy (no leak).
        setView("waiting");
      }
    } catch {
      setError("Couldn't check your requests — try again in a moment.");
      setView("form");
    }
  }, []);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/family/claims", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          child_name: childName.trim(),
          child_dob: childDob,
          creating_parent_email: parentEmail.trim(),
          perjury_attested: perjury,
          custody_disclosed: custodyOrders === "yes",
          custody_details: custodyOrders === "yes" ? custodyDetails.trim() || undefined : undefined,
        }),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message?: string; code?: string } };
      if (!res.ok || !json.ok) {
        if (res.status === 429) {
          throw new Error("You've sent several requests recently — please wait a day and try again.");
        }
        throw new Error(json.error?.message ?? "submit_failed");
      }
      setView("waiting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function dismissRejection() {
    if (claim) window.localStorage.setItem(DISMISS_KEY(claim.id), "1");
    setView("form");
    setChildName("");
    setChildDob("");
    setParentEmail("");
    setPerjury(false);
    setCustodyOrders("");
    setCustodyDetails("");
  }

  async function continueToPookie() {
    setBusy(true);
    await completeOnboarding(undefined);
    router.push("/");
  }

  const formValid =
    childName.trim().length >= 2 &&
    /^\d{4}-\d{2}-\d{2}$/.test(childDob) &&
    /.+@.+\..+/.test(parentEmail.trim()) &&
    perjury &&
    (custodyOrders === "yes" || custodyOrders === "no");

  return (
    <main className="relative flex min-h-screen min-h-dvh w-full overflow-hidden bg-nebula-950">
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12">
        {view === "loading" && (
          <StepShell eyebrow="Connect to my family" title="One moment…" sub="Checking your requests.">
            <p className="animate-pulse text-sm text-stardust-300">Loading…</p>
          </StepShell>
        )}

        {view === "form" && (
          <StepShell
            eyebrow="Connect to my family"
            title="Link yourself to your child"
            sub="No invite needed. Tell us who your child is — if they're on Pookie, the parent on record (or your teen, if they're 13+) will review your request."
          >
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <label htmlFor="claim-child-name" className={labelClass}>
                  Child&apos;s full name
                </label>
                <input
                  id="claim-child-name"
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="As it appears on their Pookie profile"
                  maxLength={120}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="claim-child-dob" className={labelClass}>
                  Child&apos;s birthdate
                </label>
                <input
                  id="claim-child-dob"
                  type="date"
                  value={childDob}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setChildDob(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="claim-parent-email" className={labelClass}>
                  The other parent&apos;s signup email
                </label>
                <input
                  id="claim-parent-email"
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="The email they used to sign up"
                  maxLength={200}
                  autoComplete="off"
                  className={inputClass}
                />
                <InfoLine>
                  This is the email the parent on record used when they created
                  your child&apos;s profile. It helps us route your request to
                  the right family.
                </InfoLine>
              </div>

              <div>
                <p className={labelClass}>Court orders</p>
                <p className="mb-2 text-xs text-stardust-300">
                  Are there any court orders limiting access to this child?
                </p>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCustodyOrders(v)}
                      aria-pressed={custodyOrders === v}
                      className={`flex-1 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                        custodyOrders === v
                          ? "border-nova-400/60 bg-nova-400/10 text-star-100"
                          : "border-nebula-700 bg-nebula-900/60 text-stardust-300"
                      }`}
                    >
                      {v === "yes" ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
                {custodyOrders === "yes" && (
                  <textarea
                    value={custodyDetails}
                    onChange={(e) => setCustodyDetails(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    placeholder="Briefly describe the order (optional — a reviewer may ask for the document)"
                    className={`${inputClass} mt-2`}
                  />
                )}
                <InfoLine>
                  Pookie doesn&apos;t decide custody. If there&apos;s a court
                  order, a person reviews your request instead of the automatic
                  path.
                </InfoLine>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-nebula-700 bg-nebula-900/60 p-4">
                <input
                  type="checkbox"
                  checked={perjury}
                  onChange={(e) => setPerjury(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-pink-500"
                />
                <span className="text-sm leading-relaxed text-stardust-200">
                  I declare under penalty of perjury that I am this child&apos;s
                  parent or legal guardian, and that everything I entered above
                  is true to the best of my knowledge. Signed as {userEmail || "me"}.
                </span>
              </label>

              <FieldError message={error} />
              <PrimaryButton disabled={busy || !formValid}>
                {busy ? "Sending…" : "Send request"}
              </PrimaryButton>
            </form>
            <div className="mt-1">
              <QuietButton onClick={() => router.push("/onboarding")} disabled={busy}>
                Back
              </QuietButton>
            </div>
          </StepShell>
        )}

        {view === "waiting" && (
          <StepShell
            eyebrow="Request sent"
            title="We've notified the parent on record"
            sub="If this child is in Pookie, the parent on record has your request and will review it. You'll see the decision here."
          >
            <InfoLine>
              Nothing else to do right now. Requests are usually reviewed within
              a few days — if there's no answer in 14 days, a person reviews it.
            </InfoLine>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton type="button" onClick={continueToPookie} disabled={busy}>
                Continue to my Pookie
              </PrimaryButton>
              <QuietButton onClick={() => router.push("/onboarding")} disabled={busy}>
                Back to onboarding
              </QuietButton>
            </div>
          </StepShell>
        )}

        {view === "rejected" && (
          <StepShell
            eyebrow="Update on your request"
            title="Not approved this time"
            sub="The request wasn't approved. No reason was given — that's the whole update."
          >
            <InfoLine>
              You can try again after 30 days. Your Pookie still works fully in
              the meantime.
            </InfoLine>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton type="button" onClick={dismissRejection}>
                Got it — dismiss
              </PrimaryButton>
              <QuietButton onClick={continueToPookie} disabled={busy}>
                Continue to my Pookie
              </QuietButton>
            </div>
          </StepShell>
        )}

        {view === "approved" && (
          <StepShell
            eyebrow="You're connected"
            title="Welcome to the family"
            sub="Your request was approved. You're now linked as a parent — grades, school, and sharing work the way your family set them up."
          >
            <div className="mt-6">
              <PrimaryButton type="button" onClick={continueToPookie} disabled={busy}>
                Go to my Pookie
              </PrimaryButton>
            </div>
          </StepShell>
        )}
      </div>
    </main>
  );
}
