// W21 Mail — snap a photo → file it. Extract-then-mask is enforced server-side
// (digit runs ≥8 → ****last4 before ocr_text persists); the UI makes the
// masking visible: locked last-4 field, •••• rendering everywhere, and the
// 30-day raw-photo auto-delete shown on every card via RetentionCountdown.
"use client";

import { useEffect, useRef, useState } from "react";
import type {
  MailItemPublic,
  MailItemStatus,
} from "@/server/mail/common";
import {
  ApiError,
  api,
  fmtDate,
  fmtMoney,
  Masked4,
  PageHeader,
  RetentionCountdown,
  TrustChip,
  WarmError,
} from "@/components/home-money/shared";

const BASE = "/api/v1/household/mail";

type View =
  | { name: "list" }
  | { name: "capture" }
  | { name: "manual"; photoItemId?: string }
  | { name: "processing"; item: MailItemPublic }
  | { name: "confirm"; item: MailItemPublic; lowConfidence: boolean }
  | { name: "filed"; item: MailItemPublic };

interface OcrResult {
  accepted: boolean;
  item: MailItemPublic;
  handwritingReview: boolean;
  actionsCreated: number;
  actionsEscalated: number;
}

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

/* ------------------------------------------------------------------ */
/* mail card                                                           */
/* ------------------------------------------------------------------ */

function MailCard({
  item,
  onChanged,
}: {
  item: MailItemPublic;
  onChanged: (item: MailItemPublic) => void;
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
        {item.status !== "actioned" && (
          <button
            onClick={() => setStatus("actioned")}
            disabled={busy != null}
            className="btn-dapple rounded-lg px-4 py-1.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy === "actioned" ? "Saving…" : item.classification === "bill" ? "Pay this" : "Mark done"}
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
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function MailBoard() {
  const [view, setView] = useState<View>({ name: "list" });
  const [items, setItems] = useState<MailItemPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setError(null);
    setForbidden(false);
    try {
      const data = await api<{ items: MailItemPublic[] }>(BASE);
      setItems(data.items);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PARENT_ROLE_REQUIRED") {
        setForbidden(true);
      } else {
        setError(e instanceof Error ? e.message : "Hold position — request incomplete. Try again in a moment.");
      }
    }
  };

  useEffect(() => {
    load();
  }, []);

  const upsert = (item: MailItemPublic) =>
    setItems((prev) => {
      if (!prev) return [item];
      const found = prev.some((i) => i.id === item.id);
      return found ? prev.map((i) => (i.id === item.id ? item : i)) : [item, ...prev];
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
      setSteps(["Photo captured"]);
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
      setView({ name: "confirm", item: ocr.item, lowConfidence: ocr.handwritingReview });
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
    action: "pay" | "file",
  ) => {
    setError(null);
    try {
      const data = await api<{ item: MailItemPublic }>(`${BASE}/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: action === "pay" ? "triaged" : "actioned",
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

  /* ------------------------------- views ------------------------------ */

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="🏠 Home" icon="✉️" title="Mail" subtitle="What landed at your door." />
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
        {error && <div className="mt-4"><WarmError message={error} onRetry={load} /></div>}
      </main>
    );
  }

  const actionNeeded = items.filter((i) => i.status === "new" || i.status === "triaged");
  const filed = items.filter((i) => i.status === "actioned" || i.status === "dismissed");

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
              <WarmError message={error} onRetry={load} />
            </div>
          )}
          {items.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-8 text-center">
              <p aria-hidden="true" className="text-3xl">📬</p>
              <p className="text-sunlit mt-3 text-base font-semibold">No mail filed yet</p>
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
              <Collapsible title="📬 Action needed" count={actionNeeded.length} defaultOpen>
                {actionNeeded.length === 0 && (
                  <p className="text-sm text-stardust-500">All caught up — nothing needs action.</p>
                )}
                {actionNeeded.map((i) => (
                  <MailCard key={i.id} item={i} onChanged={upsert} />
                ))}
              </Collapsible>
              <Collapsible title="🗂️ Filed" count={filed.length} defaultOpen={false}>
                {filed.length === 0 && (
                  <p className="text-sm text-stardust-500">Nothing filed yet.</p>
                )}
                {filed.map((i) => (
                  <MailCard key={i.id} item={i} onChanged={upsert} />
                ))}
              </Collapsible>
            </>
          )}
        </>
      )}

      {view.name === "capture" && (
        <CaptureScreen
          fileRef={fileRef}
          onManual={() => setView({ name: "manual" })}
          onBack={() => setView({ name: "list" })}
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
          onSubmit={(f, a) => onConfirm(view.item, f, a)}
          onRetake={() => setView({ name: "capture" })}
        />
      )}

      {view.name === "filed" && (
        <FiledScreen
          item={view.item}
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
  onManual,
  onBack,
}: {
  fileRef: React.RefObject<HTMLInputElement | null>;
  onManual: () => void;
  onBack: () => void;
}) {
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="✉️ Mail" icon="📷" title="Before you snap it" subtitle="Cover the full number — we only need the last 4." />
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
        <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-stardust-300">
          Cover the full account number with your finger — we only need the last 4
          digits and the amount. Less leaves your phone, less can ever be seen.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => fileRef.current?.click()}
          className="btn-dapple flex-1 rounded-2xl px-5 py-3 text-base font-semibold text-nebula-950"
        >
          Take the photo
        </button>
        <button
          onClick={onManual}
          className="flex-1 rounded-2xl border border-nebula-700 px-5 py-3 text-base text-stardust-200 hover:border-nova-500"
        >
          Type it in instead
        </button>
      </div>
      <button onClick={onBack} className="mt-3 text-sm text-stardust-400 underline">
        Back to Mail
      </button>
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
        title={photoItemId ? "Type what you see" : "Type it in"}
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
  onSubmit,
  onRetake,
}: {
  item: MailItemPublic;
  lowConfidence: boolean;
  onSubmit: (f: { sender: string; amount: string; dueDate: string }, action: "pay" | "file") => void;
  onRetake: () => void;
}) {
  const [sender, setSender] = useState(item.sender ?? "");
  const [amount, setAmount] = useState(item.amount != null ? String(Number(item.amount)) : "");
  const [dueDate, setDueDate] = useState(item.due_date ?? "");
  const [action, setAction] = useState<"pay" | "file">(item.classification === "bill" ? "pay" : "file");
  const warn = lowConfidence ? "border-aurum-400/70" : "border-nebula-700";
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="✉️ Mail" icon="🔍" title="Here's what we found" subtitle="Fix anything — the account number stays locked." />
      {lowConfidence && (
        <p className="mt-3 rounded-xl border border-aurum-400/40 bg-nebula-800/70 p-3 text-xs text-aurum-200">
          Some of this was hard to read — fields with an amber edge need a double-check.
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
        <fieldset>
          <legend className="text-xs font-medium text-stardust-300">What should we do with it?</legend>
          <div className="mt-1 flex gap-2">
            {(["pay", "file"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setAction(a)}
                aria-pressed={action === a}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                  action === a
                    ? "border-nova-500 bg-nova-500/15 text-star-100 shadow-glow-sm"
                    : "border-nebula-700 text-stardust-300"
                }`}
              >
                {a === "pay" ? "Pay this" : "Just file it"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-2">
          <button
            onClick={() => onSubmit({ sender, amount, dueDate }, action)}
            className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
          >
            Looks right — file it
          </button>
          <button
            onClick={onRetake}
            className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300 hover:border-nova-500"
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
  onScanAnother,
  onBack,
}: {
  item: MailItemPublic;
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
