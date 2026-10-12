// W14 Co-parenting — parallel-parenting mode. This module reduces contact,
// not facilitates it. Two separate surfaces (mine / theirs), an immutable
// log (INSERT-only — no edit, no delete, corrections are new linked rows),
// logistics-only entry types, no messaging UI at all, and a first-class
// "pending family-law review" state. Launch: read-only/logistics-only.
"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type {
  CoparentingEntry,
  CoparentingEntryType,
} from "@/server/services/coparenting";
import {
  ApiError,
  api,
  AmberBanner,
  fmtDateTime,
  ImmutableBanner,
  ImmutableCard,
  PageHeader,
  WarmError,
} from "@/components/home-money/shared";

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

const TYPE_META: Record<
  CoparentingEntryType,
  { icon: string; label: string; hint: string }
> = {
  pickup: { icon: "🚗", label: "Pickup", hint: "who · date · time · place (neighborhood or ZIP — never precise)" },
  dropoff: { icon: "🏠", label: "Dropoff", hint: "who · date · time · place (neighborhood or ZIP — never precise)" },
  expense: { icon: "💵", label: "Expense", hint: "what for · amount · who paid · status" },
  schedule: { icon: "📅", label: "Schedule change", hint: "what changed · old plan → new plan · effective date" },
  medical_logistics: { icon: "🏥", label: "Medical logistics", hint: "one line, logistics only — e.g. inhaler in the blue backpack" },
};

type Tab = "mine" | "log" | "teen";

/* ------------------------------------------------------------------ */
/* entry form                                                          */
/* ------------------------------------------------------------------ */

function EntryForm({
  childId,
  childName,
  correcting,
  onSaved,
  onCancel,
}: {
  childId: string;
  childName: string;
  correcting?: CoparentingEntry | null;
  onSaved: (e: CoparentingEntry) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<CoparentingEntryType>(correcting?.entry_type ?? "pickup");
  const [content, setContent] = useState("");
  const [amount, setAmount] = useState(
    correcting?.expense_amount != null ? String(correcting.expense_amount) : "",
  );
  const [occursAt, setOccursAt] = useState("");
  const [place, setPlace] = useState("");
  const [custodyRef, setCustodyRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const teenAddressed =
    /\b(tell|ask|message)\b/i.test(content) ||
    (childName.length > 2 && new RegExp(childName, "i").test(content));
  const looksLikeTravel =
    (type === "pickup" || type === "dropoff") &&
    place.trim().length > 0 &&
    !/^\d{5}(-\d{4})?$/.test(place.trim());

  const save = async () => {
    setErr(null);
    if (!content.trim()) {
      setErr("Give it one line — the log is logistics only.");
      return;
    }
    if (type === "medical_logistics" && content.trim().length > 140) {
      setErr("Keep it to one line (140 characters) — it isn't a letter.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ entry: CoparentingEntry }>(
        `/api/v1/children/${childId}/coparenting/log`,
        {
          method: "POST",
          body: JSON.stringify({
            entry_type: type,
            content: place.trim() ? `${content.trim()} — ${place.trim()}` : content.trim(),
            expense_amount: type === "expense" && amount ? Number(amount) : undefined,
            occurs_at: occursAt ? new Date(occursAt).toISOString() : undefined,
            custody_order_ref: custodyRef.trim() || undefined,
            travel_restriction_flags: looksLikeTravel ? { travel_noted: true } : undefined,
            corrects_entry_id: correcting?.id ?? undefined,
          }),
        },
      );
      onSaved(data.entry);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-rise rounded-2xl border border-nebula-700 bg-nebula-900/70 p-4">
      <p className="text-sm font-semibold text-star-100">
        {correcting ? "Log a correction" : "Log an entry"}
      </p>
      {correcting && (
        <p className="mt-1 text-xs text-stardust-400">
          Corrections are new entries linked to the original — the original stays exactly as written.
        </p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(TYPE_META) as CoparentingEntryType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`rounded-xl border p-3 text-left ${
              type === t
                ? "border-nova-500 bg-nova-500/10 shadow-glow-sm"
                : "border-nebula-700 hover:border-nova-500/60"
            }`}
          >
            <p aria-hidden="true" className="text-lg">{TYPE_META[t].icon}</p>
            <p className="mt-1 text-xs font-semibold text-stardust-100">{TYPE_META[t].label}</p>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-stardust-500">{TYPE_META[type].hint}</p>

      <label className="mt-3 block text-xs font-medium text-stardust-300">
        {type === "medical_logistics" ? "One line, logistics only" : "Details"}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={type === "medical_logistics" ? 140 : 1000}
          placeholder={type === "expense" ? "Soccer cleats — $45, paid by me" : "Friday pickup, 6 PM"}
          className={`${inputCls} mt-1`}
        />
      </label>
      {teenAddressed && (
        <p className="mt-2 rounded-xl border border-aurum-400/40 bg-nebula-800/70 p-2.5 text-xs leading-relaxed text-aurum-200">
          This log is between parents. Talk to {childName} directly — or check the Teen lens below for ideas.
        </p>
      )}

      <div className="mt-2 grid grid-cols-2 gap-3">
        {(type === "pickup" || type === "dropoff") && (
          <label className="block text-xs font-medium text-stardust-300">
            Place <span className="text-stardust-500">(neighborhood / ZIP)</span>
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="30327" className={`${inputCls} mt-1`} />
          </label>
        )}
        <label className="block text-xs font-medium text-stardust-300">
          When
          <input value={occursAt} onChange={(e) => setOccursAt(e.target.value)} type="datetime-local" className={`${inputCls} mt-1`} />
        </label>
        {type === "expense" && (
          <label className="block text-xs font-medium text-stardust-300">
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="45.00" className={`${inputCls} mt-1`} />
          </label>
        )}
      </div>
      {looksLikeTravel && (
        <p className="mt-2 text-xs text-stardust-400">
          🧭 This looks like travel — check your travel rules at the top of this module.
        </p>
      )}
      <label className="mt-2 block text-xs font-medium text-stardust-300">
        Custody order reference <span className="text-stardust-500">(optional)</span>
        <input value={custodyRef} onChange={(e) => setCustodyRef(e.target.value)} placeholder="e.g. §4.2 holiday schedule" className={`${inputCls} mt-1`} />
      </label>

      {err && <p className="mt-2 text-xs text-aurum-200">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="btn-dapple flex-1 rounded-xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {busy ? "Logging…" : "Log it — permanently"}
        </button>
        <button onClick={onCancel} className="rounded-xl border border-nebula-700 px-4 py-2 text-sm text-stardust-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function CoparentingBoard({ childId, childName }: { childId: string; childName: string }) {
  const BASE = `/api/v1/children/${childId}/coparenting/log`;
  const [log, setLog] = useState<{ mine: CoparentingEntry[]; theirs: CoparentingEntry[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<Tab>("mine");
  const [forming, setForming] = useState(false);
  const [correcting, setCorrecting] = useState<CoparentingEntry | null>(null);
  const [justLogged, setJustLogged] = useState(false);
  const [whatOpen, setWhatOpen] = useState(false);
  const [messagingWhy, setMessagingWhy] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const load = async () => {
    setError(null);
    setForbidden(false);
    try {
      const data = await api<{
        mine: CoparentingEntry[];
        theirs: CoparentingEntry[];
        launch_mode: string;
        review_pending: boolean;
      }>(BASE);
      setLog({ mine: data.mine, theirs: data.theirs });
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

  const travelRules = useMemo(() => {
    const refs = new Set<string>();
    for (const e of [...(log?.mine ?? []), ...(log?.theirs ?? [])]) {
      if (e.custody_order_ref) refs.add(e.custody_order_ref);
    }
    return [...refs];
  }, [log]);

  const sharedLog = useMemo(() => {
    const all = [...(log?.mine ?? []), ...(log?.theirs ?? [])];
    return all
      .filter((e) => (typeFilter === "all" ? true : e.entry_type === typeFilter))
      .filter((e) =>
        monthFilter === "all" ? true : e.created_at.slice(0, 7) === monthFilter,
      )
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [log, typeFilter, monthFilter]);

  const months = useMemo(() => {
    const s = new Set<string>();
    for (const e of [...(log?.mine ?? []), ...(log?.theirs ?? [])]) s.add(e.created_at.slice(0, 7));
    return [...s].sort().reverse();
  }, [log]);

  const scheduleChanges = useMemo(
    () => (log?.mine ?? []).filter((e) => e.entry_type === "schedule").length,
    [log],
  );

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="🏠 Home" icon="🤝" title="Co-parenting" subtitle="Parallel parenting, kept clean." />
        <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
          <p className="text-sm text-stardust-300">
            Co-parenting logistics are for parents — sign in as a parent to open this space.
          </p>
        </div>
      </main>
    );
  }

  if (log == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error ? (
          <WarmError message={error} onRetry={load} />
        ) : (
          <p className="text-center text-sm text-stardust-300">Opening your space…</p>
        )}
      </main>
    );
  }

  const onSaved = (entry: CoparentingEntry) => {
    setLog((prev) =>
      prev ? { mine: [entry, ...prev.mine], theirs: prev.theirs } : prev,
    );
    setForming(false);
    setCorrecting(null);
    setJustLogged(true);
    window.setTimeout(() => setJustLogged(false), 6000);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <PageHeader
        eyebrow="🏠 Home"
        icon="🤝"
        title="Co-parenting"
        subtitle={`Your space for ${childName} — logistics only, kept clean.`}
      />

      <div className="mt-4">
        <AmberBanner
          icon="⏳"
          action={
            <button
              onClick={() => setWhatOpen(true)}
              className="text-xs text-nova-300 underline decoration-dotted underline-offset-4"
            >
              What&apos;s being reviewed? →
            </button>
          }
        >
          <span className="font-medium text-star-100">
            A family-law professional is reviewing this co-parenting setup.
          </span>
          <br />
          Everything below — your entries, the shared log, the teen guides — is saved and working.
          After review, we may add more entry types.
        </AmberBanner>
      </div>

      <button
        onClick={() => setTravelOpen((o) => !o)}
        aria-expanded={travelOpen}
        className="mt-4 flex w-full items-center justify-between rounded-2xl border border-nebula-700 bg-nebula-900/70 px-4 py-3 text-left"
      >
        <span className="text-sm text-stardust-200">
          🧭 Travel rules on file:{" "}
          {travelRules.length > 0 ? (
            <span className="text-stardust-100">{travelRules.join("; ")}</span>
          ) : (
            <span className="text-stardust-500">none yet — they&apos;ll show here when added to an entry</span>
          )}
        </span>
        <span aria-hidden="true" className={`text-nova-300 transition-transform ${travelOpen ? "rotate-180" : ""}`}>▾</span>
      </button>
      {travelOpen && (
        <p className="mt-2 px-1 text-xs leading-relaxed text-stardust-400">
          Travel rules come from your custody profile and are read-only here. Pookie doesn&apos;t
          adjudicate disputes — if a pickup conflicts with your rules, talk to your co-parent
          or your lawyer, and log what was decided.
        </p>
      )}

      {error && (
        <div className="mt-4">
          <WarmError message={error} onRetry={load} />
        </div>
      )}

      {/* tabs */}
      <div className="mt-6 flex gap-2" role="tablist" aria-label="Co-parenting views">
        {(
          [
            { key: "mine", label: "My logistics" },
            { key: "log", label: "Shared log" },
            { key: "teen", label: "Teen lens" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-nova-500 bg-nova-500/15 text-star-100 shadow-glow-sm"
                : "border-nebula-700 text-stardust-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mine" && (
        <div className="mt-4">
          {justLogged && (
            <p className="animate-rise mb-3 rounded-xl border border-nova-500/40 bg-nebula-900/80 p-3 text-sm text-nova-200">
              Logged. Entries can&apos;t be edited or deleted — that&apos;s what makes the log trustworthy.
            </p>
          )}
          {!forming ? (
            <button
              onClick={() => {
                setCorrecting(null);
                setForming(true);
              }}
              className="btn-dapple w-full rounded-2xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
            >
              ➕ Log an entry
            </button>
          ) : (
            <EntryForm
              childId={childId}
              childName={childName}
              correcting={correcting}
              onSaved={onSaved}
              onCancel={() => {
                setForming(false);
                setCorrecting(null);
              }}
            />
          )}
          <div className="mt-4 space-y-3">
            {log.mine.length === 0 && (
              <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
                <p className="text-sm text-stardust-300">
                  No entries yet. Log your first pickup — the shared log starts with you.
                </p>
              </div>
            )}
            {log.mine.map((e) => (
              <EntryCard
                key={e.id}
                entry={e}
                mine
                onCorrect={() => {
                  setCorrecting(e);
                  setForming(true);
                }}
              />
            ))}
          </div>

          {/* the designed absence */}
          <button
            onClick={() => setMessagingWhy((o) => !o)}
            aria-expanded={messagingWhy}
            className="mt-6 flex w-full items-center justify-between rounded-2xl border border-nebula-700 bg-nebula-950/70 px-4 py-3 text-left"
          >
            <span className="text-sm text-stardust-300">Why no messaging?</span>
            <span aria-hidden="true" className={`text-nova-300 transition-transform ${messagingWhy ? "rotate-180" : ""}`}>▾</span>
          </button>
          {messagingWhy && (
            <div className="animate-rise mt-2 rounded-2xl border border-nebula-700 bg-nebula-950/70 p-4">
              <p className="text-sm font-medium text-star-100">There&apos;s no messaging here — on purpose.</p>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                Messages become screenshots. Screenshots become court exhibits. This space keeps
                logistics clean and documented instead.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                Need to say something? Put the logistics in the log. The rest can wait.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === "log" && (
        <div className="mt-4">
          <ImmutableBanner>
            <span className="font-medium text-stardust-100">This log can&apos;t be edited.</span>
            <br />
            Entries are permanent once saved — for both parents. That&apos;s what makes it trustworthy.
          </ImmutableBanner>

          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by type"
              className="rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-1.5 text-xs text-stardust-200"
            >
              <option value="all">All types</option>
              {(Object.keys(TYPE_META) as CoparentingEntryType[]).map((t) => (
                <option key={t} value={t}>{TYPE_META[t].label}</option>
              ))}
            </select>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              aria-label="Filter by month"
              className="rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-1.5 text-xs text-stardust-200"
            >
              <option value="all">All months</option>
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="ml-auto rounded-lg border border-nebula-700 px-3 py-1.5 text-xs text-stardust-300 hover:border-nova-500"
            >
              📄 Download the log (PDF)
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {sharedLog.length === 0 && (
              <p className="rounded-2xl border border-nebula-700 bg-nebula-950/60 p-6 text-center text-sm text-stardust-400">
                Nothing here yet. Entries appear here once logged — permanently.
              </p>
            )}
            {sharedLog.map((e) => (
              <EntryCard key={e.id} entry={e} mine={false} />
            ))}
          </div>
        </div>
      )}

      {tab === "teen" && (
        <div className="mt-4 space-y-3">
          <TeenGuide title="What parallel parenting means for your teen">
            Two homes, one team — but the team talks through a log, not through you. You never
            have to carry messages, pick sides, or remember who said what. That&apos;s the grown-ups&apos; job.
          </TeenGuide>
          <TeenGuide title="The no-messenger rule, explained">
            There&apos;s no chat between your parents in Pookie — on purpose. Fewer heated messages
            means calmer handoffs, and calmer handoffs mean better weekends.
          </TeenGuide>
          <TeenGuide title="Patterns that help: consistency, no quizzing">
            Teens do best with predictable rhythms. If plans change a lot, it&apos;s okay to say
            so — to either parent, directly. You don&apos;t have to report on the other household.
          </TeenGuide>
          {scheduleChanges >= 3 && (
            <div className="rounded-2xl border border-aurum-400/40 bg-nebula-900/80 p-4">
              <p className="text-sm text-stardust-200">
                You&apos;ve logged {scheduleChanges} schedule changes recently — teens do best with
                predictable rhythms.
              </p>
              <p className="mt-1 text-xs text-stardust-400">
                Private to you — this note never appears on the other parent&apos;s screen.
              </p>
            </div>
          )}
        </div>
      )}

      <BottomSheet open={whatOpen} onClose={() => setWhatOpen(false)} title="What's being reviewed?">
        <div className="px-1 pb-6 text-sm leading-relaxed text-stardust-300">
          <p>
            A family lawyer is checking that this setup is safe and fair for high-conflict
            situations — the entry types, the immutable log, and the no-messaging design.
          </p>
          <p className="mt-3">
            Everything here keeps working. After review, we may add more entry types —
            never a message thread.
          </p>
        </div>
      </BottomSheet>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* immutable entry card — flat, locked, no actions                     */
/* ------------------------------------------------------------------ */

function EntryCard({
  entry,
  mine,
  onCorrect,
}: {
  entry: CoparentingEntry;
  mine: boolean;
  onCorrect?: () => void;
}) {
  const meta = TYPE_META[entry.entry_type];
  return (
    <ImmutableCard>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-stardust-100">
          <span aria-hidden="true" className="mr-1.5">{meta.icon}</span>
          {meta.label}
          {entry.expense_amount != null && ` · $${Number(entry.expense_amount).toFixed(2)}`}
          {entry.occurs_at && ` · ${fmtDateTime(entry.occurs_at)}`}
        </p>
        <span aria-hidden="true" title="Locked — cannot be edited or deleted" className="text-stardust-500">🔒</span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-stardust-300">{entry.content}</p>
      <p className="mt-2 text-[11px] text-stardust-500">
        Logged by {mine ? "you" : "the other parent"} · {fmtDateTime(entry.created_at)}
        {entry.corrects_entry_id && " · corrects an earlier entry"}
      </p>
      <p className="mt-1 text-[11px] text-stardust-600">no edit · no delete · no reply</p>
      {mine && onCorrect && (
        <button
          onClick={onCorrect}
          className="mt-2 text-xs text-nova-300 underline decoration-dotted underline-offset-4"
        >
          Log a correction
        </button>
      )}
    </ImmutableCard>
  );
}

function TeenGuide({ title, children }: { title: string; children: React.ReactNode }) {
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
      {open && (
        <div className="border-t border-nebula-700/60 px-4 py-3 text-sm leading-relaxed text-stardust-300">
          {children}
        </div>
      )}
    </div>
  );
}
