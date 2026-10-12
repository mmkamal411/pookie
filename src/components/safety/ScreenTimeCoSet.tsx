"use client";

import { useEffect, useState } from "react";
import {
  errorMessage,
  missingActions,
  type SafetyActions,
  type ScreenTimeAppeal,
  type ScreenTimePlan,
  type ScreenTimeState,
} from "./types";
import {
  Field,
  FormError,
  FullPageFlow,
  LoadingState,
  PrimaryButton,
  QuietButton,
  Stepper,
  inputClass,
} from "./ui";

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const r = min % 60;
  return r === 0 ? `${h}h` : `${h}h ${r}m`;
}

function statusLine(status: ScreenTimeState["status"], parentName: string): string {
  switch (status) {
    case "draft":
      return "Draft, not sent yet";
    case "proposed":
      return `Proposed by teen · Waiting on ${parentName}`;
    case "active":
      return "Active, you both agreed";
    case "change_requested":
      return "Change requested, waiting on a new plan";
  }
}

/**
 * Screen Time co-set (13+): teen proposes, parent approves, everyone sees
 * the same rules. No parent-only dashboard, no secret reports. Pookie never
 * watches secretly: if it's limited, it's listed here.
 */
export function ScreenTimeCoSet({
  childProfileId,
  viewerRole,
  teenName,
  parentName,
  actions,
}: {
  childProfileId: string;
  viewerRole: "teen" | "parent";
  teenName: string;
  parentName: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [state, setState] = useState<ScreenTimeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "propose" | "counter" | "appeal">("view");
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.getScreenTimeState(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setState(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshState() {
    setError(null);
    setMode("view");
    setReloadKey((k) => k + 1);
  }

  if (error && !state) {
    return (
      <FullPageFlow>
        <FormError message={error} onRetry={refreshState} />
      </FullPageFlow>
    );
  }
  if (!state) {
    return (
      <FullPageFlow>
        <LoadingState label="Loading the screen time plan…" />
      </FullPageFlow>
    );
  }

  const showPropose =
    viewerRole === "teen" &&
    (mode === "propose" || state.status === "draft" || state.status === "change_requested");
  const showReview =
    viewerRole === "parent" && (state.status === "proposed" || state.status === "change_requested");

  return (
    <FullPageFlow wide>
      <p className="text-sm font-medium text-nova-300">Screen Time</p>
      <h1 className="mt-2 text-2xl font-semibold text-star-100">A Deal You Both Can See</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-stardust-200">
        Screen Time in Pookie is a deal you both can see. {teenName} proposes, {parentName}{" "}
        approves, and everyone sees the same rules. Pookie never watches secretly: if it&apos;s
        limited, it&apos;s listed here.
      </p>

      <div className="mt-6">
        <SharedPlanCard
          state={state}
          teenName={teenName}
          parentName={parentName}
        />
      </div>

      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={refreshState} />
        </div>
      ) : null}

      {showPropose ? (
        <div className="mt-6">
          <PlanEditor
            initial={state.plan}
            teenName={teenName}
            parentName={parentName}
            submitLabel={`Send my plan to ${parentName}`}
            onSubmit={async (plan) => {
              const res = await a.proposeScreenTime(childProfileId, plan);
              if (!res.ok) throw new Error(errorMessage(res.error));
              refreshState();
            }}
            onCancel={state.status === "draft" ? undefined : () => setMode("view")}
          />
        </div>
      ) : null}

      {showReview ? (
        <div className="mt-6">
          {mode === "counter" ? (
            <PlanEditor
              initial={state.plan}
              teenName={teenName}
              parentName={parentName}
              submitLabel="Send my version to them"
              note={`If you change anything, ${teenName} sees your version and can respond. Nothing applies until you both agree.`}
              onSubmit={async (plan) => {
                const res = await a.reviewScreenTime(childProfileId, "counter", plan, null);
                if (!res.ok) throw new Error(errorMessage(res.error));
                refreshState();
              }}
              onCancel={() => setMode("view")}
            />
          ) : (
            <ReviewActions
              teenName={teenName}
              parentName={parentName}
              childProfileId={childProfileId}
              plan={state.plan}
              actions={a}
              onCounter={() => setMode("counter")}
              onDone={refreshState}
            />
          )}
        </div>
      ) : null}

      {viewerRole === "teen" && state.status === "active" && mode !== "appeal" ? (
        <div className="mt-6">
          <QuietButton onClick={() => setMode("appeal")}>Ask for a Change</QuietButton>
        </div>
      ) : null}

      {mode === "appeal" ? (
        <div className="mt-6">
          <AppealForm
            childProfileId={childProfileId}
            actions={a}
            onDone={refreshState}
            onCancel={() => setMode("view")}
          />
        </div>
      ) : null}

      <div className="mt-8">
        <AppealHistory
          childProfileId={childProfileId}
          viewerRole={viewerRole}
          teenName={teenName}
          parentName={parentName}
          actions={a}
          canRespond={viewerRole === "parent"}
        />
      </div>

      {viewerRole === "teen" && !showPropose && state.status === "draft" ? (
        <div className="mt-6">
          <PrimaryButton onClick={() => setMode("propose")}>Propose my limits</PrimaryButton>
        </div>
      ) : null}
    </FullPageFlow>
  );
}

/** The shared plan card — one component, identical numbers on both sides. */
export function SharedPlanCard({
  state,
  teenName,
  parentName,
}: {
  state: ScreenTimeState;
  teenName: string;
  parentName: string;
}) {
  const plan = state.plan;
  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-5">
      <h2 className="text-base font-semibold text-star-100">{teenName}&apos;s screen time plan</h2>
      <dl className="mt-3 space-y-2 text-[15px] leading-relaxed text-stardust-200">
        <div className="flex justify-between gap-4">
          <dt className="text-stardust-300">Bedtime wind-down</dt>
          <dd className="font-medium text-star-100">{fmtTime(plan.bedtimeWindDown)}, apps quiet down</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stardust-300">Daily budgets</dt>
          <dd className="text-right font-medium text-star-100">
            {plan.budgets.map((b) => `${b.category} ${fmtMinutes(b.minutes)}`).join(" · ")}
          </dd>
        </div>
        {plan.focusBlocks.map((f, i) => (
          <div key={i} className="flex justify-between gap-4">
            <dt className="text-stardust-300">Homework focus</dt>
            <dd className="text-right font-medium text-star-100">
              {f.days} {fmtTime(f.start)}–{fmtTime(f.end)}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-nova-400/15 pt-2">
          <dt className="text-stardust-300">Status</dt>
          <dd className="text-right font-medium text-nova-300">
            {statusLine(state.status, parentName)}
          </dd>
        </div>
        {state.lastChangeAt ? (
          <div className="flex justify-between gap-4">
            <dt className="text-stardust-300">Last change</dt>
            <dd className="text-right text-star-100">
              {new Date(state.lastChangeAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              by {state.lastChangeBy === "teen" ? teenName : parentName}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function PlanEditor({
  initial,
  teenName,
  parentName,
  submitLabel,
  note,
  onSubmit,
  onCancel,
}: {
  initial: ScreenTimePlan;
  teenName: string;
  parentName: string;
  submitLabel: string;
  note?: string;
  onSubmit: (plan: ScreenTimePlan) => Promise<void>;
  onCancel?: () => void;
}) {
  const [plan, setPlan] = useState<ScreenTimePlan>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("submit_failed"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5">
      <h2 className="text-base font-semibold text-star-100">The plan</h2>
      <p className="mt-1 text-sm text-stardust-300">
        This is what {parentName === teenName ? "everyone" : parentName} will see.
      </p>
      <div className="mt-4 space-y-4">
        <Field label="Bedtime wind-down">
          <input
            type="time"
            className={inputClass}
            value={plan.bedtimeWindDown}
            onChange={(e) => setPlan({ ...plan, bedtimeWindDown: e.target.value })}
          />
        </Field>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-star-200">Daily app budgets</span>
          {plan.budgets.map((b, i) => (
            <Stepper
              key={b.category}
              label={b.category}
              value={b.minutes}
              min={0}
              max={480}
              step={15}
              format={fmtMinutes}
              onChange={(v) =>
                setPlan({
                  ...plan,
                  budgets: plan.budgets.map((x, j) => (j === i ? { ...x, minutes: v } : x)),
                })
              }
            />
          ))}
        </div>
        <div className="space-y-2">
          <span className="block text-sm font-medium text-star-200">Homework focus block</span>
          <div className="grid grid-cols-3 gap-2">
            <input
              className={inputClass}
              value={plan.focusBlocks[0]?.days ?? ""}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  focusBlocks: [{ ...plan.focusBlocks[0], days: e.target.value }],
                })
              }
              aria-label="Focus days"
              placeholder="Mon–Thu"
            />
            <input
              type="time"
              className={inputClass}
              value={plan.focusBlocks[0]?.start ?? ""}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  focusBlocks: [{ ...plan.focusBlocks[0], start: e.target.value }],
                })
              }
              aria-label="Focus start"
            />
            <input
              type="time"
              className={inputClass}
              value={plan.focusBlocks[0]?.end ?? ""}
              onChange={(e) =>
                setPlan({
                  ...plan,
                  focusBlocks: [{ ...plan.focusBlocks[0], end: e.target.value }],
                })
              }
              aria-label="Focus end"
            />
          </div>
        </div>
      </div>
      {note ? <p className="mt-4 text-sm leading-relaxed text-stardust-300">{note}</p> : null}
      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={() => void submit()} />
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        <PrimaryButton onClick={() => void submit()} disabled={busy}>
          {busy ? "Sending…" : submitLabel}
        </PrimaryButton>
        {onCancel ? <QuietButton onClick={onCancel}>Cancel</QuietButton> : null}
      </div>
    </div>
  );
}

function ReviewActions({
  teenName,
  parentName,
  childProfileId,
  plan,
  actions,
  onCounter,
  onDone,
}: {
  teenName: string;
  parentName: string;
  childProfileId: string;
  plan: ScreenTimePlan;
  actions: SafetyActions;
  onCounter: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  async function decide(decision: "approve" | "decline") {
    if (busy) return;
    if (decision === "decline" && reason.trim().length === 0) {
      setError("Write a reason so they know why. They can see it.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await actions.reviewScreenTime(
        childProfileId,
        decision,
        plan,
        decision === "decline" ? reason.trim() : null
      );
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("review_failed"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5">
      <h2 className="text-base font-semibold text-star-100">
        {parentName}, your call
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-stardust-300">
        If you change anything, {teenName} sees your version and can respond. Nothing applies until
        you both agree.
      </p>
      {declining ? (
        <div className="mt-4 space-y-3">
          <Field label="Why not? (they can see this)">
            <textarea
              className={inputClass}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              placeholder="Say plainly what would work instead"
            />
          </Field>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDeclining(false)}
              className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-medium text-stardust-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => void decide("decline")}
              disabled={busy}
              className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-semibold text-star-100 disabled:opacity-50"
            >
              {busy ? "Sending…" : "Decline with reason"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => void decide("approve")}
            disabled={busy}
            className="min-h-[48px] rounded-2xl border border-comet-400/40 bg-comet-400/10 px-4 py-3 text-sm font-semibold text-comet-300 disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={onCounter}
            className="min-h-[48px] rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-semibold text-star-100"
          >
            Suggest changes
          </button>
          <button
            type="button"
            onClick={() => setDeclining(true)}
            className="min-h-[48px] rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-semibold text-star-100"
          >
            Decline with reason
          </button>
        </div>
      )}
      {error ? (
        <div className="mt-4">
          <FormError message={error} />
        </div>
      ) : null}
    </div>
  );
}

function AppealForm({
  childProfileId,
  actions,
  onDone,
  onCancel,
}: {
  childProfileId: string;
  actions: SafetyActions;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || reason.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.appealScreenTime(childProfileId, reason.trim().slice(0, 1000));
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("appeal_failed"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5">
      <h2 className="text-base font-semibold text-star-100">Ask for a Change</h2>
      <p className="mt-1 text-sm text-stardust-300">Say what you want different, and why.</p>
      <div className="mt-3">
        <Field label="Your reason">
          <textarea
            className={inputClass}
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 1000))}
            placeholder="I want more video time on weekends because…"
          />
        </Field>
      </div>
      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={() => void submit()} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        <PrimaryButton onClick={() => void submit()} disabled={busy || reason.trim().length === 0}>
          {busy ? "Sending…" : "Send my appeal"}
        </PrimaryButton>
        <QuietButton onClick={onCancel}>Cancel</QuietButton>
      </div>
    </div>
  );
}

function AppealHistory({
  childProfileId,
  viewerRole,
  teenName,
  parentName,
  actions,
  canRespond,
}: {
  childProfileId: string;
  viewerRole: "teen" | "parent";
  teenName: string;
  parentName: string;
  actions: SafetyActions;
  canRespond: boolean;
}) {
  const [appeals, setAppeals] = useState<ScreenTimeAppeal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [respondId, setRespondId] = useState<string | null>(null);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await actions.listScreenTimeAppeals(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setAppeals(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshAppeals() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function respond(appealId: string, decision: "approve" | "deny") {
    if (busy) return;
    if (response.trim().length === 0) {
      setError("Write a reason. They can see it.");
      return;
    }
    setBusy(true);
    try {
      const res = await actions.respondToAppeal(childProfileId, appealId, decision, response.trim());
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setRespondId(null);
      setResponse("");
      refreshAppeals();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("respond_failed"));
    }
    setBusy(false);
  }

  if (error) {
    return <FormError message={error} onRetry={refreshAppeals} />;
  }
  if (appeals === null) {
    return <LoadingState label="Loading appeal history…" />;
  }
  if (appeals.length === 0) return null;

  return (
    <section aria-label="Appeal history">
      <h2 className="text-base font-semibold text-star-100">Change Requests</h2>
      <ul className="mt-3 space-y-3">
        {appeals.map((ap) => (
          <li key={ap.id} className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4">
            <p className="text-sm text-stardust-300">
              {teenName} · {new Date(ap.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
            <p className="mt-1 text-[15px] leading-relaxed text-star-100">{ap.reason}</p>
            {ap.response ? (
              <div className="mt-2 border-t border-nova-400/15 pt-2">
                <p className="text-sm text-stardust-300">
                  {parentName} · {ap.respondedAt ? new Date(ap.respondedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-star-100">{ap.response}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm italic text-stardust-300">No response yet.</p>
            )}
            {canRespond && !ap.response ? (
              respondId === ap.id ? (
                <div className="mt-3 space-y-2">
                  <Field label="Your response (they can see this)">
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={response}
                      onChange={(e) => setResponse(e.target.value.slice(0, 1000))}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void respond(ap.id, "approve")}
                      disabled={busy}
                      className="min-h-[44px] flex-1 rounded-xl border border-comet-400/40 bg-comet-400/10 text-sm font-semibold text-comet-300 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void respond(ap.id, "deny")}
                      disabled={busy}
                      className="min-h-[44px] flex-1 rounded-xl border border-nova-400/25 text-sm font-semibold text-star-100 disabled:opacity-50"
                    >
                      Deny with reason
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setRespondId(ap.id)}
                  className="mt-3 min-h-[44px] rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100"
                >
                  Respond
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {viewerRole === "teen" ? (
        <p className="mt-2 text-xs leading-relaxed text-stardust-500">
          If there&apos;s no response, the plan keeps running as agreed.
        </p>
      ) : null}
    </section>
  );
}
