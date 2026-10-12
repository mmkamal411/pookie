"use client";

// 18th-birthday health review (sol-health section 2.2). Blocking interstitial:
// per-tier grant cards (defaults OFF), review-correct-seal queue,
// transition-summary export, emergency-contact re-designation (decoupled),
// confirm. Skip = private, recorded as an affirmative choice.
//
// Login-time enforcement (showing this on first login >= 18) belongs to the
// platform login flow (Platform Team 2 dependency); this is the screen itself.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  getHealthGrants,
  getHealthHub,
  submitReconsent,
  skipReconsent,
  getReviewQueue,
  correctHealthRecord,
  deleteHealthRecord,
  exportTransitionSummary,
  saveEmergencyContacts,
} from "@/lib/health/actions";
import type {
  HealthContext,
  ReconsentStatus,
  ReviewQueueRow,
} from "@/lib/health/types";
import { TIER_DESCRIPTIONS, COPY } from "@/lib/health/types";
import {
  HealthPageHeader,
  MedicalDisclaimerFooter,
  HealthToggle,
  TierBadge,
  BackendNotReady,
  ActionError,
} from "./ui";

interface ParentToggle {
  userId: string;
  label: string;
  h1: boolean;
  h2: boolean;
}

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1.5 w-8 rounded-full ${i + 1 <= step ? "bg-nova-400" : "bg-nebula-700"}`}
        />
      ))}
    </div>
  );
}

export function Review18View({
  childId,
  ctx,
  initialStatus,
  childSlug,
}: {
  childId: string;
  ctx: HealthContext;
  initialStatus: ReconsentStatus;
  childSlug: string;
}) {
  const [status, setStatus] = useState<ReconsentStatus>(initialStatus);
  const [step, setStep] = useState(1);
  const [parents, setParents] = useState<ParentToggle[]>([]);
  const [counts, setCounts] = useState<{ H1: number; H2: number }>({ H1: 0, H2: 0 });
  const [queue, setQueue] = useState<ReviewQueueRow[]>([]);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [correcting, setCorrecting] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [contacts, setContacts] = useState([{ name: "", relationship: "", phone: "" }]);
  const [contactsMsg, setContactsMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "json" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [g, hub, q] = await Promise.all([
      getHealthGrants(childId),
      getHealthHub(childId),
      getReviewQueue(childId),
    ]);
    setLoading(false);
    if (g.ok) {
      setParents(
        g.data.map((p) => ({ userId: p.granteeUserId, label: p.granteeLabel, h1: false, h2: false })),
      );
    } else if (g.code !== "backend_not_ready") {
      setError(g.message);
    }
    if (hub.ok) {
      const h1 = hub.data.sections.find((s) => s.tier === "H1");
      const h2 = hub.data.sections.find((s) => s.tier === "H2");
      setCounts({ H1: h1?.readingCount ?? 0, H2: h2?.readingCount ?? 0 });
    }
    if (q.ok) setQueue(q.data.rows);
  }, [childId]);

  useEffect(() => {
    if (status === "pending") load();
  }, [status, load]);

  function setToggle(userId: string, tier: "h1" | "h2", next: boolean) {
    setParents((prev) => prev.map((p) => (p.userId === userId ? { ...p, [tier]: next } : p)));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    const grants = parents.flatMap((p) =>
      (["h1", "h2"] as const)
        .filter((t) => p[t])
        .map((t) => ({ granteeUserId: p.userId, tier: (t === "h1" ? "H1" : "H2") as "H1" | "H2" })),
    );
    const res = await submitReconsent(childId, { grants });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setStatus("complete");
  }

  async function skip() {
    setSubmitting(true);
    setError(null);
    const res = await skipReconsent(childId);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setStatus("skipped_private");
  }

  async function doCorrect(row: ReviewQueueRow) {
    const res = await correctHealthRecord(childId, {
      recordId: row.recordId,
      table: row.table,
      patch: { corrected_summary: correctionText.trim() },
    });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setReviewed((prev) => new Set(prev).add(row.recordId));
    setCorrecting(null);
    setCorrectionText("");
  }

  async function doDelete(row: ReviewQueueRow) {
    const res = await deleteHealthRecord(childId, { recordId: row.recordId, table: row.table });
    if (!res.ok) {
      setError(res.message);
      return;
    }
    setReviewed((prev) => new Set(prev).add(row.recordId));
  }

  async function doExport(format: "pdf" | "json") {
    setExporting(format);
    setError(null);
    const res = await exportTransitionSummary(childId, { format });
    setExporting(null);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    const bytes = Uint8Array.from(atob(res.data.contentBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: res.data.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function saveContacts() {
    setContactsMsg(null);
    setError(null);
    const filled = contacts.filter((c) => c.name.trim() && c.phone.trim());
    const res = await saveEmergencyContacts(childId, filled);
    setContactsMsg(res.ok ? "Saved." : res.message);
  }

  function addContact() {
    if (contacts.length < 5) setContacts((prev) => [...prev, { name: "", relationship: "", phone: "" }]);
  }

  // Terminal states ---------------------------------------------------------
  if (status === "complete" || status === "skipped_private") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 pb-8 text-center">
        <h1 className="text-sunlit animate-bloom text-3xl font-semibold">Your choices are saved.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stardust-300">
          {status === "complete"
            ? "Your health sharing is exactly as you set it. Change it anytime in Settings, Sharing, Health."
            : "Everything stays private. You can turn sharing on anytime in Settings, Sharing, Health."}
        </p>
        <Link
          href={`/c/${childSlug}/settings/sharing`}
          className="mt-6 inline-block rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
        >
          Open Sharing settings
        </Link>
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  if (status === "not_due" || status === "unknown") {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-16 pb-8 text-center">
        <h1 className="text-sunlit animate-bloom text-3xl font-semibold">Not yet 18.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stardust-300">
          This review appears on your 18th birthday. On that day your health information becomes
          private to you, and you choose what to share from here.
        </p>
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  if (!ctx.schemaReady && !loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
        <BackendNotReady feature="18th birthday review" />
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  const totalSteps = 5;
  const pendingQueue = queue.filter((r) => !reviewed.has(r.recordId));

  return (
    <div className="mx-auto max-w-2xl px-4 pt-10 pb-8">
      <HealthPageHeader eyebrow="A fresh start" title={COPY.review18Header} sub={COPY.review18Sub} />
      <div className="animate-bloom mt-4" style={{ animationDelay: "0.08s" }}>
        <StepDots step={step} total={totalSteps} />
      </div>

      <div className="animate-bloom mt-6" style={{ animationDelay: "0.14s" }}>
        {error && (
          <div className="mb-4">
            <ActionError message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {step === 1 && (
          <section className="space-y-4">
            <p className="text-sm text-stardust-300">
              Three separate choices. All start off. There is no single health switch.
            </p>
            {parents.length === 0 && !loading && (
              <p className="text-sm text-stardust-500">No linked parents found.</p>
            )}
            {parents.map((p) => (
              <div key={p.userId} className="card-living rounded-3xl p-5">
                <h2 className="text-base font-semibold text-star-100">{p.label}</h2>
                <div className="mt-2 divide-y divide-nova-400/10">
                  <HealthToggle
                    checked={p.h1}
                    onChange={(n) => setToggle(p.userId, "h1", n)}
                    label="Everyday wellness"
                    description={`Steps, sleep, heart rate from devices. ${counts.H1} recent readings. ${TIER_DESCRIPTIONS.H1}`}
                  />
                  <HealthToggle
                    checked={p.h2}
                    onChange={(n) => setToggle(p.userId, "h2", n)}
                    label="Private health"
                    description={`Weight, medications, allergies, doctor notes, food diary. ${counts.H2} recent readings. Off unless you choose it.`}
                  />
                </div>
                <div className="mt-3 rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3">
                  <TierBadge tier="H3" />
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    {TIER_DESCRIPTIONS.H3}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-star-100">Review what others entered</h2>
              <p className="mt-1 text-sm text-stardust-300">
                These rows were entered by someone else. Keep them, fix them, or delete them. Your
                call on each one.
              </p>
            </div>
            {pendingQueue.length === 0 && (
              <p className="text-sm text-stardust-500">
                Nothing to review. Either nobody else entered health data, or you already went
                through it.
              </p>
            )}
            {pendingQueue.map((r) => (
              <div key={r.recordId} className="card-living rounded-3xl p-5">
                <p className="text-xs font-medium tracking-wide text-nova-400 uppercase">{r.category}</p>
                <p className="mt-1 text-sm text-star-100">{r.summary}</p>
                <p className="mt-1 text-xs text-stardust-500">
                  Entered by {r.enteredByLabel}
                  {r.enteredAt && `, ${new Date(r.enteredAt).toLocaleDateString()}`}
                </p>
                {correcting === r.recordId ? (
                  <div className="mt-3">
                    <textarea
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Write the corrected version."
                      className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => doCorrect(r)}
                        disabled={!correctionText.trim()}
                        className="rounded-xl bg-nova-500 px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
                      >
                        Save correction
                      </button>
                      <button
                        type="button"
                        onClick={() => setCorrecting(null)}
                        className="rounded-xl border border-nova-400/30 px-4 py-2 text-sm text-stardust-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setReviewed((prev) => new Set(prev).add(r.recordId))}
                      className="rounded-xl border border-comet-400/40 px-4 py-2 text-sm font-medium text-comet-200 hover:bg-comet-400/10"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCorrecting(r.recordId);
                        setCorrectionText(r.summary);
                      }}
                      className="rounded-xl border border-nova-400/30 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100"
                    >
                      Correct
                    </button>
                    <button
                      type="button"
                      onClick={() => doDelete(r)}
                      className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-400/10"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm text-stardust-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-star-100">Take it to your new doctor</h2>
              <p className="mt-1 text-sm text-stardust-300">
                A one-page summary: conditions, medications, allergies, shots, recent trends,
                emergency contacts. Your most personal records stay out unless you check them in
                one by one.
              </p>
            </div>
            <div className="card-living rounded-3xl p-5">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => doExport("pdf")}
                  disabled={exporting != null}
                  className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm disabled:opacity-50"
                >
                  {exporting === "pdf" ? "Building." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => doExport("json")}
                  disabled={exporting != null}
                  className="rounded-xl border border-nova-400/30 px-5 py-2.5 text-sm font-medium text-stardust-300 hover:text-star-100 disabled:opacity-50"
                >
                  {exporting === "json" ? "Building." : "Download JSON"}
                </button>
              </div>
              <p className="mt-2 text-xs text-stardust-500">
                Optional. Every export is logged in your private history.
              </p>
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm text-stardust-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
              >
                Continue
              </button>
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-star-100">Who should be called in an emergency?</h2>
              <p className="mt-2 rounded-xl border border-nova-400/15 bg-nebula-900/60 px-4 py-3 text-xs leading-relaxed text-stardust-300">
                {COPY.emergencyDecoupled}
              </p>
            </div>
            {contacts.map((c, i) => (
              <div key={i} className="card-living rounded-3xl p-5">
                <p className="text-sm font-medium text-star-100">Contact {i + 1}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-stardust-500">Name</span>
                    <input
                      value={c.name}
                      onChange={(e) =>
                        setContacts((prev) => prev.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))
                      }
                      maxLength={80}
                      placeholder="Mom"
                      className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stardust-500">Relationship</span>
                    <input
                      value={c.relationship}
                      onChange={(e) =>
                        setContacts((prev) => prev.map((x, idx) => (idx === i ? { ...x, relationship: e.target.value } : x)))
                      }
                      maxLength={40}
                      placeholder="Mother"
                      className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-stardust-500">Phone</span>
                    <input
                      value={c.phone}
                      onChange={(e) =>
                        setContacts((prev) => prev.map((x, idx) => (idx === i ? { ...x, phone: e.target.value } : x)))
                      }
                      maxLength={20}
                      inputMode="tel"
                      placeholder="(555) 010-2030"
                      className="input-rooted w-full rounded-xl px-3 py-2 text-sm text-star-100"
                    />
                  </label>
                </div>
              </div>
            ))}
            {contacts.length < 5 && (
              <button
                type="button"
                onClick={addContact}
                className="text-sm text-nova-300 underline decoration-dotted underline-offset-2"
              >
                Add another contact
              </button>
            )}
            {contactsMsg && <p className="text-sm text-stardust-300">{contactsMsg}</p>}
            <div className="flex justify-between">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm text-stardust-300"
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveContacts}
                  className="rounded-xl border border-nova-400/30 px-4 py-2.5 text-sm font-medium text-stardust-300 hover:text-star-100"
                >
                  Save contacts
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="rounded-xl bg-nova-500 px-5 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-star-100">Save your choices</h2>
            <div className="card-living rounded-3xl p-5">
              <ul className="space-y-2 text-sm text-stardust-300">
                {parents.map((p) => (
                  <li key={p.userId}>
                    <span className="text-star-100">{p.label}</span>: Everyday wellness{" "}
                    {p.h1 ? "on" : "off"}, Private health {p.h2 ? "on" : "off"}. Most personal stays
                    only with you.
                  </li>
                ))}
                {parents.length === 0 && <li>No one selected. Everything stays private.</li>}
              </ul>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="rounded-xl bg-nova-500 px-5 py-3 text-sm font-semibold text-nebula-950 shadow-glow-sm disabled:opacity-50"
              >
                {submitting ? "Saving." : "Save my choices"}
              </button>
              <button
                type="button"
                onClick={skip}
                disabled={submitting}
                className="rounded-xl border border-nova-400/30 px-5 py-3 text-sm font-medium text-stardust-300 hover:text-star-100 disabled:opacity-50"
              >
                Skip. Keep everything private.
              </button>
            </div>
            <p className="text-xs text-stardust-500">
              Skipping is a real choice too. It means the same thing as turning everything off, and
              Pookie will stop asking.
            </p>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="text-sm text-stardust-300 underline decoration-dotted underline-offset-2 hover:text-star-100"
            >
              Back
            </button>
          </section>
        )}
      </div>

      <MedicalDisclaimerFooter />
    </div>
  );
}
