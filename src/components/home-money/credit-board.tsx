// W24 Credit — minor security-freeze management. Re-scoped: NO bureau
// monitoring, NO scores, NO pulls (no FCRA permissible purpose). The app
// guides and tracks freeze placement; it never pulls the file itself.
//
// The "pending legal review" banner is a first-class state: the dashboard,
// checklists, and guides all work behind it — only the request submission is
// held. Driven by counsel_review_status from the API; when it flips to
// 'approved', the same screens unlock.
"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type {
  Bureau,
  CounselReviewStatus,
  CreditFreeze,
  FreezeStatus,
} from "@/server/services/credit";
import {
  ApiError,
  api,
  AmberBanner,
  fmtDate,
  InfoBanner,
  PageHeader,
  WarmError,
} from "@/components/home-money/shared";

const BUREAUS: { key: Bureau; name: string; howTo: string }[] = [
  {
    key: "equifax",
    name: "Equifax",
    howTo:
      "Equifax takes freeze requests for minors by mail. Send the packet to the minor-freeze address on their site, with everything on the checklist.",
  },
  {
    key: "experian",
    name: "Experian",
    howTo:
      "Experian takes minor freeze requests by mail. Include the cover letter and every document on the checklist — incomplete packets get returned.",
  },
  {
    key: "transunion",
    name: "TransUnion",
    howTo:
      "TransUnion takes minor freeze requests by mail. Keep a copy of everything you send; they usually confirm in 1–3 weeks.",
  },
  {
    key: "innovis",
    name: "Innovis",
    howTo:
      "Innovis takes minor freeze requests by mail. Smaller bureau, same rules — the checklist covers what they need.",
  },
  {
    key: "chexsystems",
    name: "ChexSystems",
    howTo:
      "ChexSystems covers bank accounts rather than credit cards. Freeze here too — it stops accounts being opened in a minor's name.",
  },
];

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

function statusPill(status: FreezeStatus): { icon: string; label: string; frozen: boolean } {
  switch (status) {
    case "confirmed":
      return { icon: "🧊", label: "Frozen", frozen: true };
    case "requested":
      return { icon: "⏳", label: "Request sent", frozen: false };
    case "temporarily_lifted":
      return { icon: "⏸️", label: "Lifted for now", frozen: false };
    case "removed":
      return { icon: "○", label: "Removed", frozen: false };
    case "error":
      return { icon: "⚠️", label: "Needs attention", frozen: false };
    default:
      return { icon: "○", label: "Not yet", frozen: false };
  }
}

interface PacketState {
  birthCert: boolean;
  ssn: boolean;
  ssnLast4: string;
  parentId: boolean;
  address: boolean;
  readyToSend: boolean;
  mailed: boolean;
  mailedAt: string | null;
  confirmationRef: string;
}

const EMPTY_PACKET: PacketState = {
  birthCert: false,
  ssn: false,
  ssnLast4: "",
  parentId: false,
  address: false,
  readyToSend: false,
  mailed: false,
  mailedAt: null,
  confirmationRef: "",
};

function packetKey(childId: string, bureau: Bureau): string {
  return `pookie.credit.packet.${childId}.${bureau}`;
}

function loadPacket(childId: string, bureau: Bureau): PacketState {
  try {
    const raw = window.localStorage.getItem(packetKey(childId, bureau));
    if (raw) return { ...EMPTY_PACKET, ...(JSON.parse(raw) as Partial<PacketState>) };
  } catch {
    /* fresh packet */
  }
  return { ...EMPTY_PACKET };
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function CreditBoard({ childId, childName }: { childId: string; childName: string }) {
  const BASE = `/api/v1/children/${childId}/credit`;
  const [state, setState] = useState<{
    counsel_review_status: CounselReviewStatus;
    freezes: CreditFreeze[];
    guidance: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [whatOpen, setWhatOpen] = useState(false);
  const [builder, setBuilder] = useState<Bureau | null>(null);
  const [guidesOpen, setGuidesOpen] = useState(false);

  const load = async () => {
    setError(null);
    setForbidden(false);
    try {
      const data = await api<{
        counsel_review_status: CounselReviewStatus;
        freezes: CreditFreeze[];
        guidance: string;
      }>(BASE);
      setState(data);
    } catch (e) {
      if (e instanceof ApiError && (e.code === "PARENT_ROLE_REQUIRED" || e.code === "TENANT_SCOPE_VIOLATION")) {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
      }
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childId]);

  const seed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const data = await api<{ freezes: CreditFreeze[]; counsel_review_status: CounselReviewStatus }>(
        BASE,
        { method: "POST", body: "{}" },
      );
      setState((s) => ({
        counsel_review_status: data.counsel_review_status,
        freezes: data.freezes,
        guidance: s?.guidance ?? "",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    } finally {
      setSeeding(false);
    }
  };

  const refreshPacket = () => load();

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="🏠 Home" icon="🧊" title="Credit Freezes" subtitle="Freeze management for minors." />
        <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
          <p className="text-sm text-stardust-300">
            Credit freeze management is a parent/guardian space — only a parent can place or track freezes.
          </p>
        </div>
      </main>
    );
  }

  if (state == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error ? (
          <WarmError message={error} onRetry={load} />
        ) : (
          <p className="text-center text-sm text-stardust-300">Checking your freeze board…</p>
        )}
      </main>
    );
  }

  const pending = state.counsel_review_status !== "approved";
  const byBureau = new Map(state.freezes.map((f) => [f.bureau, f]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <PageHeader
        eyebrow="🏠 Home"
        icon="🧊"
        title="Credit Freezes"
        subtitle={`${childName} — freeze the file, track it here.`}
        back
      />

      <div className="mt-4">
        <InfoBanner icon="ℹ️">
          <span className="font-medium text-star-100">Pookie is not a credit reporting agency.</span>
          <br />
          We don&apos;t show credit scores or reports — we help you freeze and track them.
        </InfoBanner>
      </div>

      {pending && (
        <div className="mt-4">
          <AmberBanner
            icon="⏳"
            action={
              <button
                onClick={() => setWhatOpen(true)}
                className="text-xs text-nova-300 underline decoration-dotted underline-offset-4"
              >
                What&apos;s this? →
              </button>
            }
          >
            <span className="font-medium text-star-100">
              Freeze requests are being reviewed by our lawyers.
            </span>
            <br />
            Your checklists, documents, and freeze status below are saved and ready —
            we&apos;ll unlock requests when review clears.
          </AmberBanner>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <WarmError message={error} onRetry={load} />
        </div>
      )}

      {state.freezes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-8 text-center">
          <p aria-hidden="true" className="text-3xl">🧊</p>
          <p className="text-sunlit mt-3 text-base font-semibold">Start with one bureau</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
            Freezing a minor&apos;s credit file stops anyone from opening accounts in their name.
            We&apos;ll walk you through it.
          </p>
          <button
            onClick={seed}
            disabled={seeding}
            className="btn-dapple mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {seeding ? "Setting up…" : "Start with Equifax"}
          </button>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-sm font-semibold tracking-wide text-nova-300 capitalize">
            {childName}&apos;s freeze board
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BUREAUS.map((b) => {
              const row = byBureau.get(b.key);
              const pill = statusPill(row?.freeze_status ?? "not_requested");
              const packet = loadPacket(childId, b.key);
              const readyLocal = packet.readyToSend && (row?.freeze_status ?? "not_requested") === "not_requested";
              return (
                <button
                  key={b.key}
                  onClick={() => setBuilder(b.key)}
                  className={`rounded-2xl border p-4 text-left transition-colors ${
                    pill.frozen
                      ? "border-nova-500/40 bg-nebula-900/90 shadow-glow-sm"
                      : "border-nebula-700 bg-nebula-900/70 hover:border-nova-500/60"
                  }`}
                >
                  <p className="text-sm font-semibold text-star-100">{b.name}</p>
                  <p className="mt-1 text-xs">
                    <span aria-hidden="true" className="mr-1">{readyLocal ? "⏳" : pill.icon}</span>
                    <span className={pill.frozen ? "text-nova-300" : "text-stardust-300"}>
                      {readyLocal ? "Packet ready" : pill.label}
                    </span>
                  </p>
                  {row?.confirmed_at && (
                    <p className="mt-0.5 text-[11px] text-stardust-500">since {fmtDate(row.confirmed_at)}</p>
                  )}
                  {row?.freeze_status === "not_requested" && !readyLocal && (
                    <p className="mt-1 text-xs font-medium text-nova-300">Request →</p>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-8">
            <button
              onClick={() => setGuidesOpen((o) => !o)}
              aria-expanded={guidesOpen}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="text-sm font-semibold tracking-wide text-nova-300 capitalize">
                📚 Freeze guides
              </span>
              <span aria-hidden="true" className={`text-nova-300 transition-transform ${guidesOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {guidesOpen && (
              <div className="mt-3 space-y-2">
                <Guide title="What a freeze does (and doesn't do)">
                  <p>
                    A security freeze locks a credit file so no new accounts can be opened in
                    that name — not by a stranger, and not by accident. It doesn&apos;t affect
                    existing accounts, and it doesn&apos;t change a credit score.
                  </p>
                  <p className="mt-2">
                    In Georgia, the law (O.C.G.A. §§ 10-1-914 and 10-1-914.1) lets a parent or
                    guardian place a freeze on a minor&apos;s file — or create a protected
                    record if the minor doesn&apos;t have a file yet. That&apos;s the law this
                    whole module is built on.
                  </p>
                </Guide>
                <Guide title="When to lift: first job, college apps">
                  <p>
                    Some moments need the file open — a first job&apos;s background check, a
                    college application, opening a first bank account. Lift only the bureau
                    that asked, only for as long as needed, then re-freeze. The board tracks
                    every lift so nothing stays open by accident.
                  </p>
                </Guide>
                <Guide title="If you suspect identity theft">
                  <p>
                    1. Freeze all five bureaus immediately. 2. File a report at
                    IdentityTheft.gov — it creates a personal recovery plan. 3. Keep every
                    confirmation letter; you&apos;ll need the PINs to lift later. 4. Tell
                    Pookie&apos;s support if you need help — a real person, not a bot.
                  </p>
                </Guide>
                <Guide title="Turning 18: your file becomes yours">
                  <p>
                    At 18 the file — and the freezes — transfer to the new adult. They can
                    keep the freezes, lift them, or remove them entirely. Nothing a parent
                    set up locks them out: the PINs and confirmation letters go with them.
                  </p>
                </Guide>
              </div>
            )}
          </div>
        </>
      )}

      <BottomSheet open={whatOpen} onClose={() => setWhatOpen(false)} title="What's being reviewed?">
        <div className="px-1 pb-6 text-sm leading-relaxed text-stardust-300">
          <p>
            Our lawyers are reviewing the freeze-request steps to make sure we get them
            exactly right for every bureau — the addresses, the documents, the wording.
          </p>
          <p className="mt-3">
            Your progress is saved. The moment review clears, the request step unlocks —
            nothing you&apos;ve done needs redoing.
          </p>
          <p className="mt-3 text-xs text-stardust-500">
            This review is diligence, not danger. The tracking, checklists, and guides
            all work normally while it&apos;s pending.
          </p>
        </div>
      </BottomSheet>

      {builder && (
        <PacketBuilder
          childId={childId}
          childName={childName}
          bureau={BUREAUS.find((b) => b.key === builder)!}
          approved={!pending}
          onClose={() => {
            setBuilder(null);
            refreshPacket();
          }}
        />
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* guide article                                                       */
/* ------------------------------------------------------------------ */

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-stardust-100">{title}</span>
        <span aria-hidden="true" className={`text-nova-300 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="border-t border-nebula-700/60 px-4 py-3 text-sm leading-relaxed text-stardust-300">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* request-freeze packet builder (4 steps; submission held while the    */
/* legal gate is pending — the packet saves as "ready to send")        */
/* ------------------------------------------------------------------ */

const CHECKLIST: { key: keyof Pick<PacketState, "birthCert" | "ssn" | "parentId" | "address">; label: string; hint: string }[] = [
  { key: "birthCert", label: "Child's birth certificate", hint: "A copy is fine — keep the original safe." },
  { key: "ssn", label: "Child's Social Security card", hint: "We store the last 4 only, masked." },
  { key: "parentId", label: "Parent/guardian photo ID", hint: "Driver's license or passport." },
  { key: "address", label: "Proof of address", hint: "Utility bill or bank statement." },
];

function PacketBuilder({
  childId,
  childName,
  bureau,
  approved,
  onClose,
}: {
  childId: string;
  childName: string;
  bureau: { key: Bureau; name: string; howTo: string };
  approved: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(1);
  const [packet, setPacket] = useState<PacketState>(() => loadPacket(childId, bureau.key));

  const save = (next: PacketState) => {
    setPacket(next);
    try {
      window.localStorage.setItem(packetKey(childId, bureau.key), JSON.stringify(next));
    } catch {
      /* checklist still works for the session */
    }
  };

  const done = [packet.birthCert, packet.ssn, packet.parentId, packet.address].filter(Boolean).length;

  const coverLetter = [
    `Re: Request for minor security freeze — ${childName}`,
    ``,
    `To the ${bureau.name} Minor Freeze Department:`,
    ``,
    `I am the parent/guardian of the minor named above and request a security`,
    `freeze (or protected record, if no file exists) under applicable state law,`,
    `including O.C.G.A. §§ 10-1-914/914.1.`,
    ``,
    `Enclosed:`,
    `  [ ] Child's birth certificate (copy)`,
    `  [ ] Child's Social Security card (copy)`,
    `  [ ] Parent/guardian photo ID (copy)`,
    `  [ ] Proof of address`,
    ``,
    `Please confirm the freeze in writing and include any PIN issued.`,
    ``,
    `Signature: ________________________    Date: ____________`,
    `Printed name: ________________________`,
    `Address: ________________________`,
  ].join("\n");

  return (
    <BottomSheet open onClose={onClose} title={`Freeze request — ${bureau.name}`}>
      <div className="px-1 pb-6">
        {/* step dots */}
        <div className="flex items-center gap-2" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-nova-400" : "bg-nebula-700"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">Who & where</p>
            <div className="mt-2 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3 text-sm text-stardust-200">
              <p>Child: <span className="font-semibold">{childName}</span></p>
              <p className="mt-1">Bureau: <span className="font-semibold">{bureau.name}</span></p>
            </div>
            <button onClick={() => setStep(2)} className="btn-dapple mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">Document checklist</p>
            <p className="mt-0.5 text-xs text-stardust-400">Progress: {done} of 4 ready</p>
            <div className="mt-2 space-y-2">
              {CHECKLIST.map((c) => (
                <label key={c.key} className="flex items-start gap-3 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3">
                  <input
                    type="checkbox"
                    checked={!!packet[c.key]}
                    onChange={(e) => save({ ...packet, [c.key]: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-emerald-400"
                  />
                  <span>
                    <span className="block text-sm text-stardust-100">{c.label}</span>
                    <span className="block text-xs text-stardust-500">{c.hint}</span>
                    {c.key === "ssn" && packet.ssn && (
                      <input
                        value={packet.ssnLast4}
                        onChange={(e) => save({ ...packet, ssnLast4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                        placeholder="last 4"
                        inputMode="numeric"
                        maxLength={4}
                        aria-label="Social Security last 4 digits"
                        className={`${inputCls} mt-1 w-28`}
                      />
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={done < 4}
                className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
              >
                {done < 4 ? `${4 - done} document${4 - done === 1 ? "" : "s"} to go` : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">How to send</p>
            <p className="mt-1 text-sm leading-relaxed text-stardust-300">{bureau.howTo}</p>
            <p className="mt-3 text-sm font-medium text-star-100">Cover letter — filled in for you</p>
            <pre className="mt-1 max-h-64 overflow-auto rounded-xl border border-nebula-700 bg-nebula-950/80 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-stardust-300">
              {coverLetter}
            </pre>
            <button
              onClick={() => window.print()}
              className="mt-3 w-full rounded-xl border border-nova-600/50 px-5 py-2 text-sm font-semibold text-nova-300 hover:bg-nova-600/15"
            >
              🖨️ Print packet
            </button>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button onClick={() => setStep(4)} className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">Track it</p>
            {packet.readyToSend ? (
              <div className="mt-2 rounded-xl border border-aurum-400/45 bg-nebula-950/60 p-4">
                <p className="text-sm text-stardust-100">
                  ⏳ Packet saved — ready to send once legal review clears.
                </p>
                <p className="mt-1 text-xs text-stardust-400">
                  Nothing was mailed and no bureau was contacted. Your checklist is safe.
                </p>
              </div>
            ) : approved ? (
              <div className="mt-2 space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3">
                  <input
                    type="checkbox"
                    checked={packet.mailed}
                    onChange={(e) =>
                      save({ ...packet, mailed: e.target.checked, mailedAt: e.target.checked ? new Date().toISOString() : null })
                    }
                    className="mt-0.5 h-4 w-4 accent-emerald-400"
                  />
                  <span className="text-sm text-stardust-200">Packet mailed</span>
                </label>
                {packet.mailed && (
                  <label className="block text-xs font-medium text-stardust-300">
                    Confirmation reference <span className="text-stardust-500">(when the bureau replies)</span>
                    <input
                      value={packet.confirmationRef}
                      onChange={(e) => save({ ...packet, confirmationRef: e.target.value })}
                      placeholder="Bureau reference code"
                      className={`${inputCls} mt-1`}
                    />
                  </label>
                )}
                <p className="text-xs text-stardust-500">
                  Bureaus usually confirm in 1–3 weeks. We&apos;ll remind you to check.
                </p>
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-aurum-400/45 bg-nebula-950/60 p-4">
                <p className="text-sm text-stardust-100">
                  ⏳ Our lawyers are still reviewing this step.
                </p>
                <p className="mt-1 text-xs text-stardust-400">
                  Save the packet now — it&apos;ll be ready to mail the moment review clears.
                </p>
                <button
                  onClick={() => save({ ...packet, readyToSend: true })}
                  className="btn-dapple mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
                >
                  Save packet as ready to send
                </button>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(3)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button onClick={onClose} className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
