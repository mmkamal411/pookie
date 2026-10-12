"use client";

// Bill Tracker — bills with amounts, due dates, paid status (Squad Value).
// Mobile-first. Restores the d-dash Command Center bills feature.

import { useCallback, useEffect, useState } from "react";
import type { Bill } from "@/server/services/bills";
import { ApiError, LoadVeil } from "@/components/home-money/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error?.code ?? "INTERNAL", json.error?.message ?? "Something went wrong.");
  return json.data as T;
}

const BASE = "/api/v1/household/bills";

function fmtAmount(b: Bill): string {
  if (b.amount == null) return "—";
  return `$${Number(b.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntil(due: string | null): number | null {
  if (!due) return null;
  const today = new Date().toISOString().slice(0, 10);
  return Math.round((new Date(due + "T12:00:00").getTime() - new Date(today + "T12:00:00").getTime()) / 864e5);
}

export function BillBoard({ compact = false }: { compact?: boolean }) {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { bills } = await api<{ bills: Bill[] }>(BASE);
      setBills(bills);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load bills.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await api(BASE, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          amount: amount ? parseFloat(amount) : undefined,
          due_date: dueDate || undefined,
        }),
      });
      setName(""); setAmount(""); setDueDate("");
      setShowAdd(false);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save the bill.");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (bill: Bill) => {
    setBills((bs) => bs.map((b) => (b.id === bill.id ? { ...b, status: "paid" as Bill["status"] } : b)));
    try {
      await api(`${BASE}/${bill.id}`, { method: "PATCH", body: JSON.stringify({ status: "paid" }) });
      load();
    } catch { load(); }
  };

  const unpaid = bills.filter((b) => b.status === "unpaid" || b.status === "overdue");
  const totalDue = unpaid.reduce((s, b) => s + (b.amount ? Number(b.amount) : 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-nova-300">
          Bills
          {unpaid.length > 0 && (
            <span className="ml-2 rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300">
              {unpaid.length} unpaid · ${totalDue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </h2>
      </div>

      {loading ? (
        <LoadVeil label="Loading bills" />
      ) : error ? (
        <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
      ) : (
        <div className="space-y-2">
          {bills.length === 0 ? (
            <div className="glass-pane p-4 text-center">
              <p className="text-sm text-stardust-300">No bills tracked yet.</p>
              <p className="mt-1 text-xs text-stardust-500">Add your first bill below — never miss a due date again.</p>
            </div>
          ) : (
            bills.slice(0, compact ? 5 : undefined).map((b) => {
              const d = daysUntil(b.due_date);
              const urgent = d != null && d <= 2 && b.status !== "paid";
              const paid = b.status === "paid";
              return (
                <div key={b.id} className={`glass-pane flex items-center gap-3 p-3 ${paid ? "opacity-50" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium text-stardust-100 ${paid ? "line-through" : ""}`}>
                      {b.name}
                    </p>
                    <p className="mt-0.5 text-xs text-stardust-400">
                      {fmtAmount(b)}
                      {b.due_date && (
                        <span className={urgent ? "text-amber-300" : ""}>
                          {" · "}{d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : d != null && d > 0 ? `Due in ${d}d` : d != null ? `${Math.abs(d)}d overdue` : ""}
                        </span>
                      )}
                      {b.status === "autopay" && <span className="text-emerald-300"> · Autopay</span>}
                    </p>
                  </div>
                  {!paid ? (
                    <button
                      onClick={() => markPaid(b)}
                      className="shrink-0 rounded-lg bg-nova-600 px-3 py-1.5 text-xs font-medium text-white"
                    >
                      Mark paid
                    </button>
                  ) : (
                    <span className="shrink-0 text-xs text-emerald-300">✓ Paid</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {showAdd ? (
        <div className="glass-pane space-y-2.5 p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bill name — e.g. Electric"
            autoFocus
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="84.12"
              inputMode="decimal"
              className="flex-1 rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
            />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded-lg border border-nebula-700 bg-nebula-950 px-2 py-2 text-xs text-stardust-200 focus:border-nova-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || saving}
              className="flex-1 rounded-lg bg-nova-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Adding…" : "Add bill"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-lg border border-nebula-700 px-3 py-2 text-sm text-stardust-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full rounded-lg border border-dashed border-nebula-600 p-3 text-sm text-stardust-300 hover:border-nova-500 hover:text-nova-300"
        >
          + Add a bill
        </button>
      )}
    </div>
  );
}
