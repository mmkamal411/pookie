"use client";

/**
 * Squad Cradle — verifiable parental consent for under-13 child login.
 *
 * COPPA: an under-13 child gets a Pookie login ONLY when a parent records
 * explicit, verifiable consent. The default is closed — this panel is the
 * auditable key that opens it. Rendered on the Sharing screen for
 * under-13 children, parent role only.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/components/home-money/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok)
    throw new ApiError(
      json.error?.code ?? "INTERNAL",
      json.error?.message ?? "Hold position — request incomplete.",
    );
  return json.data as T;
}

interface Consent {
  id: string;
  method: string;
  detail: Record<string, unknown>;
  granted_at: string;
  revoked_at: string | null;
}

export function ParentalConsentPanel({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const [consent, setConsent] = useState<Consent | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { consent: c } = await api<{ consent: Consent | null }>(
        `/api/v1/children/${childId}/consent`,
      );
      setConsent(c);
    } catch {
      setConsent(null);
    }
  }, [childId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const grant = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/children/${childId}/consent`, {
        method: "POST",
        body: JSON.stringify({
          method: "in_app_parent_attestation",
          detail: {
            attested_at: new Date().toISOString(),
            note: "Parent recorded consent in the Pookie app.",
          },
        }),
      });
      setConfirming(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record consent.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (
      !confirm(
        `Revoke login consent for ${childName}? They will keep their current access, but no new login can be issued until you consent again.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/v1/children/${childId}/consent`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not revoke consent.");
    } finally {
      setBusy(false);
    }
  };

  const active = consent && !consent.revoked_at;

  return (
    <section className="card-living rounded-3xl p-6">
      <h2 className="text-xl font-semibold text-star-100">Login Consent</h2>
      <p className="mt-1 text-sm text-stardust-300">
        {childName} is under 13. Federal law (COPPA) requires your verifiable
        consent before they get a Pookie login. No consent, no login — that is
        the default.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {consent === undefined && (
        <p className="mt-3 text-sm text-stardust-400">Checking consent…</p>
      )}

      {consent !== undefined && !active && !confirming && (
        <div className="mt-4">
          <p className="text-sm text-stardust-300">
            No active consent. {childName} cannot receive a login invite.
          </p>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn-dapple mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950"
          >
            Give Login Consent
          </button>
        </div>
      )}

      {confirming && !active && (
        <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-star-100">
            You are consenting to {childName} having their own Pookie login.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-stardust-300">
            <li>They will sign in with their own email and password.</li>
            <li>You stay in full control — you can revoke this anytime.</li>
            <li>This consent is logged with a timestamp for compliance.</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={grant}
              disabled={busy}
              className="btn-dapple rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy ? "Recording…" : "I Consent — Give Login Access"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-xl border border-stardust-500/30 px-4 py-2 text-sm text-stardust-300"
            >
              Not Now
            </button>
          </div>
        </div>
      )}

      {active && (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <p className="text-sm font-medium text-emerald-200">
            Consent active — {childName} can receive a login invite.
          </p>
          <p className="mt-1 text-xs text-stardust-400">
            Granted {new Date(consent.granted_at).toLocaleDateString()} · logged
            for compliance.
          </p>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="mt-3 text-xs text-stardust-400 underline-offset-4 hover:text-red-300 hover:underline disabled:opacity-50"
          >
            {busy ? "Revoking…" : "Revoke login consent"}
          </button>
        </div>
      )}
    </section>
  );
}
