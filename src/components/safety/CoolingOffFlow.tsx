"use client";

import { useState } from "react";
import {
  errorMessage,
  missingActions,
  type PendingRevoke,
  type RevokePerson,
  type RevokeScope,
  type SafetyActions,
  type TrustedAdult,
} from "./types";
import { TrustedAdultFlow, type GateOutcome } from "./TrustedAdultFlow";
import {
  AcknowledgmentCheckbox,
  BoringSheet,
  CrisisResourceBlock,
  EqualWeightButtons,
  FormError,
  NeutralSheet,
  PlainList,
  PrimaryButton,
  QuietButton,
  TwoTapConfirm,
} from "./ui";

// [DV] Every string in Steps 1-6-safe is flagged for DV-advocate review (Appendix C gate #1).

const SCOPE_LABELS: Record<RevokeScope, string> = {
  performance: "Grades and what's due",
  communications: "Teacher messages",
  reflection: "Check-ins and journal",
  wellness: "Wellness and mood",
};

const SCOPE_CONSEQUENCES: Record<RevokeScope, string> = {
  performance: "Grade updates stop. No new grades, report cards, or what's due.",
  communications: "Teacher-message updates stop.",
  reflection: "Check-ins, journal, and chats with Pookie stay private. They already are.",
  wellness: "Wellness updates stop. Mood check-ins stay private to you.",
};

type Step = 1 | 2 | 3 | 4 | 5 | "pending" | "safe-1" | "safe-2" | "safe-done";

/**
 * Cooling-off flow (Steps 1–6-safe). Visual: Nebula-Neutral throughout;
 * safe-exit is Nebula-Boring. Entry (Step 0) is the "Remove access" row
 * button rendered by SharingRevoke.
 *
 * Safety rules enforced here: notify-at-effect default, safe-exit bypasses
 * the waiting window, no push/email/badge from any step, no celebration UI.
 */
export function CoolingOffFlow({
  person,
  allGranteeIds,
  childProfileId,
  teenFirstName,
  teenAge,
  actions,
  onClose,
  onCompleted,
}: {
  person: RevokePerson;
  /** All parent grantee ids — safe-exit cuts every parent at once. */
  allGranteeIds: string[];
  childProfileId: string;
  teenFirstName: string;
  teenAge: number;
  actions?: SafetyActions;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const a = actions ?? missingActions;
  const instant = teenAge >= 16 && teenAge <= 17;
  // Snapshot "now" once per mount (lazy initializer keeps render pure).
  const [now] = useState(() => Date.now());
  const [step, setStep] = useState<Step>(1);
  const [notifyMode, setNotifyMode] = useState<"at_effect" | "now">("at_effect");
  const [gateAdult, setGateAdult] = useState<TrustedAdult | null>(null);
  const [pending, setPending] = useState<PendingRevoke | null>(null);
  const [effectAt, setEffectAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = person.firstName;

  function onGateSatisfied(outcome: GateOutcome, adult: TrustedAdult | null) {
    if (outcome === "verified") setGateAdult(adult);
    setStep(3);
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await a.initiateRevoke({
        childProfileId,
        granteeId: person.id,
        scopes: person.scopes,
        notifyMode,
        instant,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setEffectAt(res.data.effectAt);
      setStep("pending");
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("initiate_failed"));
      setBusy(false);
    }
  }

  async function safeExit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await a.safeExit(childProfileId, allGranteeIds);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setStep("safe-done");
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("safe_exit_failed"));
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <TrustedAdultFlow
        childProfileId={childProfileId}
        teenFirstName={teenFirstName}
        requireRole="revoke_guardian"
        actions={a}
        onGateSatisfied={onGateSatisfied}
        onDone={() => setStep(1)}
      />
    );
  }

  if (step === "pending") {
    return (
      <PendingRevokeView
        firstName={firstName}
        scopes={person.scopes}
        effectAt={effectAt}
        notifyMode={notifyMode}
        instant={instant}
        teenFirstName={teenFirstName}
        actions={a}
        pendingId={pending?.id ?? null}
        onCancelled={() => {
          setPending(null);
          onCompleted();
        }}
        onDone={onCompleted}
      />
    );
  }

  if (step === "safe-1" || step === "safe-2" || step === "safe-done") {
    return (
      <BoringSheet>
        {step === "safe-1" ? (
          <div className="space-y-6">
            <p className="text-[15px] leading-relaxed text-slate-300">
              If telling your parents could put you at risk, you can cut off sharing right now,
              quietly.
            </p>
            <PlainList
              items={[
                "All sharing with your parents stops immediately.",
                "They don't get a message about this.",
                "Your safety messages from school still reach them.",
              ]}
            />
            <EqualWeightButtons
              first={onClose}
              firstLabel="Go back"
              second={() => setStep("safe-2")}
              secondLabel="Cut off sharing now"
            />
            <CrisisResourceBlock boring />
          </div>
        ) : null}
        {step === "safe-2" ? (
          <div className="space-y-6">
            <TwoTapConfirm
              question={`Cut off sharing with ${allGranteeIds.length > 1 ? "Mom and Dad" : firstName} right now?`}
              confirmLabel="Yes, cut it off now"
              onConfirm={() => void safeExit()}
              onBack={() => setStep("safe-1")}
              busy={busy}
            />
            {error ? <FormError message={error} onRetry={() => void safeExit()} /> : null}
          </div>
        ) : null}
        {step === "safe-done" ? (
          <div className="space-y-5">
            <h1 className="text-xl font-semibold text-slate-100">Done. Your sharing is off.</h1>
            <p className="text-[15px] text-slate-300">What you see now:</p>
            <div className="text-slate-300">
              <PlainList
                items={[
                  "Your parents see nothing new in Pookie.",
                  "No message was sent to them.",
                  gateAdult
                    ? `Your trusted adult is ${gateAdult.displayName}. Pookie can reach them if something looks unsafe.`
                    : "Pookie can still reach crisis help for you in the app.",
                ]}
              />
            </div>
            <CrisisResourceBlock boring />
            <p className="text-xs leading-relaxed text-slate-500">
              This is in your private history only. It doesn&apos;t show up anywhere your parents
              can see.
            </p>
            <PrimaryButton tone="neutral" onClick={onCompleted}>
              Back to my Pookie
            </PrimaryButton>
          </div>
        ) : null}
      </BoringSheet>
    );
  }

  return (
    <NeutralSheet>
      {step === 1 ? (
        <Step1Scope
          firstName={firstName}
          scopes={person.scopes}
          onContinue={() => setStep(2)}
          onClose={onClose}
        />
      ) : null}
      {step === 3 ? (
        <Step3Notify
          firstName={firstName}
          notifyMode={notifyMode}
          onChange={setNotifyMode}
          onContinue={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      ) : null}
      {step === 4 ? (
        <Step4Safety
          onSafeExit={() => setStep("safe-1")}
          onContinue={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      ) : null}
      {step === 5 ? (
        <div className="space-y-6">
          <h1 className="text-xl font-semibold text-star-100">Last check</h1>
          <p className="text-[15px] leading-relaxed text-stardust-200">
            You&apos;re removing {firstName}&apos;s access to{" "}
            {person.scopes.map((s) => SCOPE_LABELS[s].toLowerCase()).join(", ")}.{" "}
            {instant ? (
              <>This takes effect right now.</>
            ) : (
              <>
                This takes effect{" "}
                {new Date(now + 7 * 24 * 3600 * 1000).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                (7 days). Until then, nothing they see changes.
              </>
            )}{" "}
            You can cancel anytime in Sharing.
          </p>
          {error ? <FormError message={error} onRetry={() => void confirm()} /> : null}
          <EqualWeightButtons
            first={onClose}
            firstLabel={`Keep ${firstName}'s access`}
            second={() => void confirm()}
            secondLabel={busy ? "Working…" : instant ? "Remove now" : "Remove after 7 days"}
            secondDisabled={busy}
          />
        </div>
      ) : null}
    </NeutralSheet>
  );
}

function Step1Scope({
  firstName,
  scopes,
  onContinue,
  onClose,
}: {
  firstName: string;
  scopes: RevokeScope[];
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-star-100">Remove {firstName}&apos;s access?</h1>
      <div>
        <p className="mb-2 text-sm font-medium text-stardust-300">What changes if you do this:</p>
        <PlainList items={scopes.map((s) => SCOPE_CONSEQUENCES[s])} />
      </div>
      <p className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-4 text-sm leading-relaxed text-stardust-200">
        Pookie-only: your school still shares grades and attendance with your parents directly.
        This only changes what Pookie shares.
      </p>
      <div>
        <p className="mb-2 text-sm font-medium text-stardust-300">Before you decide, other options:</p>
        <PlainList
          items={[
            "Narrow it instead: turn off one thing, like location, and keep the rest.",
            "Pause for 30 days: everything freezes, nothing is deleted, and it turns back on by itself unless you say otherwise.",
            "Talk it through: write down what's bothering you first.",
          ]}
        />
      </div>
      <div className="space-y-3">
        <PrimaryButton tone="neutral" onClick={onContinue}>
          Continue
        </PrimaryButton>
        <QuietButton onClick={onClose}>Not now</QuietButton>
      </div>
    </div>
  );
}

function Step3Notify({
  firstName,
  notifyMode,
  onChange,
  onContinue,
  onBack,
}: {
  firstName: string;
  notifyMode: "at_effect" | "now";
  onChange: (m: "at_effect" | "now") => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-star-100">
        When should {firstName} find out?
      </h1>
      <div className="space-y-2" role="radiogroup" aria-label="When to notify">
        <label className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border border-nova-400/25 bg-nebula-800/60 p-4">
          <input
            type="radio"
            name="notify"
            checked={notifyMode === "at_effect"}
            onChange={() => onChange("at_effect")}
            className="mt-1 h-5 w-5 accent-pink-400"
          />
          <span className="text-[15px] leading-relaxed text-stardust-200">
            <strong className="text-star-100">When it takes effect</strong> (recommended): they see
            the change after it&apos;s done.
          </span>
        </label>
        <label className="flex min-h-[56px] cursor-pointer items-start gap-3 rounded-2xl border border-nova-400/25 bg-nebula-800/60 p-4">
          <input
            type="radio"
            name="notify"
            checked={notifyMode === "now"}
            onChange={() => onChange("now")}
            className="mt-1 h-5 w-5 accent-pink-400"
          />
          <span className="text-[15px] leading-relaxed text-stardust-200">
            <strong className="text-star-100">Tell them now:</strong> they get a message as soon as
            you confirm.
          </span>
        </label>
      </div>
      <p className="text-sm leading-relaxed text-stardust-300">
        Only {firstName} is told. Your other parent isn&apos;t notified. During the waiting period,
        what they see doesn&apos;t change.
      </p>
      <div className="space-y-3">
        <PrimaryButton tone="neutral" onClick={onContinue}>
          Continue
        </PrimaryButton>
        <QuietButton onClick={onBack}>Go back</QuietButton>
      </div>
    </div>
  );
}

function Step4Safety({
  onSafeExit,
  onContinue,
  onBack,
}: {
  onSafeExit: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [risk, setRisk] = useState(false);
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-star-100">One more thing</h1>
      <p className="text-[15px] leading-relaxed text-stardust-200">
        Your safety matters more than any setting.
      </p>
      <AcknowledgmentCheckbox
        label={
          <>
            <strong className="text-star-100">Telling my parents about this could put me at risk.</strong>
            <span className="mt-1 block text-sm text-stardust-300">
              If you check this: access ends right now, no message is sent, and we&apos;ll show you
              support options. You can always undo this later if things change.
            </span>
          </>
        }
        checked={risk}
        onChange={setRisk}
      />
      <EqualWeightButtons
        first={onBack}
        firstLabel="Go back"
        second={() => (risk ? onSafeExit() : onContinue())}
        secondLabel="Continue"
      />
    </div>
  );
}

/** Teen-visible pending state: "Removing in [N] days · Cancel anytime." */
export function PendingRevokeView({
  firstName,
  scopes,
  effectAt,
  notifyMode,
  instant,
  teenFirstName,
  actions,
  pendingId,
  onCancelled,
  onDone,
}: {
  firstName: string;
  scopes: RevokeScope[];
  effectAt: string | null;
  notifyMode: "at_effect" | "now";
  instant: boolean;
  teenFirstName: string;
  actions: SafetyActions;
  pendingId: string | null;
  onCancelled: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Snapshot "now" once per mount (lazy initializer keeps render pure).
  const [now] = useState(() => Date.now());

  const daysLeft = effectAt
    ? Math.max(0, Math.ceil((new Date(effectAt).getTime() - now) / (24 * 3600 * 1000)))
    : 0;

  async function cancel() {
    if (busy || !pendingId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.cancelRevoke(pendingId);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onCancelled();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("cancel_failed"));
      setBusy(false);
    }
  }

  return (
    <NeutralSheet>
      <div className="space-y-5">
        <h1 className="text-xl font-semibold text-star-100">
          Removing {firstName}&apos;s access{instant ? "" : ` in ${daysLeft} days`}
        </h1>
        <p className="text-[15px] leading-relaxed text-stardust-200">
          {notifyMode === "now" && !instant
            ? `${firstName} was told today. Access ends in ${daysLeft} days.`
            : `${teenFirstName}, ${firstName} sees your old info until this takes effect. Nothing new goes to them.`}{" "}
          You can cancel anytime.
        </p>
        <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-4">
          <p className="text-sm text-stardust-300">
            Scopes: {scopes.map((s) => SCOPE_LABELS[s]).join(" · ")}
          </p>
        </div>
        {error ? <FormError message={error} onRetry={() => void cancel()} /> : null}
        <div className="space-y-3">
          {pendingId ? (
            <PrimaryButton tone="neutral" onClick={() => void cancel()} disabled={busy}>
              {busy ? "Working…" : "Cancel, keep sharing"}
            </PrimaryButton>
          ) : null}
          <QuietButton onClick={onDone}>Back to Sharing</QuietButton>
        </div>
        <p className="text-xs leading-relaxed text-stardust-500">
          No messages about this were sent anywhere else. Your other parent was not notified.
        </p>
      </div>
    </NeutralSheet>
  );
}
