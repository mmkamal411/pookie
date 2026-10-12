"use client";

/**
 * Squad Village — "Link Ships": share your household shopping list with
 * another family, and see lists other families shared with you.
 *
 * Spaceship language: linking ships, shared cargo manifests.
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
      json.error?.message ?? "Hold position — request incomplete. Try again in a moment.",
    );
  return json.data as T;
}

const BASE = "/api/v1/shopping";

interface ShareOut {
  id: string;
  list_id: string;
  shared_with_email: string | null;
  shared_with_name: string | null;
  created_at: string;
}

interface ShareIn {
  list_id: string;
  owner_email: string | null;
  owner_name: string | null;
}

interface SharesPayload {
  shared_out: ShareOut[];
  shared_in: ShareIn[];
}

interface SharedItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  status: string;
  added_by_name: string | null;
  created_at: string;
}

interface SharedListView {
  list: { id: string; name: string; owner_name: string | null };
  items: SharedItem[];
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-living rounded-3xl p-6">
      <h2 className="text-xl font-semibold text-star-100">{title}</h2>
      <p className="mt-1 text-sm text-stardust-300">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SharedListCard({ share }: { share: ShareIn }) {
  const [view, setView] = useState<SharedListView | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<SharedListView>(
        `${BASE}/shared/list?list_id=${share.list_id}`,
      );
      setView(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the shared list.");
    }
  }, [share.list_id]);

  useEffect(() => {
    if (open && !view) load();
  }, [open, view, load]);

  const addItem = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api(`${BASE}/shared/list`, {
        method: "POST",
        body: JSON.stringify({ list_id: share.list_id, name: trimmed }),
      });
      setName("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add the item.");
    } finally {
      setBusy(false);
    }
  };

  const transition = async (item: SharedItem, status: "needed" | "claimed" | "bought") => {
    try {
      await api(`${BASE}/shared/list/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ list_id: share.list_id, status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the item.");
    }
  };

  const leave = async () => {
    if (!confirm("Leave this shared list?")) return;
    try {
      await api(`${BASE}/shares/leave`, {
        method: "POST",
        body: JSON.stringify({ list_id: share.list_id }),
      });
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not leave the list.");
    }
  };

  const ownerLabel = share.owner_name ?? share.owner_email ?? "Another family";

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-900/40 p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <p className="font-medium text-star-100">
            Linked with {ownerLabel}&rsquo;s ship
          </p>
          <p className="text-xs text-stardust-400">
            Live cargo manifest — add items, claim them, check them off
          </p>
        </div>
        <span className="text-nova-300">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {!view && <p className="text-sm text-stardust-400">Loading manifest…</p>}
          {view?.items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-xl bg-nebula-950/60 px-3 py-2"
            >
              <span className="flex-1 text-sm text-star-100">
                {item.name}
                {item.quantity ? ` × ${item.quantity}` : ""}
                {item.added_by_name && (
                  <span className="ml-2 text-xs text-stardust-400">
                    added by {item.added_by_name}
                  </span>
                )}
              </span>
              {item.status === "needed" && (
                <button
                  type="button"
                  onClick={() => transition(item, "claimed")}
                  className="rounded-lg border border-nova-400/30 px-2 py-1 text-xs text-nova-300 hover:bg-nova-500/10"
                >
                  Claim
                </button>
              )}
              {item.status === "claimed" && (
                <button
                  type="button"
                  onClick={() => transition(item, "bought")}
                  className="rounded-lg border border-emerald-400/30 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10"
                >
                  Got it
                </button>
              )}
              {item.status === "bought" && (
                <span className="text-xs text-emerald-400">✓ aboard</span>
              )}
            </div>
          ))}
          {view && view.items.length === 0 && (
            <p className="text-sm text-stardust-400">
              <span aria-hidden="true" className="mr-1.5">📦</span>
              Manifest is empty — add the first item below and it sets sail.
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addItem()}
              placeholder="Add an item to their list…"
              className="input-rooted flex-1 rounded-xl px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addItem}
              disabled={busy || !name.trim()}
              className="btn-dapple rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add"}
            </button>
          </div>
          <button
            type="button"
            onClick={leave}
            className="text-xs text-stardust-400 underline-offset-4 hover:underline"
          >
            Unlink ships
          </button>
        </div>
      )}
    </div>
  );
}

export function LinkedShipsPanel() {
  const [payload, setPayload] = useState<SharesPayload | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setPayload(await api<SharesPayload>(`${BASE}/shares`));
    } catch {
      // Sharing unavailable — panel stays hidden rather than erroring.
      setPayload({ shared_out: [], shared_in: [] });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const share = async () => {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`${BASE}/shares`, {
        method: "POST",
        body: JSON.stringify({ email: trimmed }),
      });
      setEmail("");
      setNotice(`Ships linked — ${trimmed} can now see and stock your list.`);
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not link ships. Make sure they have a Pookie account.",
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (shareId: string) => {
    if (!confirm("Unlink this ship? They will lose access to your list.")) return;
    try {
      await api(`${BASE}/shares?share_id=${shareId}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unlink.");
    }
  };

  return (
    <div className="space-y-6">
      <Panel
        title="Link Ships"
        subtitle="Share your shopping list with another family — split the Costco run, coordinate the holiday meal. Live for everyone, always."
      >
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        {notice && <p className="mb-3 text-sm text-emerald-300">{notice}</p>}
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && share()}
            placeholder="Family email to link…"
            className="input-rooted flex-1 rounded-xl px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={share}
            disabled={busy || !email.trim()}
            className="btn-dapple rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy ? "Linking…" : "Link Ships"}
          </button>
        </div>
        {payload && payload.shared_out.length > 0 && (
          <ul className="mt-4 space-y-2">
            {payload.shared_out.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-nebula-950/60 px-3 py-2"
              >
                <span className="text-sm text-star-100">
                  {s.shared_with_name ?? s.shared_with_email ?? "A family"}
                  <span className="ml-2 text-xs text-stardust-400">
                    linked {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => revoke(s.id)}
                  className="text-xs text-stardust-400 underline-offset-4 hover:text-red-300 hover:underline"
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {payload && payload.shared_in.length > 0 && (
        <Panel
          title="Linked to You"
          subtitle="Lists other families shared with you — stock them together."
        >
          <div className="space-y-3">
            {payload.shared_in.map((s) => (
              <SharedListCard key={s.list_id} share={s} />
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
