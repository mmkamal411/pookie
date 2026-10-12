"use client";

import { useState } from "react";
import { SettingsCard, DangerButton } from "@/components/settings/settings-ui";
import { TypeToConfirmModal } from "./type-to-confirm-modal";
import {
  requestAccountDeletion,
} from "@/lib/account/actions";
import { deletionErrorMessage } from "@/lib/account/error-messages";
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETE_CONFIRM_PHRASE,
} from "@/lib/account/constants";

/**
 * Danger zone — self-service account deletion (Settings → Profile).
 *
 * Flow: "Delete my account" → modal with plain-language consequences →
 * type DELETE → soft-delete with 30-day grace → signed out → /login
 * shows the fresh-start confirmation with the purge date.
 *
 * SAFETY: requestAccountDeletion() takes no user ID — the RPC deletes
 * auth.uid() from the session and nothing else.
 */
export function DangerZone({ childCount }: { childCount: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await requestAccountDeletion();
      // On success the action signs out and redirects — we never get here.
      if (!result.ok) {
        setError(deletionErrorMessage(result.error));
        setBusy(false);
      }
    } catch {
      setError(deletionErrorMessage("deletion_failed"));
      setBusy(false);
    }
  }

  const [purgeDate] = useState(() =>
    new Date(
      Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000
    ).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  );

  return (
    <>
      <SettingsCard
        title="Danger zone"
        description="Irreversible actions. Take a breath before touching these."
      >
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
          <p className="text-sm font-semibold text-red-200">
            Delete my account and start over
          </p>
          <p className="mt-1 text-sm leading-relaxed text-stardust-300">
            Permanently erase your profile
            {childCount > 0
              ? `, all ${childCount} ${childCount === 1 ? "child" : "children"}, and everything connected to them`
              : ""}
            . Use this if your account is stuck and you want a clean slate.
          </p>
          <div className="mt-3">
            <DangerButton onClick={() => setModalOpen(true)}>
              Delete my account…
            </DangerButton>
          </div>
        </div>
      </SettingsCard>

      {modalOpen && (
        <TypeToConfirmModal
          title="Delete your account?"
          body={
            <>
              <p>
                This will permanently erase everything — your profile
                {childCount > 0
                  ? `, ${childCount === 1 ? "your child's" : "your children's"} data, and all history`
                  : ""}
                .
              </p>
              <p className="mt-2">
                You&apos;ll have{" "}
                <strong className="text-white">
                  {ACCOUNT_DELETION_GRACE_DAYS} days
                </strong>{" "}
                to change your mind. After{" "}
                <strong className="text-white">{purgeDate}</strong>, it&apos;s
                gone forever and cannot be recovered.
              </p>
              <p className="mt-2">
                You&apos;ll be signed out immediately. If you sign back in
                within {ACCOUNT_DELETION_GRACE_DAYS} days, you can cancel the
                deletion and restore everything.
              </p>
            </>
          }
          confirmPhrase={ACCOUNT_DELETE_CONFIRM_PHRASE}
          confirmLabel="Delete my account"
          busy={busy}
          onClose={() => {
            if (!busy) {
              setModalOpen(false);
              setError(null);
            }
          }}
          onConfirm={handleConfirm}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-400">
          {error}
        </p>
      )}
    </>
  );
}
