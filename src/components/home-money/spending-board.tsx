// W11 Spending — the privacy promise is the product.
// Teen view: full line items + "totals, not line items" banner + a parity
// screen showing exactly what the parent sees. Parent view: household detail
// plus a locked aggregate card for teen-private spending — computed as
// (household summary totals − parent-visible line items), the only two
// sanctioned endpoints, so both sides always agree. Manual entry and CSV
// import are the fully-working primary paths; Plaid is a real integration
// seam that degrades honestly to UPSTREAM_UNAVAILABLE.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { Transaction } from "@/server/services/spending";
import {
  ApiError,
  api,
  fmtDate,
  fmtMoney,
  InfoBanner,
  Masked4,
  PageHeader,
  WarmError,
} from "@/components/home-money/shared";

const BASE = "/api/v1/household/spending";

interface SummaryCategory {
  category: string;
  outflow: number | string;
  count: number | string;
}
interface SummaryMonth {
  month: string;
  outflow: number | string;
  count: number | string;
}
interface Summary {
  total_outflow: number | string;
  total_inflow: number | string;
  transaction_count: number | string;
  teen_private_count: number | string;
  by_category: SummaryCategory[];
  by_month: SummaryMonth[];
}

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

function monthRange(offset: number): { from: string; to: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${last}`;
  const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return { from, to, label };
}

/* ------------------------------------------------------------------ */
/* the locked teen-aggregate card — ONE component, both views (parity) */
/* ------------------------------------------------------------------ */

function TeenAggregateCard({
  teenName,
  total,
  whyOpen,
  setWhyOpen,
}: {
  teenName: string;
  total: number;
  whyOpen: boolean;
  setWhyOpen: (v: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-nebula-700 bg-nebula-950/80 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-stardust-200">
          🔒 {teenName}&apos;s spending
        </p>
        <p className="text-lg font-bold text-star-100">{fmtMoney(total)}</p>
      </div>
      <p className="mt-1 text-xs text-stardust-400">
        Total only — line items are private to {teenName}.
      </p>
      <button
        onClick={() => setWhyOpen(true)}
        className="mt-2 text-xs text-nova-300 underline decoration-dotted underline-offset-4"
      >
        Why?
      </button>
      <BottomSheet open={whyOpen} onClose={() => setWhyOpen(false)} title="Why totals, not line items?">
        <div className="px-1 pb-6 text-sm leading-relaxed text-stardust-300">
          <p>
            {teenName}&apos;s line items are private to {teenName.toLowerCase() === "you" ? "you" : "them"}.
            You see the monthly total and category totals so the household budget stays honest —
            but never where they shopped or what they bought.
          </p>
          <p className="mt-3">
            If you need detail — say, for a shared expense — ask {teenName === "you" ? "your parent" : "them"}.
            {teenName !== "you" && " They can share any receipt one by one from their view."}
          </p>
          <p className="mt-3 text-xs text-stardust-500">
            The same numbers appear here and on the other side — if they ever disagree, that&apos;s a bug.
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* add-transaction form (manual entry — the primary path)               */
/* ------------------------------------------------------------------ */

function AddForm({
  isTeen,
  onAdded,
}: {
  isTeen: boolean;
  onAdded: (t: Transaction) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [bank, setBank] = useState("");
  const [last4, setLast4] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPrivate, setIsPrivate] = useState(isTeen); // teen-private by default for teens
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt === 0) {
      setErr("Enter an amount — positive for money out, negative for money in.");
      return;
    }
    if (last4 && !/^\d{4}$/.test(last4)) {
      setErr("The account field takes the last 4 digits only — never the full number.");
      return;
    }
    setBusy(true);
    try {
      const accountRef = bank.trim()
        ? `${bank.trim()} …${last4 || "····"}`
        : "Cash";
      const data = await api<{ transaction: Transaction }>(`${BASE}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          account_ref: accountRef,
          amount: amt,
          merchant: merchant.trim() || undefined,
          category: category.trim() || undefined,
          is_teen_private: isPrivate,
          posted_date: date || undefined,
        }),
      });
      onAdded(data.transaction);
      setAmount("");
      setMerchant("");
      setCategory("");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-dapple w-full rounded-2xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
      >
        ➕ Add spending manually
      </button>
    );
  }
  return (
    <div className="animate-rise rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
      <p className="text-sm font-semibold text-star-100">Add spending</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-stardust-300">
          Amount
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="12.85" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Date
          <input value={date} onChange={(e) => setDate(e.target.value)} type="date" className={`${inputCls} mt-1`} />
        </label>
      </div>
      <label className="mt-2 block text-xs font-medium text-stardust-300">
        Where
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Starbrew" className={`${inputCls} mt-1`} />
      </label>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <label className="block text-xs font-medium text-stardust-300">
          Category <span className="text-stardust-500">(auto)</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Bank
          <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Chase" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Last 4
          <input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="4821" inputMode="numeric" maxLength={4} className={`${inputCls} mt-1`} />
        </label>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-stardust-300">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="h-4 w-4 accent-emerald-400"
        />
        {isTeen
          ? "Keep the details private from my parents (totals still show up)"
          : "Mark as teen-private (hidden from my line-item view too)"}
      </label>
      {err && <p className="mt-2 text-xs text-aurum-200">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="btn-dapple flex-1 rounded-xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-nebula-700 px-4 py-2 text-sm text-stardust-300">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV import                                                          */
/* ------------------------------------------------------------------ */

function CsvImport({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [accountRef, setAccountRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ parsed: number; imported: number; skipped: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setResult(null);
    if (csv.length > 2 * 1024 * 1024) {
      setErr("That file is over the 2 MB limit — try a smaller export.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ parsed: number; imported: number; skipped: number }>(
        `${BASE}/csv-import`,
        {
          method: "POST",
          body: JSON.stringify({ csv, account_ref: accountRef.trim() || "CSV import" }),
        },
      );
      setResult(data);
      onImported();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
      >
        📄 Import a CSV
      </button>
    );
  }
  return (
    <div className="animate-rise rounded-2xl border border-nebula-700 bg-nebula-900/80 p-4">
      <p className="text-sm font-semibold text-star-100">Import a CSV</p>
      <p className="mt-0.5 text-xs text-stardust-400">
        Paste your bank&apos;s CSV export — headers are detected automatically, duplicates skipped.
      </p>
      <label className="mt-3 block text-xs font-medium text-stardust-300">
        Account label
        <input value={accountRef} onChange={(e) => setAccountRef(e.target.value)} placeholder="Chase checking" className={`${inputCls} mt-1`} />
      </label>
      <label className="mt-2 block text-xs font-medium text-stardust-300">
        CSV text
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={6}
          placeholder={"date,merchant,amount\n2026-10-11,Starbrew,6.40"}
          className={`${inputCls} mt-1 font-mono`}
        />
      </label>
      {err && <p className="mt-2 text-xs text-aurum-200">{err}</p>}
      {result && (
        <p className="mt-2 text-xs text-nova-300">
          Parsed {result.parsed} · imported {result.imported} · skipped {result.skipped} duplicates.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={submit}
          disabled={busy || !csv.trim()}
          className="btn-dapple flex-1 rounded-xl px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded-xl border border-nebula-700 px-4 py-2 text-sm text-stardust-300">
          Close
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Plaid connect — real seam, honest degradation                        */
/* ------------------------------------------------------------------ */

function PlaidConnect({ onSynced }: { onSynced: () => void }) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "working" }
    | { status: "unavailable" }
    | { status: "error"; message: string }
    | { status: "done"; institution: string; accounts: number }
  >({ status: "idle" });

  const loadScript = () =>
    new Promise<void>((resolve, reject) => {
      if ((window as unknown as { Plaid?: unknown }).Plaid) return resolve();
      const s = document.createElement("script");
      s.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Plaid script failed to load"));
      document.head.appendChild(s);
    });

  const connect = async () => {
    setState({ status: "working" });
    try {
      const { link_token } = await api<{ link_token: string; expiration: string }>(
        `${BASE}/plaid/link-token`,
        { method: "POST", body: "{}" },
      );
      await loadScript();
      const Plaid = (window as unknown as { Plaid: { create: (o: Record<string, unknown>) => { open: () => void } } }).Plaid;
      const handler = Plaid.create({
        token: link_token,
        onSuccess: async (public_token: string) => {
          try {
            const ex = await api<{ plaid_item_id: string; institution_name: string; accounts: { name: string; account_ref: string }[] }>(
              `${BASE}/plaid/exchange`,
              { method: "POST", body: JSON.stringify({ public_token }) },
            );
            await api(`${BASE}/plaid/sync`, { method: "POST", body: "{}" });
            setState({ status: "done", institution: ex.institution_name, accounts: ex.accounts.length });
            onSynced();
          } catch (e) {
            setState({ status: "error", message: e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment." });
          }
        },
        onExit: () => setState({ status: "idle" }),
      });
      handler.open();
    } catch (e) {
      if (e instanceof ApiError && e.code === "UPSTREAM_UNAVAILABLE") {
        setState({ status: "unavailable" });
      } else {
        setState({ status: "error", message: e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment." });
      }
    }
  };

  if (state.status === "unavailable") {
    return (
      <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-4">
        <p className="text-sm font-medium text-stardust-200">🏦 Bank sync isn&apos;t available right now</p>
        <p className="mt-1 text-xs leading-relaxed text-stardust-400">
          The bank connection needs setup on our side — nothing is wrong with your accounts.
          Add spending manually or import a CSV; everything works the same once sync is on.
        </p>
      </div>
    );
  }
  if (state.status === "done") {
    return (
      <div className="rounded-2xl border border-nova-500/40 bg-nebula-900/80 p-4 shadow-glow-sm">
        <p className="text-sm font-medium text-star-100">✓ Connected — {state.institution}</p>
        <p className="mt-0.5 text-xs text-stardust-400">
          {state.accounts} account{state.accounts === 1 ? "" : "s"} syncing. New transactions land masked, like everything else.
        </p>
      </div>
    );
  }
  return (
    <div>
      <button
        onClick={connect}
        disabled={state.status === "working"}
        className="w-full rounded-2xl border border-nova-600/50 px-5 py-2.5 text-sm font-semibold text-nova-300 hover:bg-nova-600/15 disabled:opacity-50"
      >
        {state.status === "working" ? "Connecting…" : "🏦 Connect a bank account"}
      </button>
      {state.status === "error" && (
        <p className="mt-2 text-xs text-aurum-200">{state.message}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function SpendingBoard() {
  const [role, setRole] = useState<"parent" | "teen" | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [teenName, setTeenName] = useState("Your teen");
  const [monthOffset, setMonthOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);
  const [parityOpen, setParityOpen] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const range = monthRange(monthOffset);

  const load = useCallback(async () => {
    setError(null);
    try {
      // The summary route is parent-only; a teen gets PARENT_ROLE_REQUIRED —
      // that IS the role signal (server-enforced, never client-assumed).
      let nextSummary: Summary | null = null;
      let nextRole: "parent" | "teen" = "teen";
      try {
        const s = await api<{ summary: Summary }>(
          `${BASE}/summary?from=${range.from}&to=${range.to}`,
        );
        nextSummary = s.summary;
        nextRole = "parent";
      } catch (e) {
        if (!(e instanceof ApiError && e.code === "PARENT_ROLE_REQUIRED")) throw e;
      }
      const t = await api<{ transactions: Transaction[] }>(
        `${BASE}/transactions?from=${range.from}&to=${range.to}&limit=500`,
      );
      setRole(nextRole);
      setSummary(nextSummary);
      setTransactions(t.transactions);
      if (nextRole === "parent") {
        // First name for the aggregate card (label only — never detail).
        const kids = await api<{ children: { firstName: string; nickname: string | null }[] }>(
          "/api/v1/children",
        ).catch(() => null);
        const first = kids?.children?.[0];
        if (first) setTeenName(first.nickname ?? first.firstName);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    }
  }, [range.from, range.to]);

  useEffect(() => {
    load();
  }, [load]);

  const onAdded = (t: Transaction) => {
    setTransactions((prev) => (prev ? [t, ...prev] : [t]));
    load();
  };

  /** Teen-private slice: household summary totals minus parent-visible line
   *  items — the only two sanctioned endpoints, so both sides always agree. */
  const teenSlice = useMemo(() => {
    if (role !== "parent" || !summary || !transactions) return 0;
    const visibleOut = transactions.reduce(
      (s, t) => s + (t.amount > 0 ? t.amount : 0),
      0,
    );
    return Math.max(0, Number(summary.total_outflow) - visibleOut);
  }, [role, summary, transactions]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; items: Transaction[] }>();
    for (const t of transactions ?? []) {
      const cat = t.category_override ?? t.category ?? "uncategorized";
      const e = map.get(cat) ?? { total: 0, items: [] };
      e.total += t.amount > 0 ? t.amount : 0;
      e.items.push(t);
      map.set(cat, e);
    }
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [transactions]);

  const teenTotal = useMemo(
    () => (transactions ?? []).reduce((s, t) => s + (t.amount > 0 ? t.amount : 0), 0),
    [transactions],
  );

  if (role == null || transactions == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error ? (
          <WarmError message={error} onRetry={load} />
        ) : (
          <p className="text-center text-sm text-stardust-300">Adding it all up…</p>
        )}
      </main>
    );
  }

  const header = (
    <div className="flex items-center justify-between">
      <PageHeader
        eyebrow="🏠 Home"
        icon="💸"
        title={role === "teen" ? "Your spending" : "Household spending"}
        subtitle={role === "teen" ? "Your money, your detail." : "Patterns, not judgment."}
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          aria-label="Previous month"
          className="rounded-lg border border-nebula-700 px-2 py-1 text-stardust-300 hover:border-nova-500"
        >
          ‹
        </button>
        <span className="text-xs font-medium text-stardust-300">{range.label}</span>
        <button
          onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
          disabled={monthOffset >= 0}
          aria-label="Next month"
          className="rounded-lg border border-nebula-700 px-2 py-1 text-stardust-300 hover:border-nova-500 disabled:opacity-40"
        >
          ›
        </button>
      </div>
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {header}
      {error && (
        <div className="mt-4">
          <WarmError message={error} onRetry={load} />
        </div>
      )}

      {role === "teen" ? (
        <>
          <div className="mt-4">
            <InfoBanner icon="🔒">
              <span className="font-medium text-star-100">
                Your parents see totals, not your line items.
              </span>
              <br />
              They see: {range.label} total · {fmtMoney(teenTotal)}
              <br />
              They DON&apos;T see: where you shopped or what you bought. That&apos;s just yours.
              <br />
              <button
                onClick={() => setParityOpen(true)}
                className="mt-2 text-nova-300 underline decoration-dotted underline-offset-4"
              >
                See exactly what they see →
              </button>
            </InfoBanner>
          </div>

          <div className="mt-6 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-wide text-nova-300 capitalize">{range.label}</h2>
            <p className="text-xl font-bold text-star-100">{fmtMoney(teenTotal)}</p>
          </div>

          <div className="mt-3 space-y-2">
            {byCategory.map(([cat, e]) => (
              <div key={cat} className="rounded-2xl border border-nova-600/25 bg-nebula-900/80">
                <button
                  onClick={() => setExpandedCat((c) => (c === cat ? null : cat))}
                  aria-expanded={expandedCat === cat}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-medium text-stardust-100 capitalize">☕ {cat}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-star-100">{fmtMoney(e.total)}</span>
                    <span aria-hidden="true" className={`text-nova-300 transition-transform ${expandedCat === cat ? "rotate-180" : ""}`}>▾</span>
                  </span>
                </button>
                {expandedCat === cat && (
                  <ul className="space-y-1 border-t border-nebula-700/60 px-4 py-3">
                    {e.items.map((t) => (
                      <li key={t.id} className="flex items-center justify-between text-sm">
                        <span className="text-stardust-300">
                          {t.merchant ?? "—"} · {fmtDate(t.posted_date)}
                          {t.is_teen_private && <span className="ml-1 text-[10px] text-nova-300">🔒</span>}
                        </span>
                        <span className="font-medium text-star-100">{fmtMoney(t.amount)}</span>
                      </li>
                    ))}
                    <li className="pt-1 text-[11px] text-stardust-500">Full line items — yours only.</li>
                  </ul>
                )}
              </div>
            ))}
            {byCategory.length === 0 && (
              <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
                <p className="text-sm text-stardust-300">
                  Nothing here yet. Connect an account or add spending manually — your line items stay yours.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <AddForm isTeen onAdded={onAdded} />
            <CsvImport onImported={load} />
          </div>

          {/* the parity screen — the literal parent aggregate card */}
          <BottomSheet open={parityOpen} onClose={() => setParityOpen(false)} title="What your parents see">
            <div className="space-y-4 px-1 pb-6">
              <p className="text-xs text-stardust-400">
                This is the exact card your parents see — same numbers, same data.
              </p>
              <TeenAggregateCard teenName="you" total={teenTotal} whyOpen={whyOpen} setWhyOpen={setWhyOpen} />
              <p className="text-xs text-stardust-500">
                Account references always show last-4 only, on both sides.
              </p>
            </div>
          </BottomSheet>
        </>
      ) : (
        <>
          {summary && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-nova-600/25 bg-nebula-900/80 p-3">
                <p className="text-[11px] tracking-wide text-stardust-400 capitalize">Out</p>
                <p className="text-sunlit text-lg font-bold">{fmtMoney(summary.total_outflow)}</p>
              </div>
              <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-3">
                <p className="text-[11px] tracking-wide text-stardust-400 capitalize">In</p>
                <p className="text-lg font-bold text-star-100">{fmtMoney(summary.total_inflow)}</p>
              </div>
              <div className="rounded-2xl border border-nebula-700 bg-nebula-900/70 p-3">
                <p className="text-[11px] tracking-wide text-stardust-400 capitalize">Transactions</p>
                <p className="text-lg font-bold text-star-100">{String(summary.transaction_count)}</p>
              </div>
            </div>
          )}

          <div className="mt-4">
            <TeenAggregateCard teenName={teenName} total={teenSlice} whyOpen={whyOpen} setWhyOpen={setWhyOpen} />
          </div>

          {summary && summary.by_category.length > 0 && (
            <section className="mt-6" aria-label="Spending by category">
              <h2 className="text-sm font-semibold tracking-wide text-nova-300 capitalize">By category</h2>
              <div className="mt-2 space-y-1.5">
                {summary.by_category.map((c) => (
                  <div key={c.category} className="flex items-center justify-between rounded-xl border border-nebula-700/70 bg-nebula-900/60 px-3 py-2">
                    <span className="text-sm text-stardust-200 capitalize">{c.category}</span>
                    <span className="text-sm font-semibold text-star-100">{fmtMoney(c.outflow)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6" aria-label="Recent household transactions">
            <h2 className="text-sm font-semibold tracking-wide text-nova-300 capitalize">Recent household transactions</h2>
            <div className="mt-2 space-y-1.5">
              {transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl border border-nebula-700/70 bg-nebula-900/60 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stardust-100">{t.merchant ?? "—"}</p>
                    <p className="text-[11px] text-stardust-500">
                      {fmtDate(t.posted_date)} · <Masked4 last4={last4Of(t.account_ref)} />
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-star-100">{fmtMoney(t.amount)}</span>
                </div>
              ))}
              {transactions.length === 0 && (
                <p className="text-sm text-stardust-500">No household transactions this month.</p>
              )}
            </div>
          </section>

          <div className="mt-6 space-y-3">
            <AddForm isTeen={false} onAdded={onAdded} />
            <CsvImport onImported={load} />
            <PlaidConnect onSynced={load} />
          </div>
        </>
      )}
    </main>
  );
}

/** Pull the last-4 out of a masked ref like "Chase …4821". */
function last4Of(ref: string): string | null {
  const m = ref.match(/(\d{4})\s*$/);
  return m ? m[1] : null;
}
