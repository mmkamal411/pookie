"use client";

import { useEffect, useState } from "react";
import {
  errorMessage,
  missingActions,
  type GrantAllowance,
  type GrantCandidate,
  type PendingGrantApproval,
  type SafetyActions,
} from "./types";
import {
  Field,
  FormError,
  FullPageFlow,
  LoadingState,
  PrimaryButton,
  QuietButton,
  inputClass,
} from "./ui";

/* D6 — tiered grant caps: 8/30d for trusted grantees, 2/30d for new
   grantees. Teen co-approval is required for NEW grantees only.
   Allowance copy stays subtle, never alarming; cap-hit copy is
   non-punitive. */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

/**
 * Parent-side grant flow: pick a contact (trusted grantees carry a
 * "frequent" badge), see the remaining allowance, and share access.
 * New grantees route through teen co-approval before the grant activates.
 */
export function GrantFlow({
  teenName,
  actions,
}: {
  teenName: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [allowance, setAllowance] = useState<GrantAllowance | null>(null);
  const [candidates, setCandidates] = useState<GrantCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<GrantCandidate | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [al, cands] = await Promise.all([a.getGrantAllowance(), a.listGrantCandidates()]);
        if (cancelled) return;
        if (!al.ok) {
          setError(errorMessage(al.error));
          return;
        }
        if (!cands.ok) {
          setError(errorMessage(cands.error));
          return;
        }
        setAllowance(al.data);
        setCandidates(cands.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  function refreshGrants() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function share() {
    const email = selected?.email ?? newEmail.trim();
    const name = selected?.name ?? newName.trim();
    if (!email || !name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await a.requestGrant(email, name, ["performance", "communications"]);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setPendingApproval(res.data.needsTeenApproval);
      setConfirming(false);
      setSelected(null);
      setNewName("");
      setNewEmail("");
      setAddingNew(false);
      refreshGrants();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("grant_failed"));
    }
    setBusy(false);
  }

  if (error && !allowance) {
    return (
      <FullPageFlow>
        <FormError message={error} onRetry={refreshGrants} />
      </FullPageFlow>
    );
  }
  if (!allowance || !candidates) {
    return (
      <FullPageFlow>
        <LoadingState label="Loading sharing options…" />
      </FullPageFlow>
    );
  }

  const trustedLeft = allowance.trusted.limit - allowance.trusted.used;
  const newLeft = allowance.newGrantee.limit - allowance.newGrantee.used;
  const effective: GrantCandidate | null = selected ?? (addingNew && newEmail.trim() && newName.trim()
    ? { id: null, name: newName.trim(), email: newEmail.trim(), kind: "new", lastGrantedAt: null, grantsInWindow: 0 }
    : null);
  const capHit = effective?.kind === "new" ? newLeft <= 0 : trustedLeft <= 0;

  return (
    <FullPageFlow>
      <p className="text-sm font-medium text-nova-300">Sharing</p>
      <h1 className="mt-2 text-2xl font-semibold text-star-100">Share access</h1>
      <p className="mt-2 text-sm leading-relaxed text-stardust-300">
        {teenName} decides who gets in. New contacts need {teenName}&apos;s approval first.
      </p>

      <div className="mt-4 rounded-2xl border border-nova-400/15 bg-nebula-800/60 px-4 py-3 text-sm text-stardust-300">
        {trustedLeft} of {allowance.trusted.limit} grants left this month for trusted contacts
        <span className="mx-2 text-stardust-500">·</span>
        {newLeft} of {allowance.newGrantee.limit} left for new contacts
      </div>

      {pendingApproval ? (
        <div className="mt-4 rounded-2xl border border-aurum-400/30 bg-aurum-400/5 p-4 text-sm leading-relaxed text-stardust-200">
          Sent to {teenName} for approval. Access starts when {teenName} approves.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={refreshGrants} />
        </div>
      ) : null}

      {confirming && effective ? (
        <div className="mt-5 rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5">
          <h2 className="text-base font-semibold text-star-100">
            Share with {effective.name}?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stardust-300">
            {effective.kind === "new" ? (
              <>
                {teenName} gets an approval card. Access starts when {teenName} approves. You can
                share with {newLeft} more new {newLeft === 1 ? "contact" : "contacts"} this month.
              </>
            ) : (
              <>They had access before, so this goes through right away.</>
            )}
          </p>
          <div className="mt-4 space-y-3">
            <PrimaryButton onClick={() => void share()} disabled={busy}>
              {busy ? "Sharing…" : effective.kind === "new" ? "Ask for approval" : "Share access"}
            </PrimaryButton>
            <QuietButton onClick={() => setConfirming(false)}>Go back</QuietButton>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <p className="mb-2 text-sm font-medium text-star-200">Pick someone</p>
          <ul className="space-y-2">
            {candidates.map((c, i) => {
              const active = selected?.email === c.email && selected?.name === c.name;
              return (
                <li key={`${c.email ?? c.name}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(active ? null : c);
                      setAddingNew(false);
                    }}
                    aria-pressed={active}
                    className={`flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left ${
                      active
                        ? "border-nova-400/60 bg-nova-400/10"
                        : "border-nova-400/15 bg-nebula-800/60"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold text-star-100">
                        {c.name}
                      </span>
                      {c.email ? (
                        <span className="block truncate text-xs text-stardust-300">{c.email}</span>
                      ) : null}
                    </span>
                    {c.kind === "trusted" ? (
                      <span className="shrink-0 rounded-full border border-comet-400/40 bg-comet-400/10 px-2.5 py-1 text-xs font-medium text-comet-300">
                        frequent
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full border border-nova-400/25 px-2.5 py-1 text-xs text-stardust-300">
                        new
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          {addingNew ? (
            <div className="mt-3 space-y-3 rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-4">
              <Field label="Their name">
                <input
                  className={inputClass}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={80}
                  autoComplete="off"
                />
              </Field>
              <Field label="Their email">
                <input
                  className={inputClass}
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="off"
                />
              </Field>
              <button
                type="button"
                onClick={() => {
                  setAddingNew(false);
                  setNewName("");
                  setNewEmail("");
                }}
                className="min-h-[44px] text-sm text-stardust-300 hover:text-star-100"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddingNew(true);
                setSelected(null);
              }}
              className="mt-3 min-h-[48px] w-full rounded-2xl border border-dashed border-nova-400/30 px-4 py-3 text-sm font-medium text-stardust-300 hover:text-star-100"
            >
              + Someone new
            </button>
          )}

          {capHit && effective ? (
            <div className="mt-4 rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-4 text-sm leading-relaxed text-stardust-200">
              You&apos;ve shared access {effective.kind === "new" ? allowance.newGrantee.used : allowance.trusted.used} times
              this month with {effective.kind === "new" ? "new contacts" : "trusted contacts"}. You
              can share again on {fmtDate(allowance.resetsOn)}.
            </div>
          ) : (
            <div className="mt-4">
              <PrimaryButton onClick={() => setConfirming(true)} disabled={!effective}>
                Continue
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </FullPageFlow>
  );
}

/**
 * Teen-side co-approval card for new-grantee grants (D6). The grant stays
 * inactive until the teen approves. Denials take an optional reason.
 */
export function TeenGrantApprovalCard({
  childProfileId,
  teenName,
  actions,
}: {
  childProfileId: string;
  teenName: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [approvals, setApprovals] = useState<PendingGrantApproval[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [denyId, setDenyId] = useState<string | null>(null);
  const [denyReason, setDenyReason] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.listPendingGrantApprovals(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setApprovals(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshApprovals() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function decide(grantId: string, approved: boolean) {
    if (busyId) return;
    setBusyId(grantId);
    setError(null);
    try {
      const res = await a.decideGrantApproval(
        grantId,
        approved,
        approved ? null : denyReason.trim() || null
      );
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusyId(null);
        return;
      }
      setDenyId(null);
      setDenyReason("");
      refreshApprovals();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("decide_failed"));
    }
    setBusyId(null);
  }

  if (error) {
    return <FormError message={error} onRetry={refreshApprovals} />;
  }
  if (approvals === null) {
    return <LoadingState label="Checking approval requests…" />;
  }
  if (approvals.length === 0) return null;

  return (
    <section aria-label="Access approval requests" className="space-y-3">
      {approvals.map((ap) => (
        <div
          key={ap.grantId}
          className="rounded-2xl border border-aurum-400/30 bg-nebula-900/80 p-5"
        >
          <p className="text-sm font-medium text-nova-300">Approval needed</p>
          <h2 className="mt-1 text-lg font-semibold text-star-100">
            {teenName}, share your Pookie with {ap.granteeName}?
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stardust-300">
            {ap.requestedBy} asked to share {ap.scopes.join(", ")} access
            {ap.granteeEmail ? ` with ${ap.granteeEmail}` : ""}. Nothing is shared until you say
            yes. Saying no is always okay.
          </p>
          {denyId === ap.grantId ? (
            <div className="mt-3 space-y-3">
              <Field label="Why not? (optional, they can see this)">
                <input
                  className={inputClass}
                  value={denyReason}
                  onChange={(e) => setDenyReason(e.target.value.slice(0, 500))}
                  placeholder="Not right now"
                  autoComplete="off"
                />
              </Field>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDenyId(null)}
                  className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-medium text-stardust-300"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void decide(ap.grantId, false)}
                  disabled={busyId === ap.grantId}
                  className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-semibold text-star-100 disabled:opacity-50"
                >
                  {busyId === ap.grantId ? "Working…" : "Decline"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => void decide(ap.grantId, true)}
                disabled={busyId === ap.grantId}
                className="btn-dapple min-h-[48px] flex-1 rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyId === ap.grantId ? "Working…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => setDenyId(ap.grantId)}
                disabled={busyId === ap.grantId}
                className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-semibold text-star-100 disabled:opacity-50"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
