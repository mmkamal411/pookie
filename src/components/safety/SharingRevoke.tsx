"use client";

import { useState } from "react";
import {
  missingActions,
  type PendingRevoke,
  type RevokePerson,
  type RevokeScope,
  type SafetyActions,
} from "./types";
import { CoolingOffFlow, PendingRevokeView } from "./CoolingOffFlow";

const SCOPE_LABELS: Record<string, string> = {
  performance: "Grades",
  communications: "Messages",
  reflection: "Check-ins",
  wellness: "Wellness",
};

/**
 * Per-person "Remove access" row on the teen's Sharing screen.
 * Wires into CoolingOffFlow (Steps 1–6-safe). Shows the pending state
 * ("Removing in [N] days · Cancel anytime.") while a revoke is pending.
 * Teen-visible only; the parent's view is unchanged during pending.
 */
export function SharingRevoke({
  person,
  allGranteeIds,
  childProfileId,
  teenFirstName,
  teenAge,
  pendingRevoke,
  actions,
  onChanged,
}: {
  person: RevokePerson;
  allGranteeIds: string[];
  childProfileId: string;
  teenFirstName: string;
  teenAge: number;
  pendingRevoke: PendingRevoke | null;
  actions?: SafetyActions;
  onChanged: () => void;
}) {
  const a = actions ?? missingActions;
  const [flowOpen, setFlowOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-star-100">{person.firstName}</p>
          <p className="mt-0.5 text-xs text-stardust-300">{person.relationshipToTeen}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.scopes.map((s) => (
              <span
                key={s}
                className="rounded-full border border-nova-400/25 px-2.5 py-1 text-xs text-stardust-200"
              >
                {SCOPE_LABELS[s] ?? s}
              </span>
            ))}
          </div>
        </div>
        {!pendingRevoke ? (
          <button
            type="button"
            onClick={() => setFlowOpen(true)}
            className="min-h-[48px] shrink-0 rounded-2xl border border-red-400/50 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-950/40"
          >
            Remove access
          </button>
        ) : null}
      </div>

      {pendingRevoke ? (
        <div className="mt-3 border-t border-nova-400/15 pt-3">
          <PendingStatusLine
            pendingRevoke={pendingRevoke}
            teenFirstName={teenFirstName}
            firstName={person.firstName}
            scopes={person.scopes}
            teenAge={teenAge}
            actions={a}
            onCancelled={onChanged}
            onDone={onChanged}
          />
        </div>
      ) : null}

      {flowOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Remove ${person.firstName}'s access`}
          className="fixed inset-0 z-[100] overflow-y-auto bg-nebula-950/90 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFlowOpen(false);
          }}
        >
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setFlowOpen(false)}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-nova-400/25 text-stardust-300 hover:text-star-100"
              >
                ✕
              </button>
            </div>
            <CoolingOffFlow
              person={person}
              allGranteeIds={allGranteeIds}
              childProfileId={childProfileId}
              teenFirstName={teenFirstName}
              teenAge={teenAge}
              actions={a}
              onClose={() => setFlowOpen(false)}
              onCompleted={() => {
                setFlowOpen(false);
                onChanged();
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PendingStatusLine({
  pendingRevoke,
  teenFirstName,
  firstName,
  scopes,
  teenAge,
  actions,
  onCancelled,
  onDone,
}: {
  pendingRevoke: PendingRevoke;
  teenFirstName: string;
  firstName: string;
  scopes: RevokeScope[];
  teenAge: number;
  actions: SafetyActions;
  onCancelled: () => void;
  onDone: () => void;
}) {
  // Snapshot "now" once per mount (lazy initializer keeps render pure).
  const [now] = useState(() => Date.now());
  const daysLeft = Math.max(
    0,
    Math.ceil((new Date(pendingRevoke.effectAt).getTime() - now) / (24 * 3600 * 1000))
  );
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-stardust-200">
          Removing in {daysLeft} {daysLeft === 1 ? "day" : "days"} ·{" "}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-semibold text-nova-300 underline underline-offset-2"
          >
            Cancel anytime
          </button>
        </p>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="min-h-[44px] rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300"
          aria-label="Show pending removal details"
        >
          Details
        </button>
      </div>
    );
  }

  return (
    <PendingRevokeView
      firstName={firstName}
      scopes={scopes}
      effectAt={pendingRevoke.effectAt}
      notifyMode={pendingRevoke.notifyMode}
      instant={teenAge >= 16 && teenAge <= 17}
      teenFirstName={teenFirstName}
      actions={actions}
      pendingId={pendingRevoke.id}
      onCancelled={onCancelled}
      onDone={onDone}
    />
  );
}
