// Phase1-Insurance — Insurance Policy Tracker ("the ship's shield status").
// Policy tracking + renewal alerts. Policy DOCUMENTS live in the document
// vault (home-money/vault-board); this module tracks dates, premiums, and
// renewals — the tracker, not the store.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  ApiError,
  api,
  daysUntil,
  fmtDate,
  fmtMoney,
  LoadVeil,
  PageHeader,
  QuietConfirm,
  WarmError,
} from "@/components/home-money/shared";
import type { InsurancePolicy, PolicyType } from "@/server/services/insurance";

const BASE = "/api/v1/household/insurance";

const TYPE_META: Record<PolicyType, { title: string; icon: string }> = {
  auto: { title: "Auto", icon: "🚗" },
  home: { title: "Home", icon: "🏠" },
  health: { title: "Health", icon: "🏥" },
  life: { title: "Life", icon: "🕊️" },
  renter: { title: "Renter", icon: "🔑" },
};

const TYPE_ORDER: PolicyType[] = ["auto", "home", "health", "life", "renter"];

const FREQ_LABEL: Record<string, string> = {
  monthly: "Per Month",
  quarterly: "Per Quarter",
  semiannual: "Twice Yearly",
  annual: "Per Year",
};

const FREQ_TO_MONTHLY: Record<string, number> = {
  monthly: 1,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  annual: 1 / 12,
};

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

type Urgency = "calm" | "watch" | "urgent" | "overdue" | "none";

function urgencyOf(p: InsurancePolicy): Urgency {
  const d = daysUntil(p.renewal_date);
  if (d === null) return "none";
  if (d < 0) return "overdue";
  if (d <= 30) return "urgent";
  if (d <= 60) return "watch";
  return "calm";
}

const URGENCY_PILL: Record<Urgency, string> = {
  calm: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  watch: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  urgent: "border-orange-400/50 bg-orange-400/10 text-orange-200",
  overdue: "border-rose-400/50 bg-rose-400/10 text-rose-200",
  none: "border-stardust-500/30 bg-stardust-500/10 text-stardust-300",
};

function countdownLabel(p: InsurancePolicy): string {
  const d = daysUntil(p.renewal_date);
  if (d === null) return "No Renewal Date";
  if (d < 0) return `Renewal Overdue By ${Math.abs(d)} Day${Math.abs(d) === 1 ? "" : "s"}`;
  if (d === 0) return "Renews Today";
  return `Renews In ${d} Day${d === 1 ? "" : "s"}`;
}

interface FormState {
  type: PolicyType;
  provider: string;
  policy_number: string;
  premium_amount: string;
  premium_frequency: string;
  renewal_date: string;
  coverage_summary: string;
  agent_name: string;
  agent_phone: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  type: "auto",
  provider: "",
  policy_number: "",
  premium_amount: "",
  premium_frequency: "annual",
  renewal_date: "",
  coverage_summary: "",
  agent_name: "",
  agent_phone: "",
  notes: "",
};

function toForm(p: InsurancePolicy): FormState {
  return {
    type: p.type,
    provider: p.provider,
    policy_number: p.policy_number === "••••" ? "" : (p.policy_number ?? ""),
    premium_amount: p.premium_amount ?? "",
    premium_frequency: p.premium_frequency,
    renewal_date: p.renewal_date ?? "",
    coverage_summary: p.coverage_summary ?? "",
    agent_name: p.agent_name ?? "",
    agent_phone: p.agent_phone ?? "",
    notes: p.notes ?? "",
  };
}

export function InsuranceHub() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<InsurancePolicy | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InsurancePolicy | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [billBusy, setBillBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ policies: InsurancePolicy[] }>(BASE);
      setPolicies(res.policies);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("load-failed", "The shield status could not be raised. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const monthly = policies.reduce((sum, p) => {
      const amt = Number(p.premium_amount ?? 0);
      return sum + amt * (FREQ_TO_MONTHLY[p.premium_frequency] ?? 1 / 12);
    }, 0);
    const renewalsSoon = policies.filter((p) => {
      const d = daysUntil(p.renewal_date);
      return d !== null && d >= 0 && d <= 30;
    }).length;
    const overdue = policies.filter((p) => {
      const d = daysUntil(p.renewal_date);
      return d !== null && d < 0;
    }).length;
    const types = new Set(policies.map((p) => p.type)).size;
    return { monthly, renewalsSoon, overdue, types };
  }, [policies]);

  const shieldState = useMemo(() => {
    if (stats.overdue > 0)
      return { tone: "rose", title: "Shield Breach", body: `${stats.overdue} Polic${stats.overdue === 1 ? "y Is" : "ies Are"} Past Renewal — Update Them Below.` };
    if (stats.renewalsSoon > 0)
      return { tone: "amber", title: "Shield Attention", body: `${stats.renewalsSoon} Renewal${stats.renewalsSoon === 1 ? " Is" : "s Are"} Due Within 30 Days.` };
    if (policies.length === 0)
      return { tone: "stardust", title: "Shield Offline", body: "Add Your First Policy To Bring The Shield Online." };
    return { tone: "emerald", title: "Shield Secure", body: "All Policies Are Current. Nothing Needs Your Attention." };
  }, [stats, policies.length]);

  const grouped = useMemo(() => {
    const map = new Map<PolicyType, InsurancePolicy[]>();
    for (const p of policies) {
      const arr = map.get(p.type) ?? [];
      arr.push(p);
      map.set(p.type, arr);
    }
    for (const arr of map.values())
      arr.sort((a, b) => (daysUntil(a.renewal_date) ?? 99999) - (daysUntil(b.renewal_date) ?? 99999));
    return map;
  }, [policies]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setSheetOpen(true);
  };

  const openEdit = (p: InsurancePolicy) => {
    setEditing(p);
    setForm(toForm(p));
    setFormError(null);
    setSheetOpen(true);
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.provider.trim()) {
      setFormError("Provider Is Required.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        type: form.type,
        provider: form.provider.trim(),
        policy_number: form.policy_number.trim() || undefined,
        premium_amount: form.premium_amount ? Number(form.premium_amount) : undefined,
        premium_frequency: form.premium_frequency,
        renewal_date: form.renewal_date || undefined,
        coverage_summary: form.coverage_summary.trim() || undefined,
        agent_name: form.agent_name.trim() || undefined,
        agent_phone: form.agent_phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await api(`${BASE}/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        await api(BASE, { method: "POST", body: JSON.stringify(payload) });
      }
      setSheetOpen(false);
      setNotice(editing ? "Policy Updated." : "Policy Added.");
      await reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "Save Failed. Try Again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api(`${BASE}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setNotice("Policy Removed.");
      await reload();
    } catch (e) {
      setNotice(e instanceof ApiError ? `Delete Failed: ${e.message}` : "Delete Failed.");
    } finally {
      setDeleting(false);
    }
  };

  // Straightforward Bills feed: premium renewal becomes an unpaid yearly bill.
  const addToBills = async (p: InsurancePolicy) => {
    setBillBusy(p.id);
    setNotice(null);
    try {
      await api("/api/v1/household/bills", {
        method: "POST",
        body: JSON.stringify({
          name: `${p.provider} ${TYPE_META[p.type].title} Insurance Renewal`,
          payee: p.provider,
          amount: p.premium_amount ? Number(p.premium_amount) : undefined,
          due_date: p.renewal_date ?? undefined,
          recurrence: "yearly",
          category: "insurance",
          status: "unpaid",
          notes: p.policy_number ? `Policy ${p.policy_number}` : undefined,
        }),
      });
      setNotice("Renewal Added To Bills.");
    } catch (e) {
      setNotice(e instanceof ApiError ? `Could Not Add To Bills: ${e.message}` : "Could Not Add To Bills.");
    } finally {
      setBillBusy(null);
    }
  };

  if (loading) return <LoadVeil label="Raising The Shield…" />;
  if (error)
    return (
      <WarmError
        message={`Shield Status Unavailable — ${error.message}`}
        onRetry={() => { void reload(); }}
      />
    );

  const shieldGlow =
    shieldState.tone === "rose"
      ? "from-rose-500/20"
      : shieldState.tone === "amber"
        ? "from-amber-400/20"
        : shieldState.tone === "emerald"
          ? "from-emerald-400/20"
          : "from-stardust-500/20";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-10 pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          eyebrow="Household · Protection"
          icon="🛡️"
          title="Insurance"
          subtitle="Your Ship's Shield Status — Every Policy, Renewal, And Agent In One Place."
        />
        <button
          onClick={openAdd}
          className="mt-1 rounded-xl bg-nova-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(139,92,246,0.35)] transition hover:bg-nova-400"
        >
          + Add Policy
        </button>
      </div>

      {notice && (
        <div className="rounded-xl border border-nova-500/40 bg-nova-500/10 px-4 py-2.5 text-sm text-stardust-100">
          {notice}
        </div>
      )}

      {/* Shield status banner */}
      <section className={`relative overflow-hidden rounded-2xl border border-nebula-700 bg-gradient-to-b ${shieldGlow} to-transparent p-5`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-3xl"
        />
        <div className="flex items-center gap-4">
          <div aria-hidden="true" className="h-14 w-14 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.9),rgba(167,139,250,0.55)_45%,rgba(76,29,149,0.25)_80%)] shadow-[0_0_30px_rgba(167,139,250,0.5)]" />
          <div>
            <h2 className="text-lg font-bold text-sunlit">{shieldState.title}</h2>
            <p className="text-sm text-stardust-300">{shieldState.body}</p>
          </div>
        </div>
      </section>

      {/* Coverage at a glance */}
      <section aria-label="Coverage At A Glance">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stardust-400">
          Coverage At A Glance
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Active Policies", value: String(policies.length) },
            { label: "Monthly Cost", value: fmtMoney(stats.monthly) },
            { label: "Renewals ≤ 30 Days", value: String(stats.renewalsSoon) },
            { label: "Coverage Types", value: `${stats.types} / 5` },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-nebula-700 bg-nebula-900/60 p-4"
            >
              <p className="text-xs text-stardust-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-sunlit">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {policies.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-nebula-600 bg-nebula-900/40 p-10 text-center">
          <div aria-hidden="true" className="mx-auto mb-4 h-12 w-12 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.85),rgba(167,139,250,0.5)_50%,transparent_80%)] shadow-[0_0_24px_rgba(167,139,250,0.4)]" />
          <h3 className="text-lg font-semibold text-sunlit">No Policies Tracked Yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-stardust-400">
            Add Auto, Home, Health, Life, Or Renter Policies To Start Renewal Countdowns And Never Miss A Payment.
          </p>
          <button
            onClick={openAdd}
            className="mt-4 rounded-xl bg-nova-500 px-5 py-2 text-sm font-semibold text-white hover:bg-nova-400"
          >
            Add Your First Policy
          </button>
        </section>
      ) : (
        TYPE_ORDER.map((type) => {
          const list = grouped.get(type);
          if (!list || list.length === 0) return null;
          return (
            <section key={type} aria-label={`${TYPE_META[type].title} Policies`}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stardust-400">
                <span aria-hidden="true" className="mr-1">{TYPE_META[type].icon}</span>
                {TYPE_META[type].title} · {list.length}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((p) => {
                  const u = urgencyOf(p);
                  return (
                    <article
                      key={p.id}
                      className="rounded-2xl border border-nebula-700 bg-nebula-900/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sunlit">{p.provider}</h3>
                          {p.policy_number && (
                            <p className="mt-0.5 text-xs text-stardust-400">Policy {p.policy_number}</p>
                          )}
                        </div>
                        <span
                          className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${URGENCY_PILL[u]}`}
                        >
                          {countdownLabel(p)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-stardust-400">Premium</p>
                          <p className="font-semibold text-stardust-100">
                            {p.premium_amount ? fmtMoney(p.premium_amount) : "—"}{" "}
                            <span className="text-xs font-normal text-stardust-400">
                              {FREQ_LABEL[p.premium_frequency]}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-stardust-400">Renews</p>
                          <p className="font-semibold text-stardust-100">
                            {p.renewal_date ? fmtDate(p.renewal_date) : "Not Set"}
                          </p>
                        </div>
                      </div>

                      {p.coverage_summary && (
                        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
                          {p.coverage_summary}
                        </p>
                      )}

                      {(p.agent_name || p.agent_phone) && (
                        <p className="mt-2 text-xs text-stardust-400">
                          👤 Agent: {p.agent_name ?? "—"}
                          {p.agent_phone ? ` · ${p.agent_phone}` : ""}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-nebula-800 pt-3">
                        <button
                          onClick={() => openEdit(p)}
                          className="rounded-lg border border-nebula-600 px-3 py-1.5 text-xs font-medium text-stardust-200 hover:border-nova-500"
                        >
                          Edit
                        </button>
                        {p.renewal_date && (
                          <button
                            onClick={() => void addToBills(p)}
                            disabled={billBusy === p.id}
                            className="rounded-lg border border-nebula-600 px-3 py-1.5 text-xs font-medium text-stardust-200 hover:border-nova-500 disabled:opacity-50"
                          >
                            {billBusy === p.id ? "Adding…" : "Remind In Bills"}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/10"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* Vault link — documents live in the vault, the tracker is here */}
      <section>
        <Link
          href="/household/vault"
          className="flex items-center justify-between gap-3 rounded-2xl border border-nebula-700 bg-nebula-900/60 p-4 transition hover:border-nova-500"
        >
          <div>
            <h3 className="font-semibold text-sunlit">📁 Policy Documents In The Vault</h3>
            <p className="mt-0.5 text-sm text-stardust-400">
              Your Policy PDFs Live In The Document Vault (IDs & Insurance Section).
            </p>
          </div>
          <span aria-hidden="true" className="text-xl text-nova-300">→</span>
        </Link>
      </section>

      {/* Add/Edit sheet */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? "Edit Policy" : "Add Policy"}
      >
        <div className="space-y-3 px-1 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Type</span>
              <select value={form.type} onChange={(e) => set("type", e.target.value as PolicyType)} className={inputCls}>
                {TYPE_ORDER.map((t) => (
                  <option key={t} value={t}>{TYPE_META[t].title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Provider *</span>
              <input
                value={form.provider}
                onChange={(e) => set("provider", e.target.value)}
                placeholder="E.g. State Farm"
                className={inputCls}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-stardust-400">
              Policy Number <span className="text-stardust-500">(Stored Masked — Last 4 Digits Only)</span>
            </span>
            <input
              value={form.policy_number}
              onChange={(e) => set("policy_number", e.target.value)}
              placeholder="••••1234"
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Premium Amount</span>
              <input
                value={form.premium_amount}
                onChange={(e) => set("premium_amount", e.target.value)}
                placeholder="0.00"
                inputMode="decimal"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Frequency</span>
              <select value={form.premium_frequency} onChange={(e) => set("premium_frequency", e.target.value)} className={inputCls}>
                {Object.keys(FREQ_LABEL).map((f) => (
                  <option key={f} value={f}>{FREQ_LABEL[f]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-stardust-400">Renewal Date</span>
            <input
              type="date"
              value={form.renewal_date}
              onChange={(e) => set("renewal_date", e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-stardust-400">Coverage Summary</span>
            <textarea
              value={form.coverage_summary}
              onChange={(e) => set("coverage_summary", e.target.value)}
              placeholder="Key Coverage Details, Deductibles, Limits…"
              rows={3}
              className={inputCls}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Agent Name</span>
              <input value={form.agent_name} onChange={(e) => set("agent_name", e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-stardust-400">Agent Phone</span>
              <input value={form.agent_phone} onChange={(e) => set("agent_phone", e.target.value)} placeholder="(555) 123-4567" className={inputCls} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-stardust-400">Notes</span>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className={inputCls} />
          </label>
          {formError && <p className="text-sm text-rose-300">{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => void save()}
              disabled={saving}
              className="flex-1 rounded-xl bg-nova-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-nova-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Policy"}
            </button>
            <button
              onClick={() => setSheetOpen(false)}
              className="rounded-xl border border-nebula-600 px-4 py-2.5 text-sm text-stardust-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>

      <QuietConfirm
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Policy"
        body={`Remove ${deleteTarget?.provider} (${deleteTarget ? TYPE_META[deleteTarget.type].title : ""}) From Your Tracker? This Cannot Be Undone.`}
        confirmLabel="Remove"
        onConfirm={() => void confirmDelete()}
        busy={deleting}
        danger
      />
    </div>
  );
}
