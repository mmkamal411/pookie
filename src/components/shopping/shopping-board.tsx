"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PriceReport,
  ShoppingItem,
  ShoppingList,
} from "@/server/services/shopping";
import {
  AvatarChip,
  ApiError,
  QuietConfirm,
  LoadVeil,
  fmtDateTime,
} from "@/components/home-money/shared";

/* ------------------------------------------------------------------ */
/* api helper                                                          */
/* ------------------------------------------------------------------ */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok) throw new ApiError(json.error?.code ?? "INTERNAL", json.error?.message ?? "Hold position — request incomplete. Try again in a moment.");
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
    <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-nova-300 capitalize">
      {children}
      {count != null && (
        <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300 shadow-glow-sm">
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

/** Display name for an actor id — "You" for self, "Family" for other members
 *  (display-name gap: child-role callers only see their own users row). */
function actorName(id: string | null, userId: string, knownName?: string | null): string {
  if (!id) return "Family";
  if (id === userId) return "You";
  return knownName ?? "Family";
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
    <div className="animate-rise mt-3 rounded-xl border border-aurum-400/25 bg-nebula-800/80 p-3 shadow-sun-warm">
      <p className="text-xs font-medium text-aurum-200">
        Where did you get {item.name}?
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          list={`stores-${item.id}`}
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Store (optional)"
          className="w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
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
          className="w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none sm:w-32"
        />
      </div>
      <div className="mt-2 flex gap-2">
        <button
          disabled={busy}
          onClick={() => onConfirm(store.trim() || undefined, price ? Number(price) : undefined)}
          className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Bought"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-nebula-700 px-4 py-1.5 text-sm text-stardust-300 hover:border-nova-500"
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
  rollbackNote,
  spark,
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
  /** Warm inline note shown when an optimistic update rolled back. */
  rollbackNote?: string | null;
  /** Spark-burst celebration on the "Bought it" moment. */
  spark?: boolean;
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
  const addedName = whoTag(item, userId);
  const claimedName = actorName(item.claimed_by, userId);
  const boughtName = actorName(item.bought_by, userId);
  const statusStyle =
    item.status === "needed"
      ? "border-nova-600/30"
      : item.status === "claimed"
        ? "border-aurum-400/30 shadow-sun-warm"
        : "border-nebula-700 opacity-80";

  return (
    <div className={`animate-bloom relative rounded-2xl border bg-nebula-900/80 p-4 ${statusStyle}`}>
      {spark && <SparkBurst />}
      {rollbackNote && (
        <p className="mb-2 rounded-lg border border-aurum-400/40 bg-nebula-800/70 px-2 py-1 text-xs text-aurum-200">
          {rollbackNote}
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-star-100">
            {item.name}{" "}
            <span className="text-sm font-normal text-stardust-300">{formatQty(item)}</span>
          </p>
          {/* attribution: added-by always; claimed-by / bought-by with chips */}
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <AvatarChip
              name={addedName}
              detail={`Added by ${addedName} · ${fmtDateTime(item.created_at)}`}
            />
            <span className="text-xs text-stardust-300">Added by {addedName}</span>
            {item.status === "claimed" && item.claimed_by && (
              <>
                <span aria-hidden="true" className="text-stardust-500">·</span>
                <AvatarChip name={claimedName} detail={`Claimed by ${claimedName} — on the way`} />
                <span className="text-xs text-aurum-200">Claimed by {claimedName}</span>
              </>
            )}
            {item.status === "bought" && item.bought_by && (
              <>
                <span aria-hidden="true" className="text-stardust-500">·</span>
                <AvatarChip name={boughtName} detail={`Bought by ${boughtName}`} />
                <span className="text-xs text-stardust-300">Bought by {boughtName}</span>
              </>
            )}
            {item.source !== "manual" && (
              <span className="ml-1 rounded-full bg-nebula-800 px-2 py-0.5 text-[10px] tracking-wide text-aurum-300 capitalize">
                {item.source === "meal-plan" ? "meal plan" : item.source}
              </span>
            )}
          </div>
          {item.note && <p className="mt-1 text-xs text-stardust-300 italic">{item.note}</p>}
          {item.status === "claimed" && (
            <p className="mt-1 text-xs text-aurum-200/90">🤲 on the way</p>
          )}
          {item.status === "bought" && item.store && (
            <p className="mt-1 text-xs text-nova-300">
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
            className="rounded-full border border-nebula-700 px-2 py-0.5 text-xs text-stardust-500 hover:border-nova-500 hover:text-stardust-100 disabled:opacity-50"
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
            aria-pressed={false}
            className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            I&apos;ll grab it
          </button>
        )}
        {item.status === "claimed" && (
          <>
            <button
              onClick={onBuyStart}
              disabled={busy}
              aria-pressed={false}
              className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              Bought it
            </button>
            <button
              onClick={onUnclaim}
              disabled={busy}
              aria-pressed={false}
              className="rounded-lg border border-nebula-700 px-3 py-1.5 text-sm text-stardust-300 hover:border-nova-500 disabled:opacity-50"
            >
              Unclaim
            </button>
          </>
        )}
        <button
          onClick={onTogglePrices}
          className="ml-auto rounded-lg px-2 py-1.5 text-xs text-stardust-300 underline decoration-dotted underline-offset-4 hover:text-star-200"
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
        <div className="animate-rise mt-3 rounded-xl border border-nebula-700 bg-nebula-950/60 p-3">
          {hint && (
            <p className="text-xs font-medium text-aurum-200">💡 {hint}</p>
          )}
          {prices.length === 0 ? (
            <p className="mt-1 text-xs text-stardust-500">
              No reported prices yet — report one below so the family learns where {item.name} is cheapest.
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {prices.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-xs text-stardust-300">
                  <span>
                    {p.store} · {p.reported_at}
                    {p.reported_by === userId ? " · you" : p.reported_by_name ? ` · ${p.reported_by_name}` : ""}
                  </span>
                  <span className="font-semibold text-star-200">${Number(p.price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={rStore}
              onChange={(e) => setRStore(e.target.value)}
              placeholder="Store"
              className="w-full rounded-lg border border-nebula-700 bg-nebula-900 px-2 py-1.5 text-xs text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
            />
            <input
              value={rPrice}
              onChange={(e) => setRPrice(e.target.value)}
              placeholder="Price"
              inputMode="decimal"
              className="w-24 rounded-lg border border-nebula-700 bg-nebula-900 px-2 py-1.5 text-xs text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
            />
            <button
              disabled={busy || !rStore.trim() || !rPrice}
              onClick={() => {
                onReportPrice(rStore.trim(), Number(rPrice));
                setRStore("");
                setRPrice("");
              }}
              className="rounded-lg border border-nova-600/50 px-3 py-1.5 text-xs font-semibold text-nova-300 hover:bg-nova-600/20 disabled:opacity-50"
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
    <div className="rounded-2xl border border-nebula-700 bg-nebula-900/80 p-4">
      <h3 className="text-sm font-semibold text-star-100">🏪 Store preferences</h3>
      <p className="mt-0.5 text-xs text-stardust-300">
        Standing rules the family&apos;s suggestions respect — e.g. &ldquo;we don&apos;t do Walmart&rdquo;.
      </p>
      <label className="mt-3 block text-xs font-medium text-stardust-300">
        Preferred stores (comma-separated)
        <input
          value={stores}
          onChange={(e) => setStores(e.target.value)}
          placeholder="Kroger, Aldi"
          className="mt-1 w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
        />
      </label>
      <label className="mt-2 block text-xs font-medium text-stardust-300">
        Standing rules
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={2}
          placeholder="we don't do Walmart"
          className="mt-1 w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
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
        className="btn-dapple mt-3 rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save preferences"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* spark burst — the "Bought it" moment (divine-light, soft, brief)    */
/* ------------------------------------------------------------------ */

const SPARK_PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  const dist = 34 + (i % 3) * 14;
  return {
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist,
    size: i % 3 === 0 ? 5 : 3,
    delay: (i % 4) * 40,
  };
});

function SparkBurst() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 overflow-visible motion-reduce:hidden">
      {SPARK_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="absolute top-1/2 left-1/2 rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: "radial-gradient(circle, rgb(190 242 100 / 0.95), rgb(52 211 153 / 0))",
            boxShadow: "0 0 8px rgb(190 242 100 / 0.8)",
            animation: `s4-spark 0.9s cubic-bezier(0.22,1,0.36,1) ${p.delay}ms both`,
            ["--s4-dx" as string]: `${p.dx}px`,
            ["--s4-dy" as string]: `${p.dy}px`,
          }}
        />
      ))}
      <style>{`@keyframes s4-spark{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--s4-dx),var(--s4-dy)) scale(0.2);opacity:0}}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function ShoppingBoard() {
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [prices, setPrices] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [rollbackNotes, setRollbackNotes] = useState<Record<string, string>>({});
  const [removeTarget, setRemoveTarget] = useState<ShoppingItem | null>(null);
  const [removing, setRemoving] = useState(false);
  const [sparkId, setSparkId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; onUndo?: () => void } | null>(null);
  const pendingBuy = useRef<{
    itemId: string;
    store?: string;
    price?: number;
    timer: number;
  } | null>(null);

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
    (async () => {
      try {
        await Promise.all([refresh(), refreshPrices()]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh, refreshPrices]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  /** Clear any pending (uncommitted) buy — used before starting another. */
  const clearPendingBuy = useCallback(() => {
    if (pendingBuy.current) {
      clearTimeout(pendingBuy.current.timer);
      pendingBuy.current = null;
    }
  }, []);

  useEffect(() => () => clearPendingBuy(), [clearPendingBuy]);

  /** Optimistic status transition with warm rollback on failure. */
  const commitTransition = useCallback(
    async (
      itemId: string,
      status: "needed" | "claimed" | "bought",
      store?: string,
      price?: number,
      base?: ShoppingItem,
    ) => {
      const prev = base ?? payload?.items.find((i) => i.id === itemId);
      if (!prev || !payload) return;
      const optimistic: ShoppingItem = {
        ...prev,
        status,
        ...(status === "claimed" ? { claimed_by: payload.userId } : {}),
        ...(status === "needed" ? { claimed_by: null } : {}),
        ...(status === "bought"
          ? {
              store: store ?? prev.store,
              price_paid: price ?? prev.price_paid,
              bought_by: payload.userId,
              bought_at: new Date().toISOString(),
            }
          : {}),
      };
      setRollbackNotes((n) => {
        const c = { ...n };
        delete c[itemId];
        return c;
      });
      setPayload((p) =>
        p ? { ...p, items: p.items.map((i) => (i.id === itemId ? optimistic : i)) } : p,
      );
      setBusyId(itemId);
      setError(null);
      try {
        const data = await api<{ item: ShoppingItem }>(`${BASE}/items/${itemId}`, {
          method: "PATCH",
          body: JSON.stringify({ status, store, price_paid: price }),
        });
        setPayload((p) =>
          p
            ? {
                ...p,
                items: p.items.map((i) =>
                  i.id === itemId
                    ? { ...data.item, added_by_name: i.added_by_name }
                    : i,
                ),
              }
            : p,
        );
        if (status === "bought") await refreshPrices();
        setBuyingId(null);
      } catch (e) {
        // Warm rollback: the card eases back, with a plain-English note.
        setPayload((p) =>
          p ? { ...p, items: p.items.map((i) => (i.id === itemId ? prev : i)) } : p,
        );
        const note =
          e instanceof ApiError && e.code === "CONFLICT" && status === "claimed"
            ? "Someone just grabbed this one — the list is up to date now."
            : "Couldn't save that — you're offline or it failed. Nothing was lost.";
        setRollbackNotes((n) => ({ ...n, [itemId]: note }));
      } finally {
        setBusyId(null);
      }
    },
    [payload, refreshPrices],
  );

  const handleTransition = async (
    itemId: string,
    status: "needed" | "claimed" | "bought",
    store?: string,
    price?: number,
  ) => {
    clearPendingBuy();
    await commitTransition(itemId, status, store, price);
  };

  /**
   * "Bought it" with a 5-second undo. The card moves instantly with the spark
   * burst; the server commit follows after the window closes — undo inside
   * the window cancels the commit entirely (no backwards state-machine
   * transition needed, since nothing was written yet).
   */
  const handleBuyConfirm = (item: ShoppingItem, store?: string, price?: number) => {
    if (!payload) return;
    clearPendingBuy();
    setBuyingId(null);
    setToast(null);
    setSparkId(item.id);
    window.setTimeout(() => setSparkId((s) => (s === item.id ? null : s)), 1000);
    const optimistic: ShoppingItem = {
      ...item,
      status: "bought",
      store: store ?? item.store,
      price_paid: price ?? item.price_paid,
      bought_by: payload.userId,
      bought_at: new Date().toISOString(),
    };
    setPayload((p) =>
      p ? { ...p, items: p.items.map((i) => (i.id === item.id ? optimistic : i)) } : p,
    );
    const timer = window.setTimeout(() => {
      pendingBuy.current = null;
      setToast(null);
      void commitTransition(item.id, "bought", store, price, optimistic);
    }, 5000);
    pendingBuy.current = { itemId: item.id, store, price, timer };
    setToast({
      text: `Nice — ${item.name} is home. ✨`,
      onUndo: () => {
        clearPendingBuy();
        setToast(null);
        setPayload((p) =>
          p ? { ...p, items: p.items.map((i) => (i.id === item.id ? item : i)) } : p,
        );
      },
    });
  };

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed || !payload) return;
    setError(null);
    try {
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
      setName("");
      setQuantity("1");
      setUnit("");
      setNote("");
    } catch (e) {
      fail(e);
    }
  };

  const handleRemove = async (itemId: string) => {
    setRemoving(true);
    setError(null);
    try {
      await api(`${BASE}/items/${itemId}/remove`, { method: "POST", body: "{}" });
      await refresh();
      setRemoveTarget(null);
    } catch (e) {
      fail(e);
    } finally {
      setRemoving(false);
    }
  };

  /** "Buy it again" — archived bought items loop back to Needed in one tap. */
  const handleBuyAgain = async (item: ShoppingItem) => {
    setError(null);
    try {
      const data = await api<{ item: ShoppingItem; merged: boolean }>(`${BASE}/items`, {
        method: "POST",
        body: JSON.stringify({
          name: item.name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? undefined,
          note: item.note ?? undefined,
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
    } catch (e) {
      fail(e);
    }
  };

  const handleReportPrice = async (item: ShoppingItem, store: string, price: number) => {
    setError(null);
    try {
              await api(`${BASE}/prices`, {
          method: "POST",
          body: JSON.stringify({ item_name: item.name, store, price }),
        });
        await refreshPrices();
    } catch (e) {
      fail(e);
    }
  };

  const handleSavePrefs = async (prefs: Record<string, unknown>) => {
    setPrefsBusy(true);
    setError(null);
    try {
              const data = await api<{ preferences: Record<string, unknown> }>(`${BASE}/preferences`, {
          method: "PATCH",
          body: JSON.stringify({ preferences: prefs }),
        });
        setPayload((p) => (p ? { ...p, list: { ...p.list, preferences: data.preferences } } : p));
    } catch (e) {
      fail(e);
    } finally {
      setPrefsBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const items = payload?.items ?? [];
    const now = Date.now();
    const ageMs = (i: ShoppingItem) =>
      i.bought_at ? now - new Date(i.bought_at).getTime() : 0;
    const bought = items.filter((i) => i.status === "bought");
    return {
      needed: items.filter((i) => i.status === "needed"),
      claimed: items.filter((i) => i.status === "claimed"),
      // Auto-archive: fresh (<24h) stays visible; 1–7d collapses into the
      // week's haul; older than 7d leaves the lane (still in price memory).
      boughtFresh: bought.filter((i) => ageMs(i) < 24 * 3600_000),
      boughtWeek: bought.filter((i) => ageMs(i) >= 24 * 3600_000 && ageMs(i) < 7 * 24 * 3600_000),
    };
  }, [payload]);

  const [haulOpen, setHaulOpen] = useState(false);

  /** Household price view — derived from the existing price_reports table.
   *  No new backend: store leaderboard with report counts and the number of
   *  items where this store is the cheapest the family has seen. */
  const storeStats = useMemo(() => {
    const cheapest = new Map<string, number>();
    for (const p of prices) {
      const prev = cheapest.get(p.item_name);
      if (prev == null || p.price < prev) cheapest.set(p.item_name, p.price);
    }
    const byStore = new Map<string, { reports: number; cheapestWins: Set<string> }>();
    for (const p of prices) {
      let s = byStore.get(p.store);
      if (!s) {
        s = { reports: 0, cheapestWins: new Set() };
        byStore.set(p.store, s);
      }
      s.reports += 1;
      if (cheapest.get(p.item_name) === p.price) s.cheapestWins.add(p.item_name);
    }
    return [...byStore.entries()]
      .map(([store, s]) => ({ store, reports: s.reports, cheapestFor: s.cheapestWins.size }))
      .sort((a, b) => b.reports - a.reports);
  }, [prices]);

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
    rollbackNote: rollbackNotes[item.id] ?? null,
    spark: sparkId === item.id,
    onClaim: () => handleTransition(item.id, "claimed"),
    onUnclaim: () => handleTransition(item.id, "needed"),
    onBuyStart: () => setBuyingId(item.id),
    onBuyConfirm: (store?: string, price?: number) => handleBuyConfirm(item, store, price),
    onBuyCancel: () => setBuyingId(null),
    onRemove: () => setRemoveTarget(item),
    onTogglePrices: () => setExpandedId((id) => (id === item.id ? null : item.id)),
    onReportPrice: (store: string, price: number) => handleReportPrice(item, store, price),
  });

  if (loading) {
    return <LoadVeil label="Gathering the family list…" />;
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-stardust-300">
          {error ?? "The family list isn't available yet."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {/* header */}
      <header className="animate-rise">
        <p className="text-xs font-semibold tracking-widest text-aurum-300 capitalize">
          🏠 Household
        </p>
        <h1 className="text-sunlit mt-1 text-3xl font-bold">Family shopping list</h1>
        <p className="mt-1 text-sm text-stardust-300">
          One list, the whole family — everyone adds, every item tagged with who added it.
        </p>
      </header>

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-aurum-400/40 bg-nebula-800 p-3 text-sm text-aurum-200">
          {error}
        </div>
      )}

      {/* add form */}
      <section aria-label="Add an item" className="animate-bloom mt-6 rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4 shadow-glow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Are we out of milk? Add it here…"
            aria-label="Item name"
            className="w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label="Quantity"
              inputMode="decimal"
              className="w-20 rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 focus:border-nova-500 focus:outline-none"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="unit"
              aria-label="Unit"
              className="w-20 rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="btn-dapple rounded-lg px-5 py-2 text-sm font-semibold text-nebula-950"
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
          className="mt-2 w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none"
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
            <p className="text-sm text-stardust-500">Nothing needed — the pantry glows. ✨</p>
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
            <p className="text-sm text-stardust-500">No one&apos;s on a grocery run right now.</p>
          )}
        </div>
      </section>

      {/* bought */}
      <section aria-label="Recently bought" className="mt-8">
        <SectionTitle count={grouped.boughtFresh.length + grouped.boughtWeek.length}>✅ Recently bought</SectionTitle>
        <div className="mt-3 space-y-3">
          {grouped.boughtFresh.map((i) => (
            <ItemCard key={i.id} {...cardProps(i)} />
          ))}
          {grouped.boughtFresh.length === 0 && grouped.boughtWeek.length === 0 && (
            <p className="text-sm text-stardust-500">Nothing bought yet.</p>
          )}
        </div>
        {grouped.boughtWeek.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setHaulOpen((o) => !o)}
              aria-expanded={haulOpen}
              className="flex w-full items-center justify-between rounded-xl border border-nebula-700 bg-nebula-950/60 px-3 py-2 text-left"
            >
              <span className="text-xs font-medium tracking-wide text-stardust-300 capitalize">
                🧺 This week&apos;s haul
                <span className="ml-2 rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300">
                  {grouped.boughtWeek.length}
                </span>
              </span>
              <span aria-hidden="true" className={`text-nova-300 transition-transform ${haulOpen ? "rotate-180" : ""}`}>
                ▾
              </span>
            </button>
            {haulOpen && (
              <div className="mt-3 space-y-3">
                {grouped.boughtWeek.map((i) => (
                  <div key={i.id} className="animate-bloom rounded-2xl border border-nebula-700/70 bg-nebula-900/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-stardust-200">
                        {i.name}{" "}
                        <span className="text-xs font-normal text-stardust-400">{formatQty(i)}</span>
                      </p>
                      <button
                        onClick={() => handleBuyAgain(i)}
                        className="shrink-0 rounded-lg border border-nova-600/50 px-3 py-1 text-xs font-semibold text-nova-300 hover:bg-nova-600/20"
                      >
                        Buy it again
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-stardust-500">
                      Got at {i.store ?? "—"}
                      {i.price_paid != null && ` · $${Number(i.price_paid).toFixed(2)}`}
                      {i.bought_at && ` · ${fmtDateTime(i.bought_at)}`}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* where we shop — derived from the family's reported prices */}
      <section aria-label="Where we shop" className="mt-8">
        <SectionTitle>🏪 Where we shop</SectionTitle>
        {storeStats.length === 0 ? (
          <p className="mt-3 text-sm text-stardust-500">
            Report a price when you buy something and the family&apos;s store smarts will grow here.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {storeStats.map((s) => (
              <div
                key={s.store}
                className="flex items-center justify-between rounded-xl border border-nebula-700 bg-nebula-900/60 px-3 py-2"
              >
                <p className="text-sm font-medium text-stardust-200">{s.store}</p>
                <p className="text-xs text-stardust-400">
                  {s.reports} report{s.reports === 1 ? "" : "s"}
                  {s.cheapestFor > 0 && ` · usually cheapest for ${s.cheapestFor} item${s.cheapestFor === 1 ? "" : "s"}`}
                </p>
              </div>
            ))}
            <p className="text-[11px] text-stardust-500">
              Based on your reported prices — not ads, not sponsors.
            </p>
          </div>
        )}
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

      {/* undo toast */}
      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[90vw]">
          <div className="animate-rise flex items-center gap-3 rounded-2xl border border-nova-500/40 bg-nebula-900/95 px-4 py-3 shadow-glow-md backdrop-blur">
            <p className="text-sm text-stardust-100">{toast.text}</p>
            {toast.onUndo && (
              <button
                onClick={toast.onUndo}
                className="shrink-0 rounded-lg border border-aurum-400/60 px-3 py-1 text-sm font-semibold text-aurum-200 hover:bg-aurum-400/10"
              >
                Undo
              </button>
            )}
          </div>
        </div>
      )}

      {/* quiet remove confirm — no window.confirm */}
      <QuietConfirm
        open={removeTarget != null}
        onClose={() => setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name ?? "item"}?`}
        body={
          <p>
            It leaves the family list for everyone. Price memories for it stay —
            the family keeps what it learned.
          </p>
        }
        confirmLabel="Remove"
        danger
        busy={removing}
        onConfirm={() => removeTarget && handleRemove(removeTarget.id)}
      />
    </main>
  );
}
