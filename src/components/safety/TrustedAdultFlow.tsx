"use client";

import { useEffect, useRef, useState } from "react";
import {
  DECLINE_ACK_VERSION,
  errorMessage,
  missingActions,
  type SafetyActions,
  type TrustedAdult,
  type TrustedAdultRelationship,
  type TrustedAdultRole,
} from "./types";
import {
  AcknowledgmentCheckbox,
  BoringSheet,
  EqualWeightButtons,
  Field,
  FormError,
  FullPageFlow,
  inputClass,
  LoadingState,
  PendingStatusCard,
  PlainList,
  PrimaryButton,
  QuietButton,
  RelationshipChips,
} from "./ui";

export type GateOutcome = "verified" | "declined" | "unverified_ack";

const RELATIONSHIP_OPTIONS: { value: TrustedAdultRelationship; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "relative", label: "Relative" },
  { value: "counselor", label: "Counselor" },
  { value: "coach", label: "Coach" },
  { value: "faith_leader", label: "Faith leader" },
  { value: "neighbor", label: "Neighbor" },
  { value: "other", label: "Other" },
];

function statusChip(status: TrustedAdult["verificationStatus"]): string {
  switch (status) {
    case "verified":
      return "Confirmed ✓";
    case "pending":
    case "unverified":
      return "Waiting for confirmation";
    case "failed":
      return "Could not confirm, try again";
  }
}

/**
 * Trusted-adult designation flow: Screen A (why) → B (nominate) →
 * C (verification pending), plus the §1.5 decline path (Nebula-Boring,
 * equal-weight buttons, checkbox unchecked by default).
 *
 * Used as a gate before revoke / go-independent execution, at first
 * crisis-surface use, and from Settings → Safety → "My trusted adults".
 * When `requireRole` is set and a verified adult with that role already
 * exists, the flow completes immediately.
 */
export function TrustedAdultFlow({
  childProfileId,
  teenFirstName,
  requireRole,
  actions,
  onGateSatisfied,
  onDone,
}: {
  childProfileId: string;
  teenFirstName: string;
  requireRole?: TrustedAdultRole;
  actions?: SafetyActions;
  onGateSatisfied: (outcome: GateOutcome, adult: TrustedAdult | null) => void;
  onDone: () => void;
}) {
  const a = actions ?? missingActions;
  const [stage, setStage] = useState<"loading" | "list" | "why" | "nominate" | "pending" | "decline">("loading");
  const [adults, setAdults] = useState<TrustedAdult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingAdultId, setPendingAdultId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.listTrustedAdults(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          // Surface the error on Screen A with a retry (never a stuck spinner).
          setStage((s) => (s === "loading" ? "why" : s));
          return;
        }
        setAdults(res.data);
        if (requireRole) {
          const ok = res.data.find(
            (x) => x.verificationStatus === "verified" && x.roles.includes(requireRole)
          );
          if (ok) {
            onGateSatisfied("verified", ok);
            return;
          }
        }
        setStage(res.data.length > 0 ? "list" : "why");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : errorMessage("load_failed"));
          setStage((s) => (s === "loading" ? "why" : s));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshAdults() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  const pendingAdult = adults.find((x) => x.id === pendingAdultId) ?? null;

  if (stage === "loading") {
    return (
      <FullPageFlow>
        <LoadingState label="Loading your trusted adults…" />
      </FullPageFlow>
    );
  }

  if (stage === "decline") {
    return (
      <DeclineScreen
        teenFirstName={teenFirstName}
        onBack={() => setStage("why")}
        onDeclined={() => onGateSatisfied("declined", null)}
        actions={a}
        childProfileId={childProfileId}
      />
    );
  }

  if (stage === "pending" && pendingAdult) {
    return (
      <PendingScreen
        adult={pendingAdult}
        teenFirstName={teenFirstName}
        childProfileId={childProfileId}
        actions={a}
        onVerified={(adult) => onGateSatisfied("verified", adult)}
        onDone={onDone}
        onPickDifferent={() => setStage("nominate")}
      />
    );
  }

  if (stage === "nominate") {
    return (
      <NominateScreen
        requireRole={requireRole}
        actions={a}
        childProfileId={childProfileId}
        onBack={() => setStage(adults.length > 0 ? "list" : "why")}
        onNominated={(id) => {
          setPendingAdultId(id);
          setStage("pending");
          // Refresh the list without clobbering the pending screen. If the
          // backend auto-verified (parent-vouched), complete the gate now.
          void (async () => {
            try {
              const res = await a.listTrustedAdults(childProfileId);
              if (res.ok) {
                setAdults(res.data);
                const added = res.data.find((x) => x.id === id);
                if (added && added.verificationStatus === "verified") {
                  onGateSatisfied("verified", added);
                }
              }
            } catch {
              // The pending screen stays up; the teen can tap Done for now.
            }
          })();
        }}
      />
    );
  }

  if (stage === "list") {
    return (
      <ManageScreen
        adults={adults}
        teenFirstName={teenFirstName}
        actions={a}
        onAdd={() => setStage("nominate")}
        onChanged={refreshAdults}
        onContinueGate={
          requireRole ? undefined : () => onGateSatisfied("verified", adults.find((x) => x.verificationStatus === "verified") ?? null)
        }
      />
    );
  }

  return (
    <FullPageFlow>
      <p className="text-sm font-medium text-nova-300">Safety first</p>
      <h1 className="mt-2 text-2xl font-semibold text-star-100">One adult we can reach</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-stardust-200">
        Before this change goes through, you need one adult Pookie can reach in a real emergency.
        This adult does <strong className="text-star-100">not</strong> get to see your Pookie, they
        only get a safety alert if you are in danger. You choose them. You can change this anytime.
      </p>
      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={() => setStage("nominate")}>Choose an adult</PrimaryButton>
        <QuietButton onClick={() => setStage("decline")}>I don&apos;t want to name one</QuietButton>
      </div>
      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={refreshAdults} />
        </div>
      ) : null}
    </FullPageFlow>
  );
}

/** Screen B — nominate. */
function NominateScreen({
  requireRole,
  actions,
  childProfileId,
  onBack,
  onNominated,
}: {
  requireRole?: TrustedAdultRole;
  actions: SafetyActions;
  childProfileId: string;
  onBack: () => void;
  onNominated: (trustedAdultId: string) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<TrustedAdultRelationship | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && (phone.trim().length > 0 || email.trim().length > 0);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.nominateTrustedAdult({
        childProfileId,
        displayName: name.trim(),
        relationship: relationship ?? "other",
        contactChannel: phone.trim() ? "sms" : "email",
        contactValue: phone.trim() || email.trim(),
        note: note.trim() || undefined,
        roles: requireRole ? [requireRole, "crisis_alert"] : ["crisis_alert"],
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onNominated(res.data.trustedAdultId);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("submit_failed"));
      setBusy(false);
    }
  }

  return (
    <FullPageFlow>
      <button
        type="button"
        onClick={onBack}
        className="mb-4 min-h-[44px] text-sm font-medium text-stardust-300 hover:text-star-100"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-semibold text-star-100">Name Your Adult</h1>
      <p className="mt-2 text-sm leading-relaxed text-stardust-300">
        Pick someone you trust. They only get safety alerts, never your private stuff.
      </p>
      <form
        className="mt-6 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Field label="Their name">
          <input
            className={inputClass}
            placeholder="Aunt Rosa"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            autoComplete="off"
          />
        </Field>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-star-200">How do you know them</span>
          <RelationshipChips
            value={relationship}
            onChange={(v) => setRelationship(v as TrustedAdultRelationship)}
            options={RELATIONSHIP_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <Field
          label="How to reach them"
          hint="We'll text them a short message to confirm this number is really theirs."
        >
          <div className="space-y-3">
            <input
              className={inputClass}
              placeholder="Phone number (best for emergencies)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
            <input
              className={inputClass}
              placeholder="Email (if no phone)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              autoComplete="off"
            />
          </div>
        </Field>
        <Field label="Note for them (optional)">
          <input
            className={inputClass}
            placeholder="Call after 5pm"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 140))}
            maxLength={140}
            autoComplete="off"
          />
        </Field>
        {error ? <FormError message={error} onRetry={submit} /> : null}
        {!valid ? (
          <p className="text-sm text-stardust-300">
            Add a name and a phone number or email so we can reach them.
          </p>
        ) : null}
        <PrimaryButton type="submit" disabled={!valid || busy}>
          {busy ? "Sending…" : "Send confirmation"}
        </PrimaryButton>
      </form>
    </FullPageFlow>
  );
}

/** Screen C — verification pending. Static waiting state, no spinner animation. */
function PendingScreen({
  adult,
  teenFirstName,
  childProfileId,
  actions,
  onVerified,
  onDone,
  onPickDifferent,
}: {
  adult: TrustedAdult;
  teenFirstName: string;
  childProfileId: string;
  actions: SafetyActions;
  onVerified: (adult: TrustedAdult) => void;
  onDone: () => void;
  onPickDifferent: () => void;
}) {
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tries = useRef(0);

  // Gentle poll: if the adult confirms while this screen is open, move on.
  useEffect(() => {
    const id = window.setInterval(async () => {
      tries.current += 1;
      if (tries.current > 20) {
        window.clearInterval(id);
        return;
      }
      try {
        const res = await actions.listTrustedAdults(childProfileId);
        if (res.ok) {
          const confirmed = res.data.find(
            (x) => x.id === adult.id && x.verificationStatus === "verified"
          );
          if (confirmed) {
            window.clearInterval(id);
            onVerified(confirmed);
          }
        }
      } catch {
        // Keep the static screen up; the teen can tap Done for now.
      }
    }, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adult.id, childProfileId]);

  async function resend() {
    setError(null);
    try {
      const res = await actions.resendAdultVerification(adult.id);
      if (!res.ok) {
        setError(errorMessage(res.error));
        return;
      }
      setResent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("resend_failed"));
    }
  }

  return (
    <FullPageFlow>
      <PendingStatusCard>
        <h1 className="text-xl font-semibold text-star-100">Waiting on {adult.displayName}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
          We sent a text to {adult.displayName}. They need to tap the link to confirm. You can
          finish choosing later, your request is saved as a draft.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm text-stardust-300">
          <span
            aria-hidden="true"
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              adult.verificationStatus === "verified" ? "bg-comet-400" : "bg-aurum-400"
            }`}
          />
          {statusChip(adult.verificationStatus)}
        </div>
      </PendingStatusCard>
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      {resent ? (
        <p className="mt-4 text-sm text-comet-300">Sent again. Give them a few minutes.</p>
      ) : null}
      <div className="mt-6 space-y-3">
        {adult.verificationStatus === "verified" ? (
          <PrimaryButton
            onClick={() => onVerified(adult)}
          >
            Continue
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={onDone}>Done for now</PrimaryButton>
        )}
        <QuietButton onClick={resend}>Didn&apos;t get the text? Send it again</QuietButton>
        <QuietButton onClick={onPickDifferent}>Use a different adult</QuietButton>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-stardust-500">
        {teenFirstName}, this step is only about safety alerts. {adult.displayName} will never see
        your Pookie.
      </p>
    </FullPageFlow>
  );
}

/** The §1.5 decline path — Nebula-Boring, no dark patterns. */
function DeclineScreen({
  teenFirstName,
  onBack,
  onDeclined,
  actions,
  childProfileId,
}: {
  teenFirstName: string;
  onBack: () => void;
  onDeclined: () => void;
  actions: SafetyActions;
  childProfileId: string;
}) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decline() {
    if (!checked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.declineTrustedAdult(childProfileId, DECLINE_ACK_VERSION);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onDeclined();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("decline_failed"));
      setBusy(false);
    }
  }

  return (
    <BoringSheet>
      <h1 className="text-xl font-semibold text-slate-100">No adult named</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-slate-300">
        If you don&apos;t name an adult, here&apos;s what happens in an emergency:
      </p>
      <div className="mt-3 text-slate-300">
        <PlainList
          items={[
            "Pookie will still show you crisis help (988, Crisis Text Line) right in the app.",
            "No adult will be told. Not your parents, not anyone.",
            "You can name someone later anytime in Settings, Safety.",
          ]}
        />
      </div>
      <div className="mt-8">
        <AcknowledgmentCheckbox
          boring
          label="I understand no adult will be alerted if I'm in crisis."
          checked={checked}
          onChange={setChecked}
        />
      </div>
      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={decline} />
        </div>
      ) : null}
      <div className="mt-6">
        <EqualWeightButtons
          first={onBack}
          firstLabel="Go back and choose"
          second={decline}
          secondLabel={busy ? "Working…" : "Continue without naming anyone"}
          secondDisabled={!checked || busy}
        />
      </div>
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        {teenFirstName}, this is your choice. Nothing is shared either way.
      </p>
    </BoringSheet>
  );
}

/** §4.4 management list — teen-visible only. */
function ManageScreen({
  adults,
  teenFirstName,
  actions,
  onAdd,
  onChanged,
  onContinueGate,
}: {
  adults: TrustedAdult[];
  teenFirstName: string;
  actions: SafetyActions;
  onAdd: () => void;
  onChanged: () => void;
  onContinueGate?: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function remove(adult: TrustedAdult) {
    if (busyId) return;
    setBusyId(adult.id);
    setError(null);
    try {
      const res = await actions.deactivateTrustedAdult(adult.id);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusyId(null);
        return;
      }
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("remove_failed"));
    }
    setBusyId(null);
  }

  return (
    <FullPageFlow>
      <p className="text-sm font-medium text-nova-300">Settings, Safety</p>
      <h1 className="mt-2 text-2xl font-semibold text-star-100">Trusted adults</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
        The grown-ups Pookie can reach if you&apos;re in danger. They{" "}
        <strong className="text-star-100">can&apos;t see your Pookie</strong>. You choose them, and
        you can remove them anytime.
      </p>
      <ul className="mt-6 space-y-3">
        {adults.map((adult) => (
          <li
            key={adult.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4"
          >
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-star-100">{adult.displayName}</p>
              <p className="mt-0.5 text-xs text-stardust-300">
                {adult.relationshipLabel} · {adult.contactMasked} · {statusChip(adult.verificationStatus)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void remove(adult)}
              disabled={busyId === adult.id}
              aria-label={`Remove ${adult.displayName}`}
              className="min-h-[44px] shrink-0 rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100 disabled:opacity-50"
            >
              {busyId === adult.id ? "Working…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      {adults.length === 0 ? (
        <p className="mt-6 text-sm leading-relaxed text-stardust-300">
          {teenFirstName}, you haven&apos;t named anyone yet. Add one below, or skip for now.
        </p>
      ) : null}
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
      <div className="mt-6 space-y-3">
        <PrimaryButton onClick={onAdd} disabled={adults.filter((x) => x.verificationStatus !== "failed").length >= 5}>
          Add an adult
        </PrimaryButton>
        {adults.filter((x) => x.verificationStatus !== "failed").length >= 5 ? (
          <p className="text-sm text-stardust-300">
            You can have 5 at a time. Remove one to add another.
          </p>
        ) : null}
        {onContinueGate ? <QuietButton onClick={onContinueGate}>Continue</QuietButton> : null}
      </div>
    </FullPageFlow>
  );
}

/**
 * The one-time 48h-unverified nudge — in-app banner, Nebula-Neutral, quiet,
 * dismissible. Exactly one nudge; no push notification (no lock-screen leakage).
 * The parent screen decides eligibility from real data and passes the adult in.
 */
export function TrustedAdultNudge({
  adultDisplayName,
  onResend,
  onPickDifferent,
  onContinueWithout,
  onDismiss,
}: {
  adultDisplayName: string;
  onResend: () => void;
  onPickDifferent: () => void;
  onContinueWithout: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="status"
      className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] leading-relaxed text-stardust-200">
          {adultDisplayName} hasn&apos;t confirmed yet. You can send it again, pick a different
          adult, or continue without naming one.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-stardust-300 hover:text-star-100"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onResend}
          className="min-h-[44px] rounded-full border border-nova-400/40 bg-nova-400/15 px-4 py-2 text-sm font-semibold text-nova-200"
        >
          Send again
        </button>
        <button
          type="button"
          onClick={onPickDifferent}
          className="min-h-[44px] rounded-full border border-nova-400/20 px-4 py-2 text-sm font-medium text-stardust-200 hover:text-star-100"
        >
          Pick a different adult
        </button>
        <button
          type="button"
          onClick={onContinueWithout}
          className="min-h-[44px] rounded-full border border-nova-400/20 px-4 py-2 text-sm font-medium text-stardust-200 hover:text-star-100"
        >
          Continue without naming one
        </button>
      </div>
    </div>
  );
}
