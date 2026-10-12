"use client";

import { useState } from "react";
import { SettingsCard, DangerButton } from "@/components/settings/settings-ui";
import { TypeToConfirmModal } from "./type-to-confirm-modal";
import { requestChildDeletion } from "@/lib/account/actions";
import { deletionErrorMessage } from "@/lib/account/error-messages";
import { CHILD_DELETION_GRACE_DAYS } from "@/lib/account/constants";
import type { FamilyMember } from "@/lib/family/types";

/**
 * Remove-child section (Settings → Family).
 *
 * Flow: "Remove [name]" → modal with plain-language consequences →
 * type the child's first name → soft-delete with 30-day grace (or, when
 * the child has their own login, remove only the caller's access).
 *
 * POLICY (founder default, flagged for confirmation): if the child has
 * independent logins, "remove" does NOT delete the child — it removes the
 * caller's access grant. The teen's data stays under their control, per
 * the age-tier access-authority rules.
 *
 * SAFETY: requestChildDeletion(childId) passes a selector; the RPC
 * verifies ownership via auth.uid() and raises not_child_owner otherwise.
 */
export function RemoveChildSection({
  members,
  onChanged,
}: {
  members: FamilyMember[];
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<FamilyMember | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [estimatedPurgeDate] = useState(() =>
    formatDate(
      new Date(
        Date.now() + CHILD_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
      ).toISOString()
    )
  );

  async function handleConfirm() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const result = await requestChildDeletion(target.childId);
      if (!result.ok) {
        setError(deletionErrorMessage(result.error));
        setBusy(false);
        return;
      }
      setTarget(null);
      setBusy(false);
      if (result.mode === "access_removed") {
        setNotice(
          `Your access to ${result.childFirstName} was removed. Their data stays with them.`
        );
      } else {
        setNotice(
          `Done. ${result.childFirstName}'s data will be permanently erased on ${formatDate(result.permanentDeleteAfter)}.`
        );
      }
      onChanged();
    } catch {
      setError(deletionErrorMessage("deletion_failed"));
      setBusy(false);
    }
  }

  if (members.length === 0) return null;

  return (
    <>
      <SettingsCard
        title="Remove a child"
        description="Take a child off your account. They get a 30-day grace period."
      >
        <ul className="space-y-2.5">
          {members.map((m) => {
            const name = m.nickname ?? m.firstName;
            const hasLogin = m.logins.length > 0;
            return (
              <li
                key={m.childId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {name}
                  </p>
                  <p className="text-xs text-white/50">
                    {hasLogin
                      ? "Has their own login — removing takes away your access only"
                      : "No login yet — removing schedules their data for deletion"}
                  </p>
                </div>
                <DangerButton
                  onClick={() => {
                    setTarget(m);
                    setError(null);
                    setNotice(null);
                  }}
                >
                  Remove…
                </DangerButton>
              </li>
            );
          })}
        </ul>
        {notice && (
          <p role="status" className="mt-3 text-sm text-emerald-300">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-400">
            {error}
          </p>
        )}
      </SettingsCard>

      {target && (
        <TypeToConfirmModal
          title={`Remove ${target.nickname ?? target.firstName}?`}
          body={
            target.logins.length > 0 ? (
              <p>
                {target.nickname ?? target.firstName} has{" "}
                {target.logins.length === 1 ? "their own login" : "their own logins"},
                so their data stays with them. Removing takes away{" "}
                <strong className="text-white">your access only</strong> —
                you won&apos;t see their information anymore, but nothing is
                deleted.
              </p>
            ) : (
              <>
                <p>
                  This will permanently erase everything for{" "}
                  <strong className="text-white">
                    {target.nickname ?? target.firstName}
                  </strong>{" "}
                  — their profile, history, and all connected data.
                </p>
                <p className="mt-2">
                  You&apos;ll have{" "}
                  <strong className="text-white">
                    {CHILD_DELETION_GRACE_DAYS} days
                  </strong>{" "}
                  to change your mind. After{" "}
                  <strong className="text-white">{estimatedPurgeDate}</strong>
                  , it&apos;s gone forever and cannot be recovered.
                </p>
              </>
            )
          }
          confirmPhrase={target.firstName}
          confirmLabel={`Remove ${target.nickname ?? target.firstName}`}
          busy={busy}
          onClose={() => {
            if (!busy) {
              setTarget(null);
              setError(null);
            }
          }}
          onConfirm={handleConfirm}
        />
      )}
    </>
  );
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "the purge date";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
