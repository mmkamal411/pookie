// W21 Mail — snap a photo → file it. Extract-then-mask is enforced server-side
// (digit runs ≥8 → ****last4 before ocr_text persists); the UI makes the
// masking visible: locked last-4 field, •••• rendering everywhere, and the
// 30-day raw-photo auto-delete shown on every card via RetentionCountdown.
//
// The killer loop: OCR extracts action items (pay bill, review document,
// follow up on a school letter) and the card surfaces them as one-tap
// buttons — "Pay $X" sends the bill to the Bill Tracker, "Remind me" drops a
// household task, "File" closes the action with a confirmation note.
"use client";

import { useEffect, useRef, useState } from "react";
import type {
  MailActionItem,
  MailClassification,
  MailItemPublic,
  MailItemStatus,
} from "@/server/mail/common";
import {
  ApiError,
  api,
  daysUntil,
  fmtDate,
  fmtMoney,
  Masked4,
  PageHeader,
  RetentionCountdown,
  TrustChip,
  WarmError,
} from "@/components/home-money/shared";

const BASE = "/api/v1/household/mail";
const BILLS_BASE = "/api/v1/household/bills";

type ActionWithSender = MailActionItem & { sender: string | null };

type View =
  | { name: "list" }
  | { name: "capture" }
  | { name: "camera" }
  | { name: "manual"; photoItemId?: string }
  | { name: "processing"; item: MailItemPublic }
  | { name: "confirm"; item: MailItemPublic; lowConfidence: boolean; actionsCreated: number; actionsEscalated: number }
  | { name: "filed"; item: MailItemPublic; note?: string };

interface OcrResult {
  accepted: boolean;
  item: MailItemPublic;
  handwritingReview: boolean;
  actionsCreated: number;
  actionsEscalated: number;
}

const FILTERS: { value: MailClassification | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "bill", label: "Bills" },
  { value: "tax", label: "Tax" },
  { value: "legal", label: "Legal" },
  { value: "insurance", label: "Insurance" },
  { value: "medical", label: "Medical" },
  { value: "school", label: "School" },
  { value: "personal", label: "Personal" },
  { value: "junk", label: "Junk" },
  { value: "other", label: "Other" },
];

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

function dueChip(dueDate: string | null): { text: string; urgent: boolean } | null {
  const d = daysUntil(dueDate);
  if (d == null) return null;
  if (d < 0) return { text: `${-d}d Overdue`, urgent: true };
  if (d === 0) return { text: "Due Today", urgent: true };
  if (d === 1) return { text: "Due Tomorrow", urgent: true };
  return { text: `Due in ${d}d`, urgent: d <= 3 };
}

/* ------------------------------------------------------------------ */
/* one extracted action → one-tap buttons                              */
/* ------------------------------------------------------------------ */

function ActionRow({
  itemId,
  action,
  showDetail = true,
  onResolved,
  setNote,
}: {
  itemId: string;
  action: MailActionItem;
  showDetail?: boolean;
  onResolved: (a: MailActionItem) => void;
  setNote: (n: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const chip = dueChip(action.due_date);

  const finish = async (
    key: string,
    msg: string,
    req: () => Promise<{ action: MailActionItem }>,
  ) => {
    setBusy(key);
    try {
      const { action: updated } = await req();
      onResolved(updated);
      setNote(msg);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't do that — try again.");
    } finally {
      setBusy(null);
    }
  };

  const pay = () =>
    finish("pay", "Sent to Bills ✓ — it's tracked as unpaid there now.", () =>
      api<{ bill: unknown; action: MailActionItem }>(
        `${BASE}/${itemId}/actions/${action.id}/bill`,
        { method: "POST", body: "{}" },
      ),
    );
  const remind = () =>
    finish("remind", "Reminder created ✓ — it's in your household tasks.", () =>
      api<{ task: unknown; action: MailActionItem }>(
        `${BASE}/${itemId}/actions/${action.id}/task`,
        { method: "POST", body: "{}" },
      ),
    );
  const file = () =>
    finish("file", "Filed ✓ — the details stay in your Mail file.", () =>
      api<{ action: MailActionItem }>(`${BASE}/${itemId}/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done", resolution_note: "Filed from Mail." }),
      }),
    );
  const snooze = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return finish("snooze", "Snoozed ✓ — I'll nudge you again in 3 days.", () =>
      api<{ action: MailActionItem }>(`${BASE}/${itemId}/actions/${action.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "snoozed", reminder_at: d.toISOString() }),
      }),
    );
  };

  const btnPrimary =
    "btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50";
  const btnGhost =
    "rounded-lg border border-nebula-700 px-3 py-1.5 text-sm text-stardust-300 hover:border-nova-500 disabled:opacity-50";

  return (
    <div className="rounded-xl border border-nebula-700/70 bg-nebula-900/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-star-100">{action.title}</p>
        {chip && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              chip.urgent
                ? "bg-aurum-400/15 text-aurum-200"
                : "bg-nebula-800 text-stardust-300"
            }`}
          >
            {chip.text}
          </span>
        )}
      </div>
      {showDetail && action.detail && (
        <p className="mt-1 text-xs leading-relaxed text-stardust-400">{action.detail}</p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {action.kind === "pay" ? (
          <button onClick={pay} disabled={busy != null} className={btnPrimary}>
            {busy === "pay"
              ? "Sending…"
              : `Pay ${fmtMoney(action.amount)} → Bills`}
          </button>
        ) : (
          <button onClick={remind} disabled={busy != null} className={btnPrimary}>
            {busy === "remind" ? "Saving…" : "Remind Me"}
          </button>
        )}
        {action.kind !== "pay" && (
          <button onClick={snooze} disabled={busy != null} className={btnGhost}>
            {busy === "snooze" ? "Saving…" : "Snooze 3 Days"}
          </button>
        )}
        {action.kind === "pay" && (
          <button onClick={remind} disabled={busy != null} className={btnGhost}>
            {busy === "remind" ? "Saving…" : "Remind Me"}
          </button>
        )}
        <button onClick={file} disabled={busy != null} className={btnGhost}>
          {busy === "file" ? "Saving…" : "File"}
        </button>
      </div>
    </div>
  );
}

function ActionsPanel({
  itemId,
  actions,
  onResolved,
}: {
  itemId: string;
  actions: MailActionItem[];
  onResolved: (a: MailActionItem) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const open = actions.filter((a) => a.status === "open" || a.status === "snoozed");
  if (open.length === 0) return null;
  return (
    <div className="mt-3 rounded-xl border border-nova-600/30 bg-nebula-950/60 p-3">
      <p className="text-xs font-semibold tracking-widest text-nova-300">
        ✦ WHAT WE PULLED OUT
      </p>
      {note && <p className="mt-1.5 text-xs text-nova-200">{note}</p>}
      <div className="mt-2 space-y-2">
        {open.map((a) => (
          <ActionRow
            key={a.id}
            itemId={itemId}
            action={a}
            onResolved={onResolved}
            setNote={setNote}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* mail card                                                           */
/* ------------------------------------------------------------------ */

function MailCard({
  item,
  actions,
  onChanged,
  onResolved,
}: {
  item: MailItemPublic;
  actions: MailActionItem[];
  onChanged: (item: MailItemPublic) => void;
  onResolved: (a: MailActionItem) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [purgedNote, setPurgedNote] = useState(false);
  const overdue =
    item.due_date != null && item.due_date < new Date().toISOString().slice(0, 10);

  const setStatus = async (status: MailItemStatus) => {
    setBusy(status);
    try {
      const data = await api<{ item: MailItemPublic }>(`${BASE}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      onChanged(data.item);
    } catch {
      /* warm inline note below */
    } finally {
      setBusy(null);
    }
  };

  const deleteNow = async () => {
    setBusy("purge");
    try {
      const data = await api<{ item: MailItemPublic }>(
        `${BASE}/${item.id}/photo-delete`,
        { method: "POST", body: "{}" },
      );
      onChanged(data.item);
      setPurgedNote(true);
      window.setTimeout(() => setPurgedNote(false), 6000);
    } catch {
      /* stays honest: countdown remains */
    } finally {
      setBusy(null);
    }
  };

  const hasPhoto = !!item.photo_path && !item.photo_purged_at;
  const isBill = item.classification === "bill";

  /** One-tap "Pay → Bills": creates the Bill Tracker row, marks the item
   *  filed, and resolves any open pay actions — "Pay this" never just
   *  marks done without a bill existing. */
  const payItem = async () => {
    setBusy("pay-item");
    try {
      const sender = item.sender ?? "Bill";
      const amount = item.amount != null ? Number(item.amount) : null;
      await api(BILLS_BASE, {
        method: "POST",
        body: JSON.stringify({
          name: `Pay ${sender}`,
          payee: sender,
          amount: amount != null && amount > 0 ? amount : undefined,
          due_date: item.due_date ?? undefined,
          recurrence: "once",
          category: "mail",
          status: "unpaid",
          notes: `From scanned mail${
            item.account_last4 ? ` · •••• ${item.account_last4}` : ""
          }`,
        }),
      });
      for (const a of actions.filter(
        (x) => x.kind === "pay" && (x.status === "open" || x.status === "snoozed"),
      )) {
        try {
          const { action: updated } = await api<{ action: MailActionItem }>(
            `${BASE}/${item.id}/actions/${a.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                status: "done",
                resolution_note: "Added to Bills from the mail card.",
              }),
            },
          );
          onResolved(updated);
        } catch {
          /* the bill already exists — the action can wait */
        }
      }
      await setStatus("actioned");
    } catch {
      /* warm error stays on the card via the busy reset */
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className={`animate-bloom rounded-2xl border bg-nebula-900/80 p-4 ${
        overdue
          ? "border-aurum-400/50 shadow-sun-warm"
          : "border-nova-600/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-star-100">
            {item.sender ?? "Untitled mail"}
          </p>
          <p className="mt-0.5 text-sm text-stardust-300">
            {fmtMoney(item.amount)}
            {item.due_date && (
              <span className={overdue ? "text-aurum-200" : undefined}>
                {" "}· Due {fmtDate(item.due_date)}
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-stardust-400">
            (<Masked4 last4={item.account_last4} />)
          </p>
        </div>
        {item.classification && (
          <span className="shrink-0 rounded-full bg-nebula-800 px-2 py-0.5 text-[10px] tracking-wide text-nova-300 capitalize">
            {item.classification}
          </span>
        )}
      </div>

      <ActionsPanel itemId={item.id} actions={actions} onResolved={onResolved} />

      <div className="mt-3 space-y-2">
        {hasPhoto && item.auto_delete_at ? (
          <RetentionCountdown
            label="Raw photo"
            startsAt={item.created_at}
            endsAt={item.auto_delete_at}
            onDeleteNow={deleteNow}
            deleting={busy === "purge"}
          />
        ) : item.photo_purged_at ? (
          <RetentionCountdown label="Raw photo" purged />
        ) : (
          <p className="text-[11px] text-stardust-500">
            No photo attached — nothing to auto-delete. The details stay in your file.
          </p>
        )}
        {purgedNote && (
          <p className="text-xs text-nova-300">
            Gone. The extracted details stay in your Mail file.
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.status !== "actioned" && isBill && (
          <button
            onClick={payItem}
            disabled={busy != null}
            className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy === "pay-item" ? "Sending…" : "Pay → Bills"}
          </button>
        )}
        {item.status !== "actioned" && !isBill && (
          <button
            onClick={() => setStatus("actioned")}
            disabled={busy != null}
            className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy === "actioned" ? "Saving…" : "Mark done"}
          </button>
        )}
        {item.status !== "actioned" && isBill && (
          <button
            onClick={() => setStatus("actioned")}
            disabled={busy != null}
            className="rounded-lg border border-nebula-700 px-3 py-1.5 text-sm text-stardust-300 hover:border-nova-500 disabled:opacity-50"
          >
            Just file it
          </button>
        )}
        {item.status !== "dismissed" && (
          <button
            onClick={() => setStatus("dismissed")}
            disabled={busy != null}
            className="rounded-lg border border-nebula-700 px-3 py-1.5 text-sm text-stardust-300 hover:border-nova-500 disabled:opacity-50"
          >
            {busy === "dismissed" ? "Saving…" : "Dismiss"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* collapsible section                                                 */
/* ------------------------------------------------------------------ */

function Collapsible({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: number;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-8">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-nova-300 capitalize">
          {title}
          <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300 shadow-glow-sm">
            {count}
          </span>
        </span>
        <span aria-hidden="true" className={`text-nova-300 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* up next — open actions due within 7 days, one-tap actionable         */
/* ------------------------------------------------------------------ */

function UpNext({
  actions,
  onResolved,
}: {
  actions: ActionWithSender[];
  onResolved: (a: MailActionItem) => void;
}) {
  const [note, setNote] = useState<string | null>(null);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 7);
  const soon = actions
    .filter((a) => a.due_date && a.due_date <= horizon.toISOString().slice(0, 10))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))
    .slice(0, 5);
  if (soon.length === 0) return null;
  return (
    <section className="mt-6 rounded-2xl border border-aurum-400/30 bg-nebula-900/70 p-4">
      <p className="text-xs font-semibold tracking-widest text-aurum-200">
        ⏰ DUE SOON
      </p>
      <p className="mt-0.5 text-xs text-stardust-400">
        Your mail says these need attention in the next 7 days.
      </p>
      {note && <p className="mt-2 text-xs text-nova-200">{note}</p>}
      <div className="mt-3 space-y-2">
        {soon.map((a) => (
          <ActionRow
            key={a.id}
            itemId={a.mail_item_id}
            action={a}
            showDetail={false}
            onResolved={onResolved}
            setNote={setNote}
          />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function MailBoard() {
  const [view, setView] = useState<View>({ name: "list" });
  const [items, setItems] = useState<MailItemPublic[] | null>(null);
  const [actionsByItem, setActionsByItem] = useState<Record<string, MailActionItem[]>>({});
  const [filter, setFilter] = useState<MailClassification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async (cls: MailClassification | null) => {
    setError(null);
    setForbidden(false);
    try {
      const q = cls ? `?classification=${cls}` : "";
      const [itemData, actionData] = await Promise.all([
        api<{ items: MailItemPublic[] }>(`${BASE}${q}`),
        api<{ actions: ActionWithSender[] }>(`${BASE}/actions?scope=open`),
      ]);
      setItems(itemData.items);
      const map: Record<string, MailActionItem[]> = {};
      for (const a of actionData.actions) {
        (map[a.mail_item_id] ??= []).push(a);
      }
      setActionsByItem(map);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PARENT_ROLE_REQUIRED") {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
      }
    }
  };

  useEffect(() => {
    load(filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const upsert = (item: MailItemPublic) =>
    setItems((prev) => {
      if (!prev) return [item];
      const found = prev.some((i) => i.id === item.id);
      return found ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
    });

  /** A resolved action leaves the open list (ledger-like — nothing is deleted). */
  const onResolved = (updated: MailActionItem) =>
    setActionsByItem((prev) => {
      const arr = prev[updated.mail_item_id] ?? [];
      const next = arr.filter((a) => a.id !== updated.id);
      return { ...prev, [updated.mail_item_id]: next };
    });

  const onFile = async (file: File) => {
    const form = new FormData();
    form.append("photo", file);
    const started = Date.now();
    try {
      const data = await api<{ item: MailItemPublic }>(BASE, {
        method: "POST",
        body: form,
      });
      setView({ name: "processing", item: data.item });
      // Honest steps around the real OCR call.
      setSteps(["Photo captured", "Finding the amount and due date…"]);
      const elapsed = Date.now() - started;
      if (elapsed < 600) await new Promise((r) => setTimeout(r, 600 - elapsed));
      let ocr: OcrResult;
      try {
        ocr = await api<OcrResult>(`${BASE}/${data.item.id}/ocr`, {
          method: "POST",
          body: "{}",
        });
      } catch (e) {
        if (e instanceof ApiError && e.code === "UPSTREAM_UNAVAILABLE") {
          // Vendor unavailable — drop to manual entry with the photo attached.
          setView({ name: "manual", photoItemId: data.item.id });
          setItems((prev) => (prev ? [data.item, ...prev] : [data.item]));
          return;
        }
        throw e;
      }
      setSteps(["Photo captured", "Finding the amount and due date", "Masking account numbers"]);
      await new Promise((r) => setTimeout(r, 400));
      upsert(ocr.item);
      setView({
        name: "confirm",
        item: ocr.item,
        lowConfidence: ocr.handwritingReview,
        actionsCreated: ocr.actionsCreated,
        actionsEscalated: ocr.actionsEscalated,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
      setView({ name: "list" });
    }
  };

  const onManual = async (fields: { sender: string; amount: string; dueDate: string }, photoItemId?: string) => {
    setError(null);
    try {
      if (photoItemId) {
        // Photo already filed; this is the fallback confirm-edit path.
        const data = await api<{ item: MailItemPublic }>(`${BASE}/${photoItemId}`, {
          method: "PATCH",
          body: JSON.stringify({
            sender: fields.sender || null,
            amount: fields.amount ? Number(fields.amount) : null,
            due_date: fields.dueDate || null,
          }),
        });
        upsert(data.item);
        setView({ name: "filed", item: data.item });
        return;
      }
      const form = new FormData();
      form.append("sender", fields.sender);
      if (fields.amount) form.append("amount", fields.amount);
      if (fields.dueDate) form.append("due_date", fields.dueDate);
      const data = await api<{ item: MailItemPublic }>(BASE, {
        method: "POST",
        body: form,
      });
      upsert(data.item);
      setView({ name: "filed", item: data.item });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    }
  };

  const onConfirm = async (
    item: MailItemPublic,
    fields: { sender: string; amount: string; dueDate: string },
  ) => {
    setError(null);
    try {
      const data = await api<{ item: MailItemPublic }>(`${BASE}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "actioned",
          sender: fields.sender || null,
          amount: fields.amount ? Number(fields.amount) : null,
          due_date: fields.dueDate || null,
        }),
      });
      upsert(data.item);
      setView({ name: "filed", item: data.item });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    }
  };

  /** Confirm-screen "Pay → Bills": bill first, then filed — the action panel
   *  can still pay later if the user skips this step. */
  const onConfirmPay = async (
    item: MailItemPublic,
    fields: { sender: string; amount: string; dueDate: string },
  ) => {
    setError(null);
    try {
      const sender = fields.sender.trim() || item.sender || "Bill";
      const amount = fields.amount ? Number(fields.amount) : null;
      await api(BILLS_BASE, {
        method: "POST",
        body: JSON.stringify({
          name: `Pay ${sender}`,
          payee: sender,
          amount: amount != null && amount > 0 ? amount : undefined,
          due_date: fields.dueDate || undefined,
          recurrence: "once",
          category: "mail",
          status: "unpaid",
          notes: `From scanned mail${
            item.account_last4 ? ` · •••• ${item.account_last4}` : ""
          }`,
        }),
      });
      // Resolve any open pay actions this bill settles.
      for (const a of (actionsByItem[item.id] ?? []).filter(
        (x) => x.kind === "pay" && (x.status === "open" || x.status === "snoozed"),
      )) {
        try {
          const { action: updated } = await api<{ action: MailActionItem }>(
            `${BASE}/${item.id}/actions/${a.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                status: "done",
                resolution_note: "Added to Bills from the confirm screen.",
              }),
            },
          );
          onResolved(updated);
        } catch {
          /* the bill exists — the action can wait for the card */
        }
      }
      const data = await api<{ item: MailItemPublic }>(`${BASE}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "actioned",
          sender: fields.sender || null,
          amount: fields.amount ? Number(fields.amount) : null,
          due_date: fields.dueDate || null,
        }),
      });
      upsert(data.item);
      setView({ name: "filed", item: data.item, note: "Added to Bills — tracked as unpaid there." });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
    }
  };

  /* ------------------------------- views ------------------------------ */

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="🏠 Home" icon="✉️" title="Mail" subtitle="What landed at your door." back />
        <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
          <p className="text-sm text-stardust-300">
            Mail is a parent space — physical mail carries the whole household&apos;s
            private details, so only parents can open it here.
          </p>
        </div>
      </main>
    );
  }

  if (items == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-center text-sm text-stardust-300">
          {error ?? "Reading your mail…"}
        </p>
        {error && <div className="mt-4"><WarmError message={error} onRetry={() => load(filter)} /></div>}
      </main>
    );
  }

  const actionNeeded = items.filter((i) => i.status === "new" || i.status === "triaged");
  const filed = items.filter((i) => i.status === "actioned" || i.status === "dismissed");
  const dueSoon: ActionWithSender[] = Object.values(actionsByItem)
    .flat()
    .map((a) => ({ ...a, sender: null }));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {view.name === "list" && (
        <>
          <PageHeader
            eyebrow="🏠 Home"
            icon="✉️"
            title="Mail"
            subtitle="Snap it. We pull out what matters."
          />
          <div className="mt-4">
            <TrustChip>
              <span className="font-medium text-star-100">We never keep full account numbers.</span>
              <br />
              We read the last 4 digits only — and the raw photo deletes itself within 30 days.
            </TrustChip>
          </div>
          <button
            onClick={() => setView({ name: "capture" })}
            className="btn-dapple mt-4 w-full rounded-2xl px-5 py-3 text-base font-semibold text-nebula-950"
          >
            📷 Scan new mail
          </button>
          {error && (
            <div className="mt-4">
              <WarmError message={error} onRetry={() => load(filter)} />
            </div>
          )}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter mail by type">
            {FILTERS.map((f) => (
              <button
                key={f.label}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  filter === f.value
                    ? "bg-nova-500/20 text-star-100 ring-1 ring-nova-500"
                    : "bg-nebula-900/80 text-stardust-300 ring-1 ring-nebula-700 hover:ring-nova-500/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-8 text-center">
              <p aria-hidden="true" className="text-3xl">📬</p>
              <p className="text-sunlit mt-3 text-base font-semibold">
                {filter ? `No ${filter} mail filed yet` : "No mail filed yet"}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
                Snap a bill, a notice, anything with a due date — we&apos;ll pull out what matters.
              </p>
              <button
                onClick={() => setView({ name: "capture" })}
                className="btn-dapple mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-nebula-950"
              >
                Scan your first piece
              </button>
            </div>
          ) : (
            <>
              <UpNext actions={dueSoon} onResolved={onResolved} />
              <Collapsible title="📬 Action needed" count={actionNeeded.length} defaultOpen>
                {actionNeeded.length === 0 && (
                  <p className="text-sm text-stardust-500">All caught up — nothing needs action.</p>
                )}
                {actionNeeded.map((i) => (
                  <MailCard
                    key={i.id}
                    item={i}
                    actions={actionsByItem[i.id] ?? []}
                    onChanged={upsert}
                    onResolved={onResolved}
                  />
                ))}
              </Collapsible>
              <Collapsible title="🗂️ Filed" count={filed.length} defaultOpen={false}>
                {filed.length === 0 && (
                  <p className="text-sm text-stardust-500">Nothing filed yet.</p>
                )}
                {filed.map((i) => (
                  <MailCard
                    key={i.id}
                    item={i}
                    actions={actionsByItem[i.id] ?? []}
                    onChanged={upsert}
                    onResolved={onResolved}
                  />
                ))}
              </Collapsible>
            </>
          )}
        </>
      )}

      {view.name === "capture" && (
        <CaptureScreen
          fileRef={fileRef}
          onCamera={() => setView({ name: "camera" })}
          onManual={() => setView({ name: "manual" })}
          onBack={() => setView({ name: "list" })}
        />
      )}

      {view.name === "camera" && (
        <CameraCapture
          onCapture={onFile}
          onManual={() => setView({ name: "manual" })}
          onBack={() => setView({ name: "capture" })}
        />
      )}

      {view.name === "manual" && (
        <ManualScreen
          photoItemId={view.photoItemId}
          onSubmit={(f) => onManual(f, view.photoItemId)}
          onBack={() => setView({ name: "list" })}
        />
      )}

      {view.name === "processing" && <ProcessingScreen steps={steps} />}

      {view.name === "confirm" && (
        <ConfirmScreen
          item={view.item}
          lowConfidence={view.lowConfidence}
          actionsCreated={view.actionsCreated}
          actionsEscalated={view.actionsEscalated}
          onSubmit={(f) => onConfirm(view.item, f)}
          onPay={(f) => onConfirmPay(view.item, f)}
          onRetake={() => setView({ name: "capture" })}
        />
      )}

      {view.name === "filed" && (
        <FiledScreen
          item={view.item}
          note={view.note}
          onScanAnother={() => setView({ name: "capture" })}
          onBack={() => setView({ name: "list" })}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* capture — guidance FIRST, before the shutter                        */
/* ------------------------------------------------------------------ */

function CaptureScreen({
  fileRef,
  onCamera,
  onManual,
  onBack,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onCamera: () => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const tips = [
    { icon: "🖼️", text: "Lay it flat — fill the frame with the bill or letter." },
    { icon: "💡", text: "Good light beats flash. In low light, tap the ⚡ on the camera screen." },
    { icon: "🫣", text: "Cover the full account number with a finger — we only need the last 4." },
  ];
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="✉️ Mail" icon="📷" title="Before You Snap It" subtitle="Cover the full number — we only need the last 4." />
      <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/80 p-6 text-center">
        <div
          className="relative mx-auto max-w-xs rounded-2xl border-2 border-dashed border-nova-500/50 bg-nebula-950 p-6"
          style={{ boxShadow: "0 0 32px rgb(52 211 153 / 0.15)" }}
        >
          <span aria-hidden="true" className="absolute top-2 left-2 text-nova-300">┌</span>
          <span aria-hidden="true" className="absolute top-2 right-2 text-nova-300">┐</span>
          <span aria-hidden="true" className="absolute bottom-2 left-2 text-nova-300">└</span>
          <span aria-hidden="true" className="absolute right-2 bottom-2 text-nova-300">┘</span>
          <p className="text-xs tracking-widest text-stardust-500 capitalize">Bill</p>
          <p className="mt-2 font-mono text-lg text-stardust-200">👆 •••• 4821</p>
          <p className="mt-1 text-lg font-semibold text-star-100">$84.12</p>
        </div>
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
          {tips.map((t) => (
            <li key={t.text} className="flex items-start gap-2.5 text-sm text-stardust-300">
              <span aria-hidden="true" className="mt-0.5 shrink-0">{t.icon}</span>
              <span>{t.text}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={onCamera}
          className="btn-dapple rounded-2xl px-5 py-3 text-base font-semibold text-nebula-950"
        >
          Open Camera
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-2xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
          >
            Choose a Photo
          </button>
          <button
            onClick={onManual}
            className="flex-1 rounded-2xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
          >
            Type It In Instead
          </button>
        </div>
      </div>
      <button onClick={onBack} className="mt-3 text-sm text-stardust-400 underline">
        Back to Mail
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* in-app camera — guides, flash control, retake                       */
/* ------------------------------------------------------------------ */

function CameraCapture({
  onCapture,
  onManual,
  onBack,
}: {
  onCapture: (file: File) => void;
  onManual: () => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fallbackRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torch, setTorch] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let s: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play().catch(() => {});
        }
        const track = s.getVideoTracks()[0];
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean };
        setTorchSupported(!!caps.torch);
      } catch {
        if (!cancelled) setDenied(true);
      }
    })();
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleTorch = async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch }] as never });
      setTorch((t) => !t);
    } catch {
      /* this device reports torch but won't take it — stay honest */
    }
  };

  const snap = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(new File([blob], `mail-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="✉️ Mail" icon="📷" title="Line It Up" subtitle="Fill the frame, then tap the shutter." />
      {denied ? (
        <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/80 p-6 text-center">
          <p aria-hidden="true" className="text-3xl">🚫</p>
          <p className="text-sunlit mt-3 text-base font-semibold">Camera unavailable</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
            This browser said no to the camera. Choose a photo from your library
            instead — same result.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => fallbackRef.current?.click()}
              className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
            >
              Choose a Photo
            </button>
            <button
              onClick={onManual}
              className="flex-1 rounded-xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
            >
              Type It In
            </button>
          </div>
          <input
            ref={fallbackRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-hidden="true"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCapture(f);
              e.target.value = "";
            }}
          />
        </div>
      ) : (
        <div className="mt-4">
          <div className="relative overflow-hidden rounded-2xl border border-nova-600/40 bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              aria-label="Camera preview"
              className="aspect-[3/4] w-full object-cover"
            />
            {/* guides */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-6">
              <span className="absolute top-0 left-0 text-2xl text-nova-300 drop-shadow">┌</span>
              <span className="absolute top-0 right-0 text-2xl text-nova-300 drop-shadow">┐</span>
              <span className="absolute bottom-0 left-0 text-2xl text-nova-300 drop-shadow">└</span>
              <span className="absolute right-0 bottom-0 text-2xl text-nova-300 drop-shadow">┘</span>
            </div>
            <p className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs text-star-100/90 drop-shadow">
              Keep the whole document inside the corners
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={onBack}
              className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300 hover:border-nova-500"
            >
              Cancel
            </button>
            <button
              onClick={snap}
              aria-label="Take the photo"
              className="btn-dapple flex h-16 w-16 items-center justify-center rounded-full text-2xl text-nebula-950"
            >
              📷
            </button>
            {torchSupported ? (
              <button
                onClick={toggleTorch}
                aria-pressed={torch}
                className={`rounded-xl border px-4 py-2.5 text-sm ${
                  torch
                    ? "border-nova-500 bg-nova-500/15 text-star-100 shadow-glow-sm"
                    : "border-nebula-700 text-stardust-300"
                }`}
              >
                ⚡ {torch ? "On" : "Off"}
              </button>
            ) : (
              <span className="w-[86px] text-center text-[11px] text-stardust-500">
                No flash control on this device
              </span>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-stardust-500">
            Cover the full account number — we only need the last 4.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* manual entry — the fully-working primary path                        */
/* ------------------------------------------------------------------ */

function ManualScreen({
  photoItemId,
  onSubmit,
  onBack,
}: {
  photoItemId?: string;
  onSubmit: (f: { sender: string; amount: string; dueDate: string }) => void;
  onBack: () => void;
}) {
  const [sender, setSender] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="✉️ Mail"
        icon="✍️"
        title={photoItemId ? "Type What You See" : "Type It In"}
        subtitle={photoItemId ? "The photo didn't read cleanly — your eyes do the job in 20 seconds." : "No camera needed. Takes 20 seconds."}
      />
      <div className="mt-6 space-y-3 rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
        <label className="block text-xs font-medium text-stardust-300">
          Who is it from?
          <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Electric Co." className={`${inputCls} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-stardust-300">
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="84.12" inputMode="decimal" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-stardust-300">
            Due date
            <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={`${inputCls} mt-1`} />
          </label>
        </div>
        <p className="text-xs text-stardust-500">
          Last 4 of the account, if it&apos;s on there — never the full number.
        </p>
        <button
          onClick={() => onSubmit({ sender, amount, dueDate })}
          disabled={!sender.trim() && !amount && !dueDate}
          className="btn-dapple w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
        >
          File it
        </button>
      </div>
      <button onClick={onBack} className="mt-3 text-sm text-stardust-400 underline">
        Back to Mail
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* processing — real steps, not a spinner                              */
/* ------------------------------------------------------------------ */

function ProcessingScreen({ steps }: { steps: string[] }) {
  const all = ["Photo captured", "Finding the amount and due date", "Masking account numbers"];
  return (
    <div className="animate-rise mx-auto max-w-md py-10 text-center">
      <div
        aria-hidden="true"
        className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-nova-500/20 border-t-nova-300"
        style={{ boxShadow: "0 0 24px rgb(52 211 153 / 0.25)" }}
      />
      <h2 className="text-sunlit mt-4 text-xl font-semibold">Reading your mail…</h2>
      <ul className="mt-6 space-y-2 text-left">
        {all.map((s) => {
          const done = steps.some((x) => x.startsWith(s));
          const active = !done && steps.length > 0;
          return (
            <li key={s} className="flex items-center gap-3 text-sm">
              <span aria-hidden="true" className={done ? "text-nova-300" : "text-stardust-500"}>
                {done ? "✓" : active ? "◌" : "○"}
              </span>
              <span className={done ? "text-stardust-100" : "text-stardust-400"}>{s}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-xs text-stardust-500">
        Your photo stays on this screen until we finish — then only the details are kept.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* confirm — edit extracted fields; account is locked                   */
/* ------------------------------------------------------------------ */

function ConfirmScreen({
  item,
  lowConfidence,
  actionsCreated,
  actionsEscalated,
  onSubmit,
  onPay,
  onRetake,
}: {
  item: MailItemPublic;
  lowConfidence: boolean;
  actionsCreated: number;
  actionsEscalated: number;
  onSubmit: (f: { sender: string; amount: string; dueDate: string }) => void;
  onPay: (f: { sender: string; amount: string; dueDate: string }) => void;
  onRetake: () => void;
}) {
  const [sender, setSender] = useState(item.sender ?? "");
  const [amount, setAmount] = useState(item.amount != null ? String(Number(item.amount)) : "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const isBill = item.classification === "bill";
  const warn = lowConfidence ? "border-aurum-400/70" : "border-nebula-700";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="✉️ Mail" icon="🔍" title="Here's What We Found" subtitle="Fix anything — the account number stays locked." />
      {lowConfidence && (
        <p className="mt-3 rounded-xl border border-aurum-400/40 bg-nebula-800/70 p-3 text-xs text-aurum-200">
          Some of this was hard to read — fields with an amber edge need a double-check.
        </p>
      )}
      {actionsEscalated > 0 && (
        <p className="mt-3 rounded-xl border border-aurum-400/40 bg-nebula-800/70 p-3 text-xs text-aurum-200">
          Second notice — we escalated the action we already had for this sender.
        </p>
      )}
      {actionsCreated > 0 && (
        <p className="mt-3 rounded-xl border border-nova-600/40 bg-nebula-800/70 p-3 text-xs text-nova-200">
          ✦ We pulled out {actionsCreated === 1 ? "1 thing to do" : `${actionsCreated} things to do`} —
          {isBill ? " pay it from the card below, or send it to Bills right now." : " you'll find it on the card, one tap away."}
        </p>
      )}
      <div className="mt-4 space-y-3 rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
        <label className="block text-xs font-medium text-stardust-300">
          Payee
          <input value={sender} onChange={(e) => setSender(e.target.value)} className={`${inputCls} ${warn} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-stardust-300">
            Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" className={`${inputCls} ${warn} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-stardust-300">
            Due date
            <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" className={`${inputCls} ${warn} mt-1`} />
          </label>
        </div>
        <div className="rounded-lg border border-nebula-700 bg-nebula-950/60 px-3 py-2">
          <p className="text-xs text-stardust-400">
            Account <Masked4 last4={item.account_last4} /> · last 4 only — locked.{" "}
            <span className="text-stardust-500">We never hold the full number.</span>
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {isBill ? (
            <button
              onClick={() => run("pay", async () => { onPay({ sender, amount, dueDate }); })}
              disabled={busy != null}
              className="btn-dapple w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy === "pay" ? "Sending…" : "Pay This → Bills"}
            </button>
          ) : (
            <button
              onClick={() => run("file", async () => { onSubmit({ sender, amount, dueDate }); })}
              disabled={busy != null}
              className="btn-dapple w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {busy === "file" ? "Filing…" : "Looks Right — File It"}
            </button>
          )}
          {isBill && (
            <button
              onClick={() => run("file", async () => { onSubmit({ sender, amount, dueDate }); })}
              disabled={busy != null}
              className="w-full rounded-xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500 disabled:opacity-50"
            >
              {busy === "file" ? "Filing…" : "Just File It (No Bill)"}
            </button>
          )}
          <button
            onClick={onRetake}
            disabled={busy != null}
            className="w-full rounded-xl px-5 py-2 text-sm text-stardust-400 underline disabled:opacity-50"
          >
            Retake photo
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* filed confirmation                                                  */
/* ------------------------------------------------------------------ */

function FiledScreen({
  item,
  note,
  onScanAnother,
  onBack,
}: {
  item: MailItemPublic;
  note?: string;
  onScanAnother: () => void;
  onBack: () => void;
}) {
  const hasPhoto = !!item.photo_path && !item.photo_purged_at;
  return (
    <div className="animate-bloom mx-auto max-w-md py-8 text-center">
      <div
        aria-hidden="true"
        className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-nova-500/40 bg-nebula-900 text-2xl"
        style={{ boxShadow: "0 0 32px rgb(52 211 153 / 0.35)" }}
      >
        ✓
      </div>
      <h2 className="text-sunlit mt-4 text-xl font-semibold">Filed.</h2>
      <p className="mt-1 text-sm text-stardust-300">
        {item.sender ? `The ${item.sender} mail` : "Your mail"} is in your Mail file
        {item.due_date ? `, due ${fmtDate(item.due_date)}` : ""}.
      </p>
      {note && (
        <p className="mx-auto mt-2 max-w-sm rounded-xl border border-nova-600/40 bg-nebula-800/70 px-3 py-2 text-xs text-nova-200">
          {note}
        </p>
      )}
      <div className="mt-5 text-left">
        {hasPhoto && item.auto_delete_at ? (
          <RetentionCountdown
            label="This photo"
            startsAt={item.created_at}
            endsAt={item.auto_delete_at}
          />
        ) : (
          <p className="rounded-xl border border-nebula-700 bg-nebula-950/60 px-3 py-2 text-xs text-stardust-400">
            No photo attached — nothing to auto-delete.
          </p>
        )}
      </div>
      <div className="mt-5 flex gap-2">
        <button
          onClick={onScanAnother}
          className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
        >
          Scan another
        </button>
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
        >
          Back to Mail
        </button>
      </div>
    </div>
  );
}
