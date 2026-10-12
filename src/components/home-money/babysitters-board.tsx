// W12 Babysitters — directory + time-boxed grants (MD decision D6).
// Directory only: every row carries the data-model disclaimer
// "parent-vetted, not background-checked by Pookie". Grants are time-boxed
// with tiered caps (8/30d trusted, 2/30d first-time — server-enforced), teen
// co-approval (13–15) for NEW grantees only, instant teen revoke, and an
// expiry slope. The UI renders the tier + remaining count it is given and
// never computes eligibility client-side.
"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type {
  Babysitter,
  GranteeTier,
  SitterGrant,
} from "@/server/services/babysitters";
import {
  ApiError,
  api,
  AmberBanner,
  fmtDate,
  fmtDateTime,
  PageHeader,
  QuietConfirm,
  WarmError,
} from "@/components/home-money/shared";

const BASE = "/api/v1/household/babysitters";

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

const SCOPE_LABELS: Record<string, string> = {
  schedule: "Schedule & logistics",
  pickup: "Pickup authorization",
  emergency_medical: "Emergency medical card",
};

const NEVER_INCLUDED = [
  "check-ins",
  "journals",
  "chats with Pookie",
  "mood & health details",
  "full family messages",
];

function capFor(tier: GranteeTier): number {
  return tier === "trusted" ? 8 : 2;
}

/** Grants that count against the D6 cap (mirrors the server rule). */
function countsTowardCap(g: SitterGrant): boolean {
  return (
    ["active", "expired", "pending_approval"].includes(g.status) &&
    new Date(g.created_at).getTime() > Date.now() - 30 * 86_400_000
  );
}

function countdownLabel(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `ends in ${h}h ${m}m`;
  return `ends in ${m}m`;
}

/* ------------------------------------------------------------------ */
/* add sitter                                                          */
/* ------------------------------------------------------------------ */

function AddSitter({ onAdded }: { onAdded: (s: Babysitter) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr("Give the sitter a name.");
      return;
    }
    if (!attested) {
      setErr("Please confirm the vetting attestation — it IS the vetting record.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ sitter: Babysitter }>(BASE, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      });
      onAdded(data.sitter);
      setName("");
      setContact("");
      setNotes("");
      setAttested(false);
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-dapple w-full rounded-2xl px-5 py-3 text-base font-semibold text-nebula-950"
      >
        ➕ Add a sitter
      </button>
    );
  }
  return (
    <div className="animate-rise rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
      <p className="text-sm font-semibold text-star-100">Add a sitter</p>
      <div className="mt-3 space-y-2">
        <label className="block text-xs font-medium text-stardust-300">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Maya R." className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Relationship / phone
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="neighbor · 555-0142" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Notes <span className="text-stardust-500">(great with the dog, CPR certified 2025…)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} mt-1`} />
        </label>
        <label className="flex items-start gap-2 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3 text-xs text-stardust-300">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-400"
          />
          I&apos;ve met this person and trust them with my kids.
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-aurum-200">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="btn-dapple flex-1 rounded-xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add sitter"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-nebula-700 px-4 py-2 text-sm text-stardust-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* share-for-a-bit wizard                                              */
/* ------------------------------------------------------------------ */

const OCCASIONS = [
  { key: "tonight", label: "Tonight 6–10 PM", hours: [18, 22] as const, dayOffset: 0 },
  { key: "saturday", label: "Saturday 6–10 PM", hours: [18, 22] as const, dayOffset: null },
];

function occasionRange(key: string, customStart: string, customEnd: string): { starts: Date; ends: Date } | null {
  const now = new Date();
  if (key === "tonight") {
    const s = new Date(now);
    s.setHours(18, 0, 0, 0);
    const e = new Date(now);
    e.setHours(22, 0, 0, 0);
    if (e.getTime() < now.getTime()) {
      s.setDate(s.getDate() + 1);
      e.setDate(e.getDate() + 1);
    }
    return { starts: s, ends: e };
  }
  if (key === "saturday") {
    const s = new Date(now);
    const delta = (6 - s.getDay() + 7) % 7;
    s.setDate(s.getDate() + delta);
    s.setHours(18, 0, 0, 0);
    const e = new Date(s);
    e.setHours(22, 0, 0, 0);
    return { starts: s, ends: e };
  }
  if (key === "custom" && customStart && customEnd) {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return null;
    return { starts: s, ends: e };
  }
  return null;
}

function ShareWizard({
  sitter,
  grants,
  children,
  teenNames,
  onClose,
  onGrant,
}: {
  sitter: Babysitter;
  grants: SitterGrant[];
  children: { id: string; firstName: string; nickname: string | null }[];
  teenNames: Record<string, string>;
  onClose: () => void;
  onGrant: (g: SitterGrant) => void;
}) {
  const cap = capFor(sitter.trust_tier);
  const used = grants.filter(countsTowardCap).length;
  const remaining = Math.max(0, cap - used);
  const [step, setStep] = useState(1);
  const [childId, setChildId] = useState(children[0]?.id ?? "");
  const [occasion, setOccasion] = useState("tonight");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<SitterGrant | null>(null);
  const [capped, setCapped] = useState(false);

  const range = occasionRange(occasion, customStart, customEnd);
  const teenName = teenNames[childId] ?? "your teen";
  const isFirstTime = sitter.trust_tier === "first_time";

  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = window.setInterval(async () => {
      tries += 1;
      try {
        const data = await api<{ grants: SitterGrant[] }>(`${BASE}/${sitter.id}/grants`);
        const g = data.grants.find((x) => x.id === waiting.id);
        if (g && g.teen_coapproval_status === "approved") {
          window.clearInterval(t);
          onGrant(g);
          setWaiting(null);
          onClose();
        }
      } catch {
        /* keep polling */
      }
      if (tries >= 12) window.clearInterval(t);
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting]);

  const share = async () => {
    setErr(null);
    if (!range || !childId) {
      setErr("Pick a time window first.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ grant: SitterGrant }>(`${BASE}/${sitter.id}/grants`, {
        method: "POST",
        body: JSON.stringify({
          child_id: childId,
          purpose: `${occasion === "custom" ? "Custom sit" : OCCASIONS.find((o) => o.key === occasion)?.label ?? "Sit"} — ${sitter.name}`,
          starts_at: range.starts.toISOString(),
          expires_at: range.ends.toISOString(),
        }),
      });
      if (data.grant.teen_coapproval_status === "required") {
        setWaiting(data.grant);
      } else if (data.grant.status === "flagged") {
        onGrant(data.grant);
        onClose();
      } else {
        onGrant(data.grant);
        onClose();
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "RATE_LIMITED") {
        setCapped(true);
      } else {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (waiting) {
    return (
      <BottomSheet open onClose={onClose} title="Waiting on your teen">
        <div className="px-1 pb-6 text-center">
          <p aria-hidden="true" className="text-3xl">💬</p>
          <p className="mt-3 text-sm leading-relaxed text-stardust-200">
            We&apos;re asking {teenName} — {sitter.name} hasn&apos;t sat for you before, so they
            get a say. The share starts only if they say yes.
          </p>
          <p className="mt-2 text-xs text-stardust-500">
            They vote privately in their own Pookie. This screen updates when they answer.
          </p>
          <button
            onClick={onClose}
            className="mt-4 rounded-xl border border-nebula-700 px-5 py-2 text-sm text-stardust-300"
          >
            Close — I&apos;ll check back
          </button>
        </div>
      </BottomSheet>
    );
  }

  if (capped) {
    return (
      <BottomSheet open onClose={onClose} title="At this month's limit">
        <div className="px-1 pb-6">
          <p className="text-sm leading-relaxed text-stardust-200">
            {sitter.name} is at {cap} of {cap} shares this month. To share again, set up an
            ongoing share — {teenName} approves it from the Sharing screen.
          </p>
          <p className="mt-2 text-xs text-stardust-500">
            The limit keeps shares time-boxed. Ongoing shares carry your teen&apos;s explicit approval.
          </p>
          <button
            onClick={onClose}
            className="btn-dapple mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
          >
            Got it
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={`Share for a bit — ${sitter.name}`}>
      <div className="px-1 pb-6">
        <div className="flex items-center gap-2" aria-label={`Step ${step} of 4`}>
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-nova-400" : "bg-nebula-700"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">Who</p>
            <div className="mt-2 rounded-xl border border-nova-500/40 bg-nebula-950/60 p-3 text-sm text-stardust-200">
              <p className="font-semibold">{sitter.name}</p>
              <p className="mt-0.5 text-xs text-stardust-400">
                {sitter.trust_tier === "trusted" ? "trusted sitter" : "new sitter"} · {remaining} of {cap} shares left this month
              </p>
            </div>
            <label className="mt-3 block text-xs font-medium text-stardust-300">
              For which child?
              <select value={childId} onChange={(e) => setChildId(e.target.value)} className={`${inputCls} mt-1`}>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.nickname ?? c.firstName}</option>
                ))}
              </select>
            </label>
            <button onClick={() => setStep(2)} disabled={!childId} className="btn-dapple mt-4 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">When</p>
            <div className="mt-2 space-y-2">
              {OCCASIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setOccasion(o.key)}
                  aria-pressed={occasion === o.key}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${
                    occasion === o.key
                      ? "border-nova-500 bg-nova-500/10 text-star-100 shadow-glow-sm"
                      : "border-nebula-700 text-stardust-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
              <button
                onClick={() => setOccasion("custom")}
                aria-pressed={occasion === "custom"}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${
                  occasion === "custom"
                    ? "border-nova-500 bg-nova-500/10 text-star-100 shadow-glow-sm"
                    : "border-nebula-700 text-stardust-300"
                }`}
              >
                Custom…
              </button>
              {occasion === "custom" && (
                <div className="grid grid-cols-2 gap-2">
                  <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} aria-label="Starts" className={inputCls} />
                  <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} aria-label="Ends" className={inputCls} />
                </div>
              )}
            </div>
            {range && (
              <p className="mt-2 text-xs text-stardust-400">
                Ends {fmtDateTime(range.ends.toISOString())} — access switches off by itself.
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(1)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button onClick={() => setStep(isFirstTime ? 3 : 4)} disabled={!range} className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && isFirstTime && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">One more step — {teenName} gets a say</p>
            <div className="mt-2 rounded-xl border border-nebula-700 bg-nebula-950/60 p-4 text-sm leading-relaxed text-stardust-300">
              <p>{sitter.name} hasn&apos;t sat for you before, so we&apos;re asking {teenName} too. They see:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
                <li>Who: {sitter.name}</li>
                <li>When: {range ? `${fmtDateTime(range.starts.toISOString())} → ${fmtDateTime(range.ends.toISOString())}` : "—"}</li>
                <li>What: schedule, pickup, emergency card</li>
                <li>What NOT: check-ins, chats, anything private</li>
              </ul>
              <p className="mt-2 text-xs text-stardust-500">
                They get a simple yes/no in their Pookie. The share starts only if they say yes —
                and they vote privately.
              </p>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(2)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button onClick={() => setStep(4)} className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950">
                Ask {teenName}
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-star-100">What they can see</p>
            <div className="mt-2 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3">
              {Object.entries(SCOPE_LABELS).map(([k, label]) => (
                <p key={k} className="flex items-center gap-2 py-1 text-sm text-stardust-200">
                  <span aria-hidden="true" className="text-nova-300">☑</span> {label}
                </p>
              ))}
              <p className="mt-2 border-t border-nebula-700/60 pt-2 text-xs text-stardust-500">
                Not included, ever: {NEVER_INCLUDED.join(", ")}.
              </p>
              <p className="mt-1 text-xs text-stardust-500">
                Temporary shares never include private stuff — the app won&apos;t allow it.
              </p>
            </div>
            {!isFirstTime && (
              <p className="mt-2 text-xs text-stardust-400">
                {sitter.name} has shared before — no need to ask {teenName} again.
              </p>
            )}
            <div className="mt-3 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3 text-sm text-stardust-200">
              {sitter.name} gets schedule, pickup, and the emergency card
              {range && <> until {fmtDateTime(range.ends.toISOString())}</>}. That&apos;s it.
            </div>
            {err && <p className="mt-2 text-xs text-aurum-200">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => setStep(isFirstTime ? 3 : 2)} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300">Back</button>
              <button
                onClick={share}
                disabled={busy || !range}
                className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
              >
                {busy ? "Sharing…" : range ? `Share until ${fmtDate(range.ends.toISOString())}` : "Share"}
              </button>
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/* ------------------------------------------------------------------ */
/* sitter card + grants                                                */
/* ------------------------------------------------------------------ */

function SitterCard({
  sitter,
  grants,
  vettedByName,
  children,
  teenNames,
  myId,
  onShare,
  onGrant,
  onGrantsChanged,
}: {
  sitter: Babysitter;
  grants: SitterGrant[];
  vettedByName: string | null;
  children: { id: string; firstName: string; nickname: string | null }[];
  teenNames: Record<string, string>;
  myId: string | null;
  onShare: () => void;
  onGrant: (g: SitterGrant) => void;
  onGrantsChanged: (sitterId: string, grants: SitterGrant[]) => void;
}) {
  const cap = capFor(sitter.trust_tier);
  const used = grants.filter(countsTowardCap).length;
  const remaining = Math.max(0, cap - used);
  const active = grants.filter((g) => g.status === "active");
  const pending = grants.filter((g) => g.status === "pending_approval");
  const flagged = grants.filter((g) => g.status === "flagged");
  const expired = grants.filter((g) => g.status === "expired");
  const [revoking, setRevoking] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<SitterGrant | null>(null);
  const [closing, setClosing] = useState<SitterGrant | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);

  const recentCount = grants.filter(
    (g) => new Date(g.created_at).getTime() > Date.now() - 30 * 86_400_000,
  ).length;
  const bursty = recentCount >= 4;

  const revoke = async (g: SitterGrant, by: "parent" | "teen") => {
    setRevoking(g.id);
    try {
      await api(`${BASE}/grants/${g.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ revoked_by: by }),
      });
      onGrantsChanged(
        sitter.id,
        grants.map((x) => (x.id === g.id ? { ...x, status: "revoked" as const } : x)),
      );
    } catch {
      /* stays active — failed revokes must be explicit */
    } finally {
      setRevoking(null);
      setConfirmEnd(null);
    }
  };

  const approveFlagged = async (g: SitterGrant) => {
    setCloseBusy(true);
    try {
      const data = await api<{ grant: SitterGrant }>(`${BASE}/grants/${g.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ as_teen: false }),
      });
      onGrantsChanged(
        sitter.id,
        grants.map((x) => (x.id === g.id ? data.grant : x)),
      );
    } catch {
      /* stays flagged */
    } finally {
      setCloseBusy(false);
    }
  };

  const closeGrant = async (g: SitterGrant, blocked: boolean) => {
    setCloseBusy(true);
    try {
      await api(`${BASE}/grants/${g.id}/close`, {
        method: "POST",
        body: JSON.stringify({ blocked }),
      });
      onGrantsChanged(
        sitter.id,
        grants.map((x) => (x.id === g.id ? { ...x, status: "expired" as const } : x)),
      );
      setClosing(null);
    } catch {
      /* stays */
    } finally {
      setCloseBusy(false);
    }
  };

  const vettedLabel = sitter.vetted_at ? fmtDate(sitter.vetted_at) : null;

  return (
    <div className="animate-bloom rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4 shadow-glow-sm">
      <div className="flex items-start gap-3">
        <div
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-nova-500/40 bg-nebula-800 text-base font-bold text-nova-300 shadow-glow-sm"
        >
          {sitter.name.trim()[0]?.toUpperCase() ?? "•"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-star-100">{sitter.name}</p>
          {sitter.contact && <p className="text-xs text-stardust-400">{sitter.contact}</p>}
          <p className="mt-1 text-xs text-stardust-300">
            ✅ Vetted by {vettedByName ?? "a parent"}
            {vettedLabel && ` · ${vettedLabel}`}
          </p>
          <p className="mt-0.5 text-xs text-nova-300">
            {sitter.trust_tier === "trusted" ? "trusted sitter" : "new sitter"} · {remaining} of {cap} shares left this month
          </p>
          <p className="mt-1 text-[11px] text-stardust-500">
            ⚠️ Parent-vetted, not background-checked by Pookie.
          </p>
          {bursty && (
            <p className="mt-1 text-[11px] text-aurum-200">
              Shared {recentCount} times this month in short bursts — take a look.
            </p>
          )}
        </div>
      </div>
      {sitter.notes && <p className="mt-2 text-xs text-stardust-400 italic">{sitter.notes}</p>}

      {/* active grants */}
      {active.map((g) => (
        <div key={g.id} className="mt-3 rounded-xl border border-nova-500/40 bg-nebula-950/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-star-100">
              🟢 {sitter.name} has access until {fmtDateTime(g.expires_at)}
            </p>
            <p className="shrink-0 text-xs text-stardust-400">⏳ {countdownLabel(g.expires_at)}</p>
          </div>
          <p className="mt-1 text-xs text-stardust-400">
            {g.scope.map((s) => SCOPE_LABELS[s] ?? s).join(" · ")} · for {teenNames[g.child_id] ?? "your teen"}
          </p>
          <button
            onClick={() => setConfirmEnd(g)}
            disabled={revoking === g.id}
            className="mt-2 rounded-lg border border-nebula-700 px-3 py-1 text-xs text-stardust-300 hover:border-aurum-400/60 hover:text-aurum-200 disabled:opacity-50"
          >
            {revoking === g.id ? "Ending…" : "End now"}
          </button>
        </div>
      ))}

      {/* pending teen co-approval */}
      {pending.map((g) => (
        <div key={g.id} className="mt-3 rounded-xl border border-aurum-400/40 bg-nebula-950/70 p-3">
          <p className="text-sm text-stardust-200">
            ⏳ Waiting on {teenNames[g.child_id] ?? "your teen"} — the share starts only if they say yes.
          </p>
          <button
            onClick={() => revoke(g, "parent")}
            disabled={revoking === g.id}
            className="mt-2 rounded-lg border border-nebula-700 px-3 py-1 text-xs text-stardust-300 disabled:opacity-50"
          >
            {revoking === g.id ? "Canceling…" : "Cancel request"}
          </button>
        </div>
      ))}

      {/* flagged installment review */}
      {flagged.map((g) => (
        <div key={g.id} className="mt-3 rounded-xl border border-aurum-400/50 bg-nebula-950/70 p-3">
          <p className="text-sm text-stardust-200">
            🚩 Flagged: rapid back-to-back shares. Review before it goes live.
          </p>
          <button
            onClick={() => approveFlagged(g)}
            disabled={closeBusy}
            className="mt-2 rounded-lg border border-aurum-400/60 px-3 py-1 text-xs font-semibold text-aurum-200 disabled:opacity-50"
          >
            {closeBusy ? "Reviewing…" : "Review & approve"}
          </button>
        </div>
      ))}

      {/* expired — close out */}
      {expired.slice(0, 2).map((g) => (
        <div key={g.id} className="mt-3 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3">
          <p className="text-xs text-stardust-400">
            Sit on {fmtDate(g.starts_at)} ended. How did it go?
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => closeGrant(g, false)}
              disabled={closeBusy}
              className="rounded-lg border border-nova-600/50 px-3 py-1 text-xs font-medium text-nova-300 disabled:opacity-50"
            >
              ✓ All good
            </button>
            <button
              onClick={() => closeGrant(g, true)}
              disabled={closeBusy}
              className="rounded-lg border border-nebula-700 px-3 py-1 text-xs text-stardust-400 disabled:opacity-50"
            >
              Report a problem
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={onShare}
        className="btn-dapple mt-3 w-full rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950"
      >
        {remaining === 0 ? "At this month's limit — options →" : "Share for a bit →"}
      </button>

      <QuietConfirm
        open={confirmEnd != null}
        onClose={() => setConfirmEnd(null)}
        title={`End ${sitter.name}'s access now?`}
        body={<p>Access switches off immediately. They&apos;ll see a friendly &quot;all done&quot; note — never a reason.</p>}
        confirmLabel="End now"
        danger
        busy={revoking != null}
        onConfirm={() => confirmEnd && revoke(confirmEnd, "parent")}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function BabysittersBoard() {
  const [sitters, setSitters] = useState<Babysitter[] | null>(null);
  const [grantsBySitter, setGrantsBySitter] = useState<Record<string, SitterGrant[]>>({});
  const [children, setChildren] = useState<{ id: string; firstName: string; nickname: string | null }[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [vettingWhat, setVettingWhat] = useState(false);
  const [sharing, setSharing] = useState<Babysitter | null>(null);

  const load = async () => {
    setError(null);
    try {
      const [dir, me, kids] = await Promise.all([
        api<{ sitters: Babysitter[] }>(BASE),
        api<{ id: string; name: string | null }>("/api/v1/me").catch(() => null),
        api<{ children: { id: string; firstName: string; nickname: string | null }[] }>("/api/v1/children").catch(
          () => ({ children: [] }),
        ),
      ]);
      setSitters(dir.sitters);
      if (me) {
        setMyId(me.id);
        setMyName(me.name);
      }
      setChildren(kids.children);
      const grants = await Promise.all(
        dir.sitters.map(async (s) => {
          try {
            const g = await api<{ grants: SitterGrant[] }>(`${BASE}/${s.id}/grants`);
            return [s.id, g.grants] as const;
          } catch {
            return [s.id, []] as const;
          }
        }),
      );
      setGrantsBySitter(Object.fromEntries(grants));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const teenNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of children) m[c.id] = c.nickname ?? c.firstName;
    return m;
  }, [children]);

  const onGrantsChanged = (sitterId: string, grants: SitterGrant[]) =>
    setGrantsBySitter((prev) => ({ ...prev, [sitterId]: grants }));

  if (sitters == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error ? (
          <WarmError message={error} onRetry={load} />
        ) : (
          <p className="text-center text-sm text-stardust-300">Opening your sitters…</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <PageHeader
        eyebrow="🤝 Marketplace"
        icon="🧸"
        title="Babysitters"
        subtitle="People you trust — shared with, for a bit, on your terms."
      />

      {/* disclaimer placement 1: module top, every visit */}
      <div className="mt-4">
        <AmberBanner
          icon="⚠️"
          action={
            <button
              onClick={() => setVettingWhat(true)}
              className="text-xs text-nova-300 underline decoration-dotted underline-offset-4"
            >
              What vetting means →
            </button>
          }
        >
          <span className="font-medium text-star-100">
            Parent-vetted, not background-checked by Pookie.
          </span>
          <br />
          Everyone here was added and vetted by YOU — a parent. Pookie has not run
          background checks on anyone listed.
        </AmberBanner>
      </div>

      <div className="mt-4">
        <AddSitter onAdded={(s) => {
          setSitters((prev) => (prev ? [...prev, s] : [s]));
          setGrantsBySitter((prev) => ({ ...prev, [s.id]: [] }));
        }} />
      </div>

      {error && (
        <div className="mt-4">
          <WarmError message={error} onRetry={load} />
        </div>
      )}

      {sitters.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-8 text-center">
          <p aria-hidden="true" className="text-3xl">🧸</p>
          <p className="text-sunlit mt-3 text-base font-semibold">No sitters yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
            Add someone you trust — you&apos;ll vet them, and time-boxed shares keep it safe.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {sitters.map((s) => (
            <SitterCard
              key={s.id}
              sitter={s}
              grants={grantsBySitter[s.id] ?? []}
              vettedByName={s.vetted_by && myId && s.vetted_by === myId ? myName ?? "you" : null}
              children={children}
              teenNames={teenNames}
              myId={myId}
              onShare={() => setSharing(s)}
              onGrant={(g) =>
                setGrantsBySitter((prev) => ({ ...prev, [s.id]: [g, ...(prev[s.id] ?? [])] }))
              }
              onGrantsChanged={onGrantsChanged}
            />
          ))}
        </div>
      )}

      {sharing && (
        <ShareWizard
          sitter={sharing}
          grants={grantsBySitter[sharing.id] ?? []}
          children={children}
          teenNames={teenNames}
          onClose={() => setSharing(null)}
          onGrant={(g) =>
            setGrantsBySitter((prev) => ({ ...prev, [sharing.id]: [g, ...(prev[sharing.id] ?? [])] }))
          }
        />
      )}

      <BottomSheet open={vettingWhat} onClose={() => setVettingWhat(false)} title="What vetting means">
        <div className="px-1 pb-6 text-sm leading-relaxed text-stardust-300">
          <p>
            <span className="font-medium text-star-100">Vetted</span> means a parent added this
            person, met them, and trusts them with their kids.
          </p>
          <p className="mt-3">
            It does <span className="font-medium text-star-100">not</span> mean a criminal
            background check. Pookie doesn&apos;t run background checks — doing that properly
            needs special legal permission first.
          </p>
          <p className="mt-3">
            If you want a real background check, families usually go through a licensed
            screening service or their state&apos;s childcare registry. We can point you to
            options — ask in Support.
          </p>
        </div>
      </BottomSheet>
    </main>
  );
}
