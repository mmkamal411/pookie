"use client";

/**
 * Squad Cradle — verifiable parental consent for under-13 child login.
 *
 * COPPA: an under-13 child gets a Pookie login ONLY when a parent records
 * explicit, verifiable consent. The default is closed — this panel is the
 * auditable key that opens it. Rendered on the Sharing screen for
 * under-13 children, parent role only.
 *
 * Squad Gavel 2026-10-12 — added verification-method selector (signed form
 * upload / card verification / video call scheduling — UI + copy only,
 * backend stubs show "coming soon, contact us") and the direct notice text
 * (what data is collected, how it's used, who sees it — in the notice
 * itself, per COPPA's direct-notice requirement).
 *
 * NOTE: production verifiable parental consent (VPC) needs compliance
 * review before launch. The current `in_app_parent_attestation` method is a
 * TEST method — do not ship it as the production VPC pattern.
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

type VerifyMethod = "attestation" | "signed_form" | "card" | "video_call";

const VERIFY_METHODS: { id: VerifyMethod; label: string; hint: string }[] = [
  {
    id: "attestation",
    label: "In-App Confirmation",
    hint: "Confirm right here, right now. Fastest option.",
  },
  {
    id: "signed_form",
    label: "Signed Consent Form",
    hint: "Upload a signed parental consent form.",
  },
  {
    id: "card",
    label: "Card Verification",
    hint: "Verify with a credit or debit card (no charge).",
  },
  {
    id: "video_call",
    label: "Video Call",
    hint: "Schedule a brief video call with our team.",
  },
];

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
  const [method, setMethod] = useState<VerifyMethod>("attestation");

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
    // NOTE: signed_form / card / video_call are UI + copy only in this build.
    // Their backends are stubs — production VPC needs compliance review.
    if (method !== "attestation") {
      setError(
        "This verification method is coming soon. Please choose In-App Confirmation, or contact us at privacy@pookie.app.",
      );
      return;
    }
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
            Direct Notice — Please Read Before Consenting
          </p>
          <div className="mt-2 space-y-2 text-xs leading-relaxed text-stardust-300">
            <p>
              <strong className="text-star-100">What we collect from {childName}:</strong>{" "}
              name, birthdate, login email, and — only if you connect them —
              school data (classes, grades, assignments, attendance) plus any
              check-ins or tasks your family tracks.
            </p>
            <p>
              <strong className="text-star-100">How it is used:</strong> solely
              to provide Pookie&apos;s family features to your household. We do
              not sell children&apos;s data, serve them ads, or share it for
              marketing.
            </p>
            <p>
              <strong className="text-star-100">Who can see it:</strong> you,
              anyone you explicitly grant access to (such as mentors), and our
              systems that store and sync it. No one else.
            </p>
            <p>
              You can review, delete, or stop collection of {childName}&apos;s
              information at any time — see{" "}
              <a href="/privacy/children" className="underline underline-offset-2">
                Children&apos;s Privacy
              </a>
              .
            </p>
          </div>

          <p className="mt-4 text-sm font-medium text-star-100">
            Choose A Verification Method
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {VERIFY_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                aria-pressed={method === m.id}
                className={`rounded-xl border p-3 text-left transition ${
                  method === m.id
                    ? "border-teal-400/60 bg-teal-400/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/25"
                }`}
              >
                <span className="block text-sm font-medium text-star-100">
                  {m.label}
                </span>
                <span className="mt-0.5 block text-xs text-stardust-400">
                  {m.hint}
                </span>
              </button>
            ))}
          </div>

          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-stardust-300">
            <li>{childName} will sign in with their own email and password.</li>
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
