"use client";

import { useEffect, useRef, useState } from "react";
import {
  errorMessage,
  missingActions,
  type BreakGlassRequesterKind,
  type BreakGlassRequestStatus,
  type SafetyActions,
} from "./types";
import {
  AcknowledgmentCheckbox,
  BoringSheet,
  CrisisResourceBlock,
  Field,
  FormError,
  FullPageFlow,
  OneTapHelpButtons,
  PrimaryButton,
  QuietButton,
  RelationshipChips,
  inputClass,
} from "./ui";

/* D1 — break-glass Path A: emergency access requests route to a contracted
   crisis-response vendor's trained human reviewers, not in-house staff.
   This is the REQUESTER-side flow only. No reviewer-side UI is built here
   (that's the vendor's surface). Waiting state copy: "A trained crisis
   reviewer is looking at your request right now" — never "our team". */

const REQUESTER_KINDS: { value: BreakGlassRequesterKind; label: string }[] = [
  { value: "trusted_adult", label: "I'm their trusted adult" },
  { value: "law_enforcement", label: "I'm law enforcement" },
  { value: "teen_self", label: "I'm the teen" },
  { value: "other", label: "Other" },
];

type Step = "request" | "corroboration" | "waiting" | "approved" | "denied" | "timed_out";

/**
 * Break-glass emergency-access request (Path A).
 * Request + corroboration → vendor human review (waiting state) →
 * approved / denied, with a timeout fallback to 988/911 + retry.
 */
export function BreakGlassRequest({
  childProfileId,
  teenFirstName,
  reviewTimeoutMinutes,
  actions,
  onClose,
}: {
  childProfileId: string;
  teenFirstName: string;
  /** Vendor SLA for first human response; fallback shows after this. */
  reviewTimeoutMinutes?: number;
  actions?: SafetyActions;
  onClose: () => void;
}) {
  const a = actions ?? missingActions;
  const timeoutMinutes = reviewTimeoutMinutes ?? 15;
  const [step, setStep] = useState<Step>("request");
  const [kind, setKind] = useState<BreakGlassRequesterKind | null>(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [caseId, setCaseId] = useState("");
  const [corroboratingAdult, setCorroboratingAdult] = useState("");
  const [exigency, setExigency] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [status, setStatus] = useState<BreakGlassRequestStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestValid =
    kind !== null && name.trim().length > 0 && contact.trim().length > 0 && whatHappened.trim().length > 0;
  const corroborationValid =
    exigency && (caseId.trim().length > 0 || corroboratingAdult.trim().length > 0);

  async function submit() {
    if (!requestValid || !corroborationValid || busy || !kind) return;
    setBusy(true);
    setError(null);
    try {
      const res = await a.submitBreakGlassRequest({
        childProfileId,
        requesterKind: kind,
        requesterName: name.trim(),
        requesterContact: contact.trim(),
        whatHappened: whatHappened.trim(),
        corroboration: {
          caseIdentifier: caseId.trim() || null,
          trustedAdultName: corroboratingAdult.trim() || null,
          exigencyAttested: exigency,
        },
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setRequestId(res.data.requestId);
      setReferenceCode(res.data.referenceCode);
      setStep("waiting");
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("submit_failed"));
    }
    setBusy(false);
  }

  if (step === "request") {
    return (
      <FullPageFlow>
        <h1 className="text-2xl font-semibold text-star-100">Request emergency access</h1>
        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
          If {teenFirstName} may be missing or in danger, you can ask a trained crisis reviewer to
          look at this. Only emergency locating info is ever shared, and every view is logged.
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-star-200">Who are you</span>
            <RelationshipChips
              value={kind}
              onChange={(v) => setKind(v as BreakGlassRequesterKind)}
              options={REQUESTER_KINDS}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="off"
              />
            </Field>
            <Field label="How can the reviewer reach you">
              <input
                className={inputClass}
                placeholder="Phone number"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                inputMode="tel"
                autoComplete="off"
              />
            </Field>
          </div>
          <Field label="What is happening">
            <textarea
              className={inputClass}
              rows={4}
              value={whatHappened}
              onChange={(e) => setWhatHappened(e.target.value.slice(0, 2000))}
              placeholder="Say plainly what you know and why you are worried"
            />
          </Field>
        </div>
        {error ? (
          <div className="mt-4">
            <FormError message={error} onRetry={() => void submit()} />
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          <PrimaryButton onClick={() => setStep("corroboration")} disabled={!requestValid}>
            Continue
          </PrimaryButton>
          <QuietButton onClick={onClose}>Cancel</QuietButton>
        </div>
      </FullPageFlow>
    );
  }

  if (step === "corroboration") {
    return (
      <FullPageFlow>
        <h1 className="text-2xl font-semibold text-star-100">Back it up</h1>
        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
          The reviewer needs something to check against. Give at least one of these, and confirm
          the emergency is real.
        </p>
        <div className="mt-5 space-y-4">
          <Field
            label="Missing-person case number (if police filed one)"
            hint="You may not have this yet. It helps, but it is not required."
          >
            <input
              className={inputClass}
              value={caseId}
              onChange={(e) => setCaseId(e.target.value)}
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <Field
            label="A trusted adult who can confirm this"
            hint="Someone on the teen's trusted-adult list, or NCMEC if they are involved."
          >
            <input
              className={inputClass}
              value={corroboratingAdult}
              onChange={(e) => setCorroboratingAdult(e.target.value)}
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <AcknowledgmentCheckbox
            label={
              <>
                <strong className="text-star-100">
                  I believe {teenFirstName} is in immediate danger of serious harm.
                </strong>
                <span className="mt-1 block text-sm text-stardust-300">
                  False reports can delay help for real emergencies and may be a crime.
                </span>
              </>
            }
            checked={exigency}
            onChange={setExigency}
          />
        </div>
        {!corroborationValid ? (
          <p className="mt-3 text-sm text-stardust-300">
            Confirm the statement above, and add a case number or a confirming adult.
          </p>
        ) : null}
        {error ? (
          <div className="mt-4">
            <FormError message={error} onRetry={() => void submit()} />
          </div>
        ) : null}
        <div className="mt-6 space-y-3">
          <PrimaryButton onClick={() => void submit()} disabled={!corroborationValid || busy}>
            {busy ? "Sending…" : "Send to a crisis reviewer"}
          </PrimaryButton>
          <QuietButton onClick={() => setStep("request")}>Go back</QuietButton>
        </div>
      </FullPageFlow>
    );
  }

  if (step === "waiting" && requestId) {
    return (
      <WaitingState
        requestId={requestId}
        referenceCode={referenceCode}
        teenFirstName={teenFirstName}
        timeoutMinutes={timeoutMinutes}
        actions={a}
        onResolved={(s) => {
          setStatus(s);
          if (s.state === "approved") setStep("approved");
          else if (s.state === "denied") setStep("denied");
          else setStep("timed_out");
        }}
      />
    );
  }

  if (step === "timed_out") {
    return (
      <FullPageFlow>
        <h1 className="text-2xl font-semibold text-star-100">Still no answer from the reviewer</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
          The reviewer hasn&apos;t responded within {timeoutMinutes} minutes. Don&apos;t wait on
          this page if someone may be in danger.
        </p>
        <div className="mt-5 rounded-2xl bg-white p-5 text-slate-900">
          <OneTapHelpButtons compact />
        </div>
        {referenceCode ? (
          <p className="mt-3 text-sm text-stardust-300">
            Your reference code is <strong className="text-star-100">{referenceCode}</strong>. Keep
            it if you call.
          </p>
        ) : null}
        <div className="mt-6 space-y-3">
          <PrimaryButton
            onClick={() => {
              setStatus(null);
              setStep("waiting");
            }}
          >
            Check again
          </PrimaryButton>
          <QuietButton onClick={onClose}>Close</QuietButton>
        </div>
      </FullPageFlow>
    );
  }

  if (step === "approved") {
    return (
      <FullPageFlow>
        <h1 className="text-2xl font-semibold text-star-100">Reviewer approved</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
          A trained crisis reviewer approved emergency access for {teenFirstName}. Only the
          locating info was shared, and the teen will be told what was shared and why.
        </p>
        {referenceCode ? (
          <p className="mt-3 text-sm text-stardust-300">
            Reference code: <strong className="text-star-100">{referenceCode}</strong>
          </p>
        ) : null}
        <div className="mt-6">
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </FullPageFlow>
    );
  }

  return (
    <BoringSheet>
      <h1 className="text-xl font-semibold text-slate-100">Not approved</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
        {status?.denialReason ??
          "The reviewer could not confirm this as an emergency. Nothing was shared."}
      </p>
      <div className="mt-5">
        <CrisisResourceBlock boring />
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-400">
        If the danger is real and now, call 911. You can also call the police non-emergency line to
        file a missing-person report.
      </p>
      <div className="mt-6">
        <PrimaryButton tone="neutral" onClick={onClose}>
          Close
        </PrimaryButton>
      </div>
    </BoringSheet>
  );
}

function WaitingState({
  requestId,
  referenceCode,
  teenFirstName,
  timeoutMinutes,
  actions,
  onResolved,
}: {
  requestId: string;
  referenceCode: string | null;
  teenFirstName: string;
  timeoutMinutes: number;
  actions: SafetyActions;
  onResolved: (s: BreakGlassRequestStatus) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const tick = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 60000));
    }, 15000);

    async function poll() {
      try {
        const res = await actions.getBreakGlassRequestStatus(requestId);
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        if (res.data.state !== "pending") {
          done.current = true;
          window.clearInterval(tick);
          window.clearInterval(pollId);
          onResolved(res.data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : errorMessage("status_failed"));
      }
    }
    const pollId = window.setInterval(poll, 20000);
    void poll();

    const timeoutId = window.setTimeout(() => {
      if (!done.current) {
        window.clearInterval(tick);
        window.clearInterval(pollId);
        onResolved({
          requestId,
          state: "expired",
          referenceCode: referenceCode ?? "",
          denialReason: null,
          updatedAt: new Date().toISOString(),
        });
      }
    }, timeoutMinutes * 60 * 1000);

    return () => {
      window.clearInterval(tick);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  return (
    <FullPageFlow>
      <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-6 text-center">
        <p className="text-sm font-medium text-nova-300">Request sent</p>
        <h1 className="mt-2 text-xl font-semibold leading-relaxed text-star-100">
          A trained crisis reviewer is looking at your request right now.
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
          They are checking your corroboration for {teenFirstName}. This page updates on its own.
          You can keep it open.
        </p>
        <p className="mt-3 text-sm text-stardust-300" aria-live="polite">
          Waiting {elapsed} {elapsed === 1 ? "minute" : "minutes"} so far.
        </p>
        {referenceCode ? (
          <p className="mt-2 text-sm text-stardust-300">
            Reference code: <strong className="text-star-100">{referenceCode}</strong>
          </p>
        ) : null}
      </div>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      <div className="mt-5 rounded-2xl bg-white p-5 text-slate-900">
        <p className="mb-3 text-sm font-semibold">If waiting feels wrong, don&apos;t wait:</p>
        <OneTapHelpButtons compact />
      </div>
    </FullPageFlow>
  );
}
