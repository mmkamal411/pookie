"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PriceReport,
  ShoppingItem,
  ShoppingList,
} from "@/server/services/shopping";
import type { ShoppingDemoData } from "@/lib/shopping-demo";

/* ------------------------------------------------------------------ */
/* api helper                                                          */
/* ------------------------------------------------------------------ */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error?.message ?? "Something went wrong.");
  return json.data as T;
}

interface ListPayload {
  list: ShoppingList;
  items: ShoppingItem[];
  role: "parent" | "child";
  userId: string;
}

const BASE = "/api/v1/household/shopping";

/* ------------------------------------------------------------------ */
/* small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-moss-300 uppercase">
      {children}
      {count != null && (
        <span className="rounded-full bg-canopy-800 px-2 py-0.5 text-xs text-bark-300 shadow-glow-sm">
          {count}
        </span>
      )}
    </h2>
  );
}

function whoTag(item: ShoppingItem, userId: string): string {
  if (item.added_by === userId) return "You";
  return item.added_by_name ?? "Family";
}

function formatQty(item: ShoppingItem): string {
  const q = item.quantity ?? 1;
  const qty = Number.isInteger(q) ? String(q) : String(q);
  return item.unit ? `${qty} ${item.unit}` : qty;
}

/** Honest best-price hint — explicitly labeled as coming from family reports. */
function bestPriceHint(prices: PriceReport[]): string | null {
  if (prices.length === 0) return null;
  const byStore = new Map<string, number>();
  for (const p of prices) {
    const prev = byStore.get(p.store);
    if (prev == null || p.price < prev) byStore.set(p.store, p.price);
  }
  const [store, price] = [...byStore.entries()].sort((a, b) => a[1] - b[1])[0];
  return `Cheapest at ${store} · $${price.toFixed(2)} — based on your reported prices`;
}

/* ------------------------------------------------------------------ */
/* buy sheet (store + price optional)                                  */
/* ------------------------------------------------------------------ */

function BuySheet({
  item,
  stores,
  onConfirm,
  onCancel,
  busy,
}: {
  item: ShoppingItem;
  stores: string[];
  onConfirm: (store?: string, price?: number) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [store, setStore] = useState("");
  const [price, setPrice] = useState("");
  return (
    <div className="animate-rise mt-3 rounded-xl border border-sunlight-400/25 bg-canopy-800/80 p-3 shadow-sun-warm">
      <p className="text-xs font-medium text-sunlight-200">
        Where did you get {item.name}?
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          list={`stores-${item.id}`}
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Store (optional)"
          className="w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
        />
        <datalist id={`stores-${item.id}`}>
          {stores.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price (optional)"
          inputMode="decimal"
          className="w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none sm:w-32"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy}
          onClick={() => onConfirm(store.trim() || undefined, price ? Number(price) : undefined)}
          className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-canopy-950 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Bought"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-canopy-700 px-4 py-1.5 text-sm text-bark-300 hover:border-leaf-500"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* item card                                                           */
/* ------------------------------------------------------------------ */

function ItemCard({
  item,
  userId,
  role,
  prices,
  stores,
  busy,
  buying,
  expanded,
  onClaim,
  onUnclaim,
  onBuyStart,
  onBuyConfirm,
  onBuyCancel,
  onRemove,
  onTogglePrices,
  onReportPrice,
}: {
  item: ShoppingItem;
  userId: string;
  role: "parent" | "child";
  prices: PriceReport[];
  stores: string[];
  busy: boolean;
  buying: boolean;
  expanded: boolean;
  onClaim: () => void;
  onUnclaim: () => void;
  onBuyStart: () => void;
  onBuyConfirm: (store?: string, price?: number) => void;
  onBuyCancel: () => void;
  onRemove: () => void;
  onTogglePrices: () => void;
  onReportPrice: (store: string, price: number) => void;
}) {
  const [rStore, setRStore] = useState("");
  const [rPrice, setRPrice] = useState("");
  const canRemove = item.added_by === userId || role === "parent";
  const hint = bestPriceHint(prices);
  const statusStyle =
    item.status === "needed"
      ? "border-leaf-600/30"
      : item.status === "claimed"
        ? "border-sunlight-400/30 shadow-sun-warm"
        : "border-canopy-700 opacity-80";

  return (
    <div className={`animate-bloom rounded-2xl border bg-canopy-900/80 p-4 ${statusStyle}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-dew-100">
            {item.name}{" "}
            <span className="text-sm font-normal text-bark-300">{formatQty(item)}</span>
          </p>
          <p className="mt-0.5 text-xs text-bark-300">
            — {whoTag(item, userId)}
            {item.source !== "manual" && (
              <span className="ml-2 rounded-full bg-canopy-800 px-2 py-0.5 text-[10px] tracking-wide text-sunlight-300 uppercase">
                {item.source === "meal-plan" ? "meal plan" : item.source}
              </span>
            )}
          </p>
          {item.note && <p className="mt-1 text-xs text-bark-300 italic">{item.note}</p>}
          {item.status === "bought" && item.store && (
            <p className="mt-1 text-xs text-moss-300">
              Got at {item.store}
              {item.price_paid != null && ` · $${Number(item.price_paid).toFixed(2)}`}
            </p>
          )}
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            disabled={busy}
            title={item.added_by === userId ? "Remove" : "Remove (parent)"}
            aria-label={`Remove ${item.name}`}
            className="rounded-full border border-canopy-700 px-2 py-0.5 text-xs text-bark-500 hover:border-leaf-500 hover:text-bark-100 disabled:opacity-50"
          >
            ✕
          </button>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.status === "needed" && (
          <button
            onClick={onClaim}
            disabled={busy}
            className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-canopy-950 disabled:opacity-50"
          >
            I&apos;ll grab it
          </button>
        )}
        {item.status === "claimed" && (
          <>
            <button
              onClick={onBuyStart}
              disabled={busy}
              className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-canopy-950 disabled:opacity-50"
            >
              Bought it
            </button>
            <button
              onClick={onUnclaim}
              disabled={busy}
              className="rounded-lg border border-canopy-700 px-3 py-1.5 text-sm text-bark-300 hover:border-leaf-500 disabled:opacity-50"
            >
              Unclaim
            </button>
          </>
        )}
        <button
          onClick={onTogglePrices}
          className="ml-auto rounded-lg px-2 py-1.5 text-xs text-bark-300 underline decoration-dotted underline-offset-4 hover:text-dew-200"
        >
          {expanded ? "Hide price memory" : "Price memory"}
        </button>
      </div>

      {buying && (
        <BuySheet
          item={item}
          stores={stores}
          busy={busy}
          onConfirm={onBuyConfirm}
          onCancel={onBuyCancel}
        />
      )}

      {expanded && (
        <div className="animate-rise mt-3 rounded-xl border border-canopy-700 bg-canopy-950/60 p-3">
          {hint && (
            <p className="text-xs font-medium text-sunlight-200">💡 {hint}</p>
          )}
          {prices.length === 0 ? (
            <p className="mt-1 text-xs text-bark-500">
              No reported prices yet — report one below so the family learns where {item.name} is cheapest.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {prices.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs text-bark-300">
                  <span>
                    {p.store} · {p.reported_at}
                    {p.reported_by === userId ? " · you" : p.reported_by_name ? ` · ${p.reported_by_name}` : ""}
                  </span>
                  <span className="font-semibold text-dew-200">${Number(p.price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={rStore}
              onChange={(e) => setRStore(e.target.value)}
              placeholder="Store"
              className="w-full rounded-lg border border-canopy-700 bg-canopy-900 px-2 py-1.5 text-xs text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
            />
            <input
              value={rPrice}
              onChange={(e) => setRPrice(e.target.value)}
              placeholder="Price"
              inputMode="decimal"
              className="w-24 rounded-lg border border-canopy-700 bg-canopy-900 px-2 py-1.5 text-xs text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
            />
            <button
              disabled={busy || !rStore.trim() || !rPrice}
              onClick={() => {
                onReportPrice(rStore.trim(), Number(rPrice));
                setRStore("");
                setRPrice("");
              }}
              className="rounded-lg border border-leaf-600/50 px-3 py-1.5 text-xs font-semibold text-leaf-300 hover:bg-leaf-600/20 disabled:opacity-50"
            >
              Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* preferences panel (parent only)                                     */
/* ------------------------------------------------------------------ */

function PreferencesPanel({
  preferences,
  onSave,
  busy,
}: {
  preferences: Record<string, unknown>;
  onSave: (prefs: Record<string, unknown>) => void;
  busy: boolean;
}) {
  const [stores, setStores] = useState(
    ((preferences.preferred_stores as string[]) ?? []).join(", "),
  );
  const [rules, setRules] = useState((preferences.standing_rules as string) ?? "");
  return (
    <div className="rounded-2xl border border-canopy-700 bg-canopy-900/80 p-4">
      <h3 className="text-sm font-semibold text-dew-100">🏪 Store preferences</h3>
      <p className="mt-0.5 text-xs text-bark-300">
        Standing rules the family&apos;s suggestions respect — e.g. &ldquo;we don&apos;t do Walmart&rdquo;.
      </p>
      <label className="mt-3 block text-xs font-medium text-bark-300">
        Preferred stores (comma-separated)
        <input
          value={stores}
          onChange={(e) => setStores(e.target.value)}
          placeholder="Kroger, Aldi"
          className="mt-1 w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-bark-300">
        Standing rules
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={2}
          placeholder="we don't do Walmart"
          className="mt-1 w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
        />
      </label>
      <button
        disabled={busy}
        onClick={() =>
          onSave({
            preferred_stores: stores.split(",").map((s) => s.trim()).filter(Boolean),
            standing_rules: rules.trim(),
          })
        }
        className="btn-dapple mt-3 rounded-lg px-4 py-1.5 text-sm font-semibold text-canopy-950 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function ShoppingBoard({ demo }: { demo?: ShoppingDemoData }) {
  const demoMode = !!demo;
  const [payload, setPayload] = useState<ListPayload | null>(
    demo
      ? { list: demo.list, items: demo.items, role: demo.role, userId: demo.userId }
      : null,
  );
  const [prices, setPrices] = useState<PriceReport[]>(demo?.prices ?? []);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    const data = await api<ListPayload>(`${BASE}/list`);
    setPayload(data);
    return data;
  }, []);

  const refreshPrices = useCallback(async () => {
    const data = await api<{ prices: PriceReport[] }>(`${BASE}/prices`);
    setPrices(data.prices);
  }, []);

  useEffect(() => {
    if (demoMode) return;
    (async () => {
      try {
        await Promise.all([refresh(), refreshPrices()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    })();
  }, [demoMode, refresh, refreshPrices]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Something went wrong.");

  /** Demo-mode local mutation mirror (no network). */
  const mutateDemo = (fn: (items: ShoppingItem[], prices: PriceReport[]) => { items: ShoppingItem[]; prices: PriceReport[] }) => {
    setPayload((p) => {
      if (!p) return p;
      const next = fn(p.items, prices);
      setPrices(next.prices);
      return { ...p, items: next.items };
    });
  };

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || !payload) return;
    setError(null);
    try {
      if (demoMode) {
        const norm = normalize(trimmed);
        mutateDemo((items, pr) => {
          const existing = items.find((i) => i.name === norm && (i.status === "needed" || i.status === "claimed"));
          if (existing) {
            return {
              items: items.map((i) =>
                i.id === existing.id ? { ...i, quantity: Number(i.quantity ?? 1) + Number(quantity || 1) } : i,
              ),
              prices: pr,
            };
          }
          const newItem: ShoppingItem = {
            id: `demo-${Date.now()}`,
            list_id: payload.list.id,
            name: norm,
            quantity: Number(quantity || 1),
            unit: unit.trim() || null,
            note: note.trim() || null,
            status: "needed",
            added_by: payload.userId,
            added_by_name: "You",
            claimed_by: null,
            bought_by: null,
            bought_at: null,
            store: null,
            price_paid: null,
            source: "manual",
            source_ref: null,
            created_at: new Date().toISOString(),
          };
          return { items: [...items, newItem], prices: pr };
        });
      } else {
        const data = await api<{ item: ShoppingItem; merged: boolean }>(`${BASE}/items`, {
          method: "POST",
          body: JSON.stringify({
            name: trimmed,
            quantity: Number(quantity || 1),
            unit: unit.trim() || undefined,
            note: note.trim() || undefined,
          }),
        });
        setPayload((p) =>
          p
            ? {
                ...p,
                items: data.merged
                  ? p.items.map((i) => (i.id === data.item.id ? { ...data.item, added_by_name: i.added_by_name } : i))
                  : [...p.items, data.item],
              }
            : p,
        );
      }
      setName("");
      setQuantity("1");
      setUnit("");
      setNote("");
    } catch (e) {
      fail(e);
    }
  };

  const handleTransition = async (itemId: string, status: "needed" | "claimed" | "bought", store?: string, price?: number) => {
    setBusyId(itemId);
    setError(null);
    try {
      if (demoMode) {
        mutateDemo((items, pr) => {
          const item = items.find((i) => i.id === itemId);
          if (!item) return { items, prices: pr };
          const updated: ShoppingItem = {
            ...item,
            status,
            claimed_by: status === "claimed" ? payload!.userId : status === "needed" ? null : item.claimed_by,
            bought_by: status === "bought" ? payload!.userId : item.bought_by,
            bought_at: status === "bought" ? new Date().toISOString() : item.bought_at,
            store: store ?? item.store,
            price_paid: price ?? item.price_paid,
          };
          let nextPrices = pr;
          if (status === "bought" && price != null && store) {
            nextPrices = [
              {
                id: `demo-p-${Date.now()}`,
                list_id: item.list_id,
                item_name: item.name,
                store,
                price,
                reported_by: payload!.userId,
                reported_by_name: "You",
                reported_at: new Date().toISOString().slice(0, 10),
                receipt_item_id: item.id,
                created_at: new Date().toISOString(),
              },
              ...pr,
            ];
          }
          return { items: items.map((i) => (i.id === itemId ? updated : i)), prices: nextPrices };
        });
      } else {
        const data = await api<{ item: ShoppingItem }>(`${BASE}/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ status, store, price_paid: price }),
        });
        setPayload((p) =>
          p ? { ...p, items: p.items.map((i) => (i.id === itemId ? { ...data.item, added_by_name: i.added_by_name } : i)) } : p,
        );
        if (status === "bought") await refreshPrices();
      }
      setBuyingId(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (itemId: string) => {
    if (!window.confirm("Remove this item from the list?")) return;
    setBusyId(itemId);
    setError(null);
    try {
      if (demoMode) {
        mutateDemo((items, pr) => ({
          items: items.filter((i) => i.id !== itemId),
          prices: pr,
        }));
      } else {
        await api(`${BASE}/items/${itemId}/remove`, { method: "POST", body: "{}" });
        await refresh();
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusyId(null);
    }
  };

  const handleReportPrice = async (item: ShoppingItem, store: string, price: number) => {
    setError(null);
    try {
      if (demoMode) {
        mutateDemo((items, pr) => ({
          items,
          prices: [
            {
              id: `demo-p-${Date.now()}`,
              list_id: item.list_id,
              item_name: item.name,
              store,
              price,
              reported_by: payload!.userId,
              reported_by_name: "You",
              reported_at: new Date().toISOString().slice(0, 10),
              receipt_item_id: null,
              created_at: new Date().toISOString(),
            },
            ...pr,
          ],
        }));
      } else {
        await api(`${BASE}/prices`, {
          method: "POST",
          body: JSON.stringify({ item_name: item.name, store, price }),
        });
        await refreshPrices();
      }
    } catch (e) {
      fail(e);
    }
  };

  const handleSavePrefs = async (prefs: Record<string, unknown>) => {
    setPrefsBusy(true);
    setError(null);
    try {
      if (demoMode) {
        setPayload((p) => (p ? { ...p, list: { ...p.list, preferences: { ...p.list.preferences, ...prefs } } } : p));
      } else {
        const data = await api<{ preferences: Record<string, unknown> }>(`${BASE}/preferences`, {
          method: "PATCH",
          body: JSON.stringify({ preferences: prefs }),
        });
        setPayload((p) => (p ? { ...p, list: { ...p.list, preferences: data.preferences } } : p));
      }
    } catch (e) {
      fail(e);
    } finally {
      setPrefsBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const items = payload?.items ?? [];
    return {
      needed: items.filter((i) => i.status === "needed"),
      claimed: items.filter((i) => i.status === "claimed"),
      bought: items.filter((i) => i.status === "bought"),
    };
  }, [payload]);

  const stores = useMemo(() => {
    const seen = new Set<string>();
    for (const p of prices) seen.add(p.store);
    for (const s of ((payload?.list.preferences.preferred_stores as string[]) ?? [])) seen.add(s);
    return [...seen];
  }, [prices, payload]);

  const pricesFor = (item: ShoppingItem) => prices.filter((p) => p.item_name === item.name);

  const cardProps = (item: ShoppingItem) => ({
    item,
    userId: payload!.userId,
    role: payload!.role,
    prices: pricesFor(item),
    stores,
    busy: busyId === item.id,
    buying: buyingId === item.id,
    expanded: expandedId === item.id,
    onClaim: () => handleTransition(item.id, "claimed"),
    onUnclaim: () => handleTransition(item.id, "needed"),
    onBuyStart: () => setBuyingId(item.id),
    onBuyConfirm: (store?: string, price?: number) => handleTransition(item.id, "bought", store, price),
    onBuyCancel: () => setBuyingId(null),
    onRemove: () => handleRemove(item.id),
    onTogglePrices: () => setExpandedId((id) => (id === item.id ? null : item.id)),
    onReportPrice: (store: string, price: number) => handleReportPrice(item, store, price),
  });

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-bark-300">Gathering the family list…</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-bark-300">
          {error ?? "The family list isn't available yet."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {/* header */}
      <header className="animate-rise">
        <p className="text-xs font-semibold tracking-widest text-sunlight-300 uppercase">
          🏠 Household
        </p>
        <h1 className="text-sunlit mt-1 text-3xl font-bold">Family shopping list</h1>
        <p className="mt-1 text-sm text-bark-300">
          One list, the whole family — everyone adds, every item tagged with who added it.
        </p>
      </header>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-sunlight-400/40 bg-canopy-800 p-3 text-sm text-sunlight-200">
          {error}
        </div>
      )}

      {/* add form */}
      <section aria-label="Add an item" className="animate-bloom mt-6 rounded-2xl border border-leaf-600/30 bg-canopy-900/80 p-4 shadow-glow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Are we out of milk? Add it here…"
            aria-label="Item name"
            className="w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantity"
              inputMode="decimal"
              className="w-20 rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 focus:border-leaf-500 focus:outline-none"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit"
              aria-label="Unit"
              className="w-20 rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="btn-dapple rounded-lg px-5 py-2 text-sm font-semibold text-canopy-950"
            >
              Add
            </button>
          </div>
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Note (optional) — e.g. oat, not dairy"
          aria-label="Note"
          className="mt-2 w-full rounded-lg border border-canopy-700 bg-canopy-950 px-3 py-2 text-sm text-bark-100 placeholder:text-bark-500 focus:border-leaf-500 focus:outline-none"
        />
      </section>

      {/* needed */}
      <section aria-label="Needed" className="mt-8">
        <SectionTitle count={grouped.needed.length}>🌱 Needed</SectionTitle>
        <div className="mt-3 space-y-3">
          {grouped.needed.map((i) => (
            <ItemCard key={i.id} {...cardProps(i)} />
          ))}
          {grouped.needed.length === 0 && (
            <p className="text-sm text-bark-500">Nothing needed — the pantry glows. ✨</p>
          )}
        </div>
      </section>

      {/* claimed */}
      <section aria-label="Claimed" className="mt-8">
        <SectionTitle count={grouped.claimed.length}>🤲 Claimed — on the way</SectionTitle>
        <div className="mt-3 space-y-3">
          {grouped.claimed.map((i) => (
            <ItemCard key={i.id} {...cardProps(i)} />
          ))}
          {grouped.claimed.length === 0 && (
            <p className="text-sm text-bark-500">No one&apos;s on a grocery run right now.</p>
          )}
        </div>
      </section>

      {/* bought */}
      <section aria-label="Recently bought" className="mt-8">
        <SectionTitle count={grouped.bought.length}>✅ Recently bought</SectionTitle>
        <div className="mt-3 space-y-3">
          {grouped.bought.map((i) => (
            <ItemCard key={i.id} {...cardProps(i)} />
          ))}
          {grouped.bought.length === 0 && (
            <p className="text-sm text-bark-500">Nothing bought yet.</p>
          )}
        </div>
      </section>

      {/* preferences — parent only */}
      {payload.role === "parent" && (
        <section aria-label="Store preferences" className="mt-10">
          <PreferencesPanel
            preferences={payload.list.preferences}
            onSave={handleSavePrefs}
            busy={prefsBusy}
          />
        </section>
      )}
    </main>
  );
}
