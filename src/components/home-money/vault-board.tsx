// W7 Money & Documents — the vault. Parent-only, encrypted server-side
// (pgp_sym_encrypt), full PANs rejected pre-encryption (NFR-SEC-006). The UI
// never handles a full number: the add flow collects the last 4 digits only,
// and everything renders masked. TrustChip is ambient at module top.
"use client";

import { useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { VaultDocType, VaultDocumentMeta } from "@/server/services/vault";
import {
  ApiError,
  api,
  fmtDate,
  Masked4,
  PageHeader,
  QuietConfirm,
  RetentionCountdown,
  TrustChip,
  WarmError,
} from "@/components/home-money/shared";

const BASE = "/api/v1/household/vault/documents";

const inputCls =
  "w-full rounded-lg border border-nebula-700 bg-nebula-950 px-3 py-2 text-sm text-stardust-100 placeholder:text-stardust-500 focus:border-nova-500 focus:outline-none";

const GROUPS: { key: string; title: string; types: VaultDocType[] }[] = [
  { key: "cards", title: "💳 Cards", types: ["card"] },
  { key: "accounts", title: "🏦 Accounts", types: ["bank_account"] },
  { key: "ids", title: "🪪 IDs & insurance", types: ["identity", "insurance", "medical"] },
  { key: "taxlegal", title: "📄 Tax & legal", types: ["tax", "legal", "loan", "other"] },
];

const TYPE_LABEL: Record<VaultDocType, string> = {
  card: "Card",
  bank_account: "Bank account",
  tax: "Tax document",
  insurance: "Insurance",
  medical: "Medical",
  legal: "Legal",
  identity: "ID",
  loan: "Loan",
  other: "Other",
};

type View =
  | { name: "list" }
  | { name: "type" }
  | { name: "capture"; docType: VaultDocType }
  | { name: "confirm"; docType: VaultDocType; payload: VaultPayload }
  | { name: "saved"; doc: VaultDocumentMeta };

interface VaultPayload {
  label: string;
  last4: string;
  expiresOn: string;
  notes: string;
  fileDataUrl?: string;
  fileName?: string;
}

/* ------------------------------------------------------------------ */
/* document card                                                       */
/* ------------------------------------------------------------------ */

function DocCard({
  doc,
  onDeleted,
}: {
  doc: VaultDocumentMeta;
  onDeleted: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revealAsk, setRevealAsk] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [secret, setSecret] = useState<Record<string, unknown> | null>(null);
  const [revealedAt, setRevealedAt] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reveal = async () => {
    setRevealing(true);
    try {
      const data = await api<{ document: VaultDocumentMeta; secret: string }>(
        `${BASE}/${doc.id}`,
      );
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(data.secret) as Record<string, unknown>;
      } catch {
        parsed = { value: data.secret };
      }
      setSecret(parsed);
      setRevealedAt(new Date().toISOString());
      setRevealAsk(false);
      setExpanded(true);
    } catch {
      /* warm inline — the audited read failed; nothing was stored */
    } finally {
      setRevealing(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await api(`${BASE}/${doc.id}`, { method: "DELETE" });
      onDeleted(doc.id);
    } catch {
      /* stays on screen — failed deletes must be explicit */
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const photoDays =
    secret && typeof secret.photo_retention_days === "number"
      ? secret.photo_retention_days
      : null;

  return (
    <div className="animate-bloom rounded-2xl border border-nova-600/25 bg-nebula-900/80 p-4 shadow-glow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-star-100">{doc.doc_label}</p>
          <p className="mt-0.5 text-xs text-stardust-400">
            <Masked4 last4={doc.last4_ref} />
            {doc.expires_on && <span> · expires {fmtDate(doc.expires_on)}</span>}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-nebula-800 px-2 py-0.5 text-[10px] tracking-wide text-nova-300 uppercase">
          {TYPE_LABEL[doc.doc_type]}
        </span>
      </div>

      <div className="mt-3">
        <RetentionCountdown
          label="Retention"
          startsAt={doc.created_at}
          endsAt={doc.retention_until}
        />
        {photoDays != null && (
          <p className="mt-1 text-[11px] text-stardust-500">
            You chose {photoDays} days for the raw photo.
          </p>
        )}
      </div>

      {expanded && secret && (
        <div className="animate-rise mt-3 rounded-xl border border-nebula-700 bg-nebula-950/70 p-3">
          <dl className="space-y-1 text-xs">
            {Object.entries(secret)
              .filter(([k]) => k !== "file" && k !== "fileDataUrl")
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2">
                  <dt className="text-stardust-500 capitalize">{k.replace(/_/g, " ")}</dt>
                  <dd className="text-right text-stardust-200">{String(v)}</dd>
                </div>
              ))}
          </dl>
          {revealedAt && (
            <p className="mt-2 text-[11px] text-stardust-500">
              This view was logged just now — only you can open it.
            </p>
          )}
          <button
            onClick={() => {
              setExpanded(false);
              setSecret(null);
            }}
            className="mt-2 text-xs text-stardust-400 underline"
          >
            Hide details
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {!expanded && (
          <button
            onClick={() => setRevealAsk(true)}
            className="rounded-lg border border-nova-600/50 px-3 py-1.5 text-sm font-medium text-nova-300 hover:bg-nova-600/15"
          >
            View details
          </button>
        )}
        <button
          onClick={() => setConfirmDelete(true)}
          className="rounded-lg border border-nebula-700 px-3 py-1.5 text-sm text-stardust-400 hover:border-aurum-400/60 hover:text-aurum-200"
        >
          Delete
        </button>
      </div>

      <BottomSheet open={revealAsk} onClose={() => setRevealAsk(false)} title="Just checking it's you" maxWidth="max-w-md">
        <div className="px-1 pb-6">
          <p className="text-sm leading-relaxed text-stardust-300">
            Only continue if this is you. Opening the details is logged — so
            there&apos;s always a record of who looked.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={reveal}
              disabled={revealing}
              className="btn-dapple rounded-lg px-5 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
            >
              {revealing ? "Opening…" : "Reveal details"}
            </button>
            <button
              onClick={() => setRevealAsk(false)}
              className="rounded-lg border border-nebula-700 px-5 py-2 text-sm text-stardust-300"
            >
              Cancel
            </button>
          </div>
        </div>
      </BottomSheet>

      <QuietConfirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete "${doc.doc_label}"?`}
        body={
          <>
            <p>We&apos;ll remove it securely — shredded digitally, not just hidden.</p>
            <p className="mt-2 text-xs text-stardust-500">
              This follows the FTC&apos;s Disposal Rule for sensitive records.
            </p>
          </>
        }
        confirmLabel="Delete securely"
        danger
        busy={deleting}
        onConfirm={remove}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* the board                                                           */
/* ------------------------------------------------------------------ */

export function VaultBoard() {
  const [view, setView] = useState<View>({ name: "list" });
  const [docs, setDocs] = useState<VaultDocumentMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ cards: true });

  const load = async () => {
    setError(null);
    setForbidden(false);
    try {
      const data = await api<{ documents: VaultDocumentMeta[] }>(BASE);
      setDocs(data.documents);
    } catch (e) {
      if (e instanceof ApiError && e.code === "PARENT_ROLE_REQUIRED") setForbidden(true);
      else setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSaved = (doc: VaultDocumentMeta) => {
    setDocs((prev) => (prev ? [doc, ...prev] : [doc]));
    setView({ name: "saved", doc });
  };

  if (forbidden) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader eyebrow="🏠 Home" icon="🔐" title="Money & Documents" subtitle="The family vault." />
        <div className="mt-6 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-6 text-center">
          <p className="text-sm text-stardust-300">
            The vault is a parent space — it holds the household&apos;s sensitive documents.
          </p>
        </div>
      </main>
    );
  }

  if (docs == null) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        {error ? (
          <WarmError message={error} onRetry={load} />
        ) : (
          <p className="text-center text-sm text-stardust-300">Locking it away…</p>
        )}
      </main>
    );
  }

  const byGroup = (types: VaultDocType[]) => docs.filter((d) => types.includes(d.doc_type));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      {view.name === "list" && (
        <>
          <PageHeader
            eyebrow="🏠 Home"
            icon="🔐"
            title="Money & Documents"
            subtitle="Encrypted, masked, and honest about how long things live."
          />
          <div className="mt-4">
            <TrustChip>
              <span className="font-medium text-star-100">We never store full card numbers.</span>
              <br />
              Upload anything — we keep the last 4 digits and shred the rest. Encrypted before it ever rests.
            </TrustChip>
          </div>
          <button
            onClick={() => setView({ name: "type" })}
            className="btn-dapple mt-4 w-full rounded-2xl px-5 py-3 text-base font-semibold text-nebula-950"
          >
            ➕ Add a document
          </button>
          {error && (
            <div className="mt-4">
              <WarmError message={error} onRetry={load} />
            </div>
          )}
          {docs.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-nebula-700 bg-nebula-900/70 p-8 text-center">
              <p aria-hidden="true" className="text-3xl">🔐</p>
              <p className="text-sunlit mt-3 text-base font-semibold">Your vault is empty</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
                Add a card, an ID, insurance — anything the family needs in one safe place.
              </p>
              <button
                onClick={() => setView({ name: "type" })}
                className="btn-dapple mt-4 rounded-lg px-5 py-2 text-sm font-semibold text-nebula-950"
              >
                Add your first document
              </button>
            </div>
          ) : (
            GROUPS.map((g) => {
              const items = byGroup(g.types);
              if (items.length === 0) return null;
              const open = !!openGroups[g.key];
              return (
                <section key={g.key} className="mt-8" aria-label={g.title}>
                  <button
                    onClick={() => setOpenGroups((o) => ({ ...o, [g.key]: !o[g.key] }))}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold tracking-wide text-nova-300 uppercase">
                      {g.title}
                      <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300 shadow-glow-sm">
                        {items.length}
                      </span>
                    </span>
                    <span aria-hidden="true" className={`text-nova-300 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3">
                      {items.map((d) => (
                        <DocCard
                          key={d.id}
                          doc={d}
                          onDeleted={(id) => setDocs((prev) => (prev ?? []).filter((x) => x.id !== id))}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </>
      )}

      {view.name === "type" && (
        <TypePicker onPick={(t) => setView({ name: "capture", docType: t })} onBack={() => setView({ name: "list" })} />
      )}

      {view.name === "capture" && (
        <CaptureStep
          docType={view.docType}
          onPayload={(p) => setView({ name: "confirm", docType: view.docType, payload: p })}
          onBack={() => setView({ name: "type" })}
        />
      )}

      {view.name === "confirm" && (
        <ConfirmStep
          docType={view.docType}
          payload={view.payload}
          onSaved={onSaved}
          onBack={() => setView({ name: "capture", docType: view.docType })}
        />
      )}

      {view.name === "saved" && (
        <div className="animate-bloom mx-auto max-w-md py-8 text-center">
          <div
            aria-hidden="true"
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-nova-500/40 bg-nebula-900 text-2xl"
            style={{ boxShadow: "0 0 32px rgb(52 211 153 / 0.35)" }}
          >
            🔐
          </div>
          <h2 className="text-sunlit mt-4 text-xl font-semibold">Locked away.</h2>
          <p className="mt-1 text-sm text-stardust-300">
            {view.doc.doc_label} is in your vault — encrypted, last-4 only.
          </p>
          <div className="mt-5 text-left">
            <RetentionCountdown
              label="Retention"
              startsAt={view.doc.created_at}
              endsAt={view.doc.retention_until}
            />
          </div>
          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setView({ name: "type" })}
              className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950"
            >
              Add another
            </button>
            <button
              onClick={() => setView({ name: "list" })}
              className="flex-1 rounded-xl border border-nebula-700 px-5 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
            >
              Back to vault
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* upload: type picker                                                 */
/* ------------------------------------------------------------------ */

const TYPE_CARDS: { label: string; icon: string; types: VaultDocType[] }[] = [
  { label: "A card", icon: "💳", types: ["card"] },
  { label: "An account", icon: "🏦", types: ["bank_account"] },
  { label: "ID / insurance", icon: "🪪", types: ["identity", "insurance", "medical"] },
  { label: "Tax / legal", icon: "📄", types: ["tax", "legal", "loan", "other"] },
];

function TypePicker({
  onPick,
  onBack,
}: {
  onPick: (t: VaultDocType) => void;
  onBack: () => void;
}) {
  const [sub, setSub] = useState<VaultDocType[] | null>(null);
  return (
    <div className="animate-rise">
      <PageHeader eyebrow="🔐 Vault" icon="➕" title="What are you adding?" subtitle="Pick the closest kind — the retention schedule follows the type." />
      <div className="mt-6 grid grid-cols-2 gap-3">
        {TYPE_CARDS.map((c) => (
          <button
            key={c.label}
            onClick={() => (c.types.length === 1 ? onPick(c.types[0]) : setSub(c.types))}
            className="rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-5 text-left hover:border-nova-500 hover:shadow-glow-sm"
          >
            <p aria-hidden="true" className="text-2xl">{c.icon}</p>
            <p className="mt-2 text-sm font-semibold text-star-100">{c.label}</p>
          </button>
        ))}
      </div>
      {sub && (
        <div className="animate-rise mt-3 flex flex-wrap gap-2">
          {sub.map((t) => (
            <button
              key={t}
              onClick={() => onPick(t)}
              className="rounded-lg border border-nebula-700 px-4 py-2 text-sm text-stardust-200 hover:border-nova-500"
            >
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      )}
      <button onClick={onBack} className="mt-4 text-sm text-stardust-400 underline">
        Back to vault
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* upload: capture                                                     */
/* ------------------------------------------------------------------ */

function CaptureStep({
  docType,
  onPayload,
  onBack,
}: {
  docType: VaultDocType;
  onPayload: (p: VaultPayload) => void;
  onBack: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [last4, setLast4] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const next = (p: VaultPayload) => {
    if (!/^\d{0,4}$/.test(last4)) {
      setErr("The number field takes the last 4 digits only — never the full number.");
      return;
    }
    setErr(null);
    onPayload({ ...p, label: label.trim() || TYPE_LABEL[docType], last4 });
  };

  const onFile = (file: File) => {
    if (file.size > 4 * 1024 * 1024) {
      setErr("That file is over 4 MB — try a smaller scan or type it in.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      next({ label: "", last4, expiresOn: "", notes: "", fileDataUrl: String(reader.result), fileName: file.name });
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-rise">
      <PageHeader
        eyebrow="🔐 Vault"
        icon="📸"
        title={`Add ${TYPE_LABEL[docType].toLowerCase()}`}
        subtitle="Snap the front. Cover the full number — we only keep the last 4."
      />
      <div className="mt-6 space-y-3 rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
        <label className="block text-xs font-medium text-stardust-300">
          Name for it
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Chase Sapphire" className={`${inputCls} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-stardust-300">
          Last 4 digits <span className="text-stardust-500">(never the full number)</span>
          <input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="4821" inputMode="numeric" maxLength={4} className={`${inputCls} mt-1`} />
        </label>
        {err && <p className="text-xs text-aurum-200">{err}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => fileRef.current?.click()} className="btn-dapple flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-nebula-950">
            📷 Take photo
          </button>
          <button
            onClick={() => next({ label: "", last4, expiresOn: "", notes: "" })}
            className="flex-1 rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-200 hover:border-nova-500"
          >
            ⌨️ Type it in
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf"
          capture="environment"
          className="hidden"
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <button onClick={onBack} className="mt-3 text-sm text-stardust-400 underline">
        Back
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* upload: confirm (extract-then-mask made visible)                    */
/* ------------------------------------------------------------------ */

function ConfirmStep({
  docType,
  payload,
  onSaved,
  onBack,
}: {
  docType: VaultDocType;
  payload: VaultPayload;
  onSaved: (d: VaultDocumentMeta) => void;
  onBack: () => void;
}) {
  const [label, setLabel] = useState(payload.label);
  const [expiresOn, setExpiresOn] = useState(payload.expiresOn);
  const [notes, setNotes] = useState(payload.notes);
  const [photoDays, setPhotoDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    if (/[\d\s-]{8,}/.test(label) && /\d{8,}/.test(label.replace(/[\s-]/g, ""))) {
      setErr("The name can't carry a full number — last 4 digits only.");
      return;
    }
    setBusy(true);
    try {
      const secret = JSON.stringify({
        label,
        last4: payload.last4,
        expires_on: expiresOn || undefined,
        notes: notes || undefined,
        photo_retention_days: photoDays,
        ...(payload.fileDataUrl ? { file: payload.fileDataUrl, file_name: payload.fileName } : {}),
      });
      const data = await api<{ document: VaultDocumentMeta }>(BASE, {
        method: "POST",
        body: JSON.stringify({
          doc_type: docType,
          doc_label: label,
          secret,
          last4_ref: payload.last4 || undefined,
          expires_on: expiresOn || undefined,
        }),
      });
      onSaved(data.document);
    } catch (e) {
      // Failed writes must be explicit: the user must never wonder whether a
      // half-saved card number exists somewhere.
      setErr(e instanceof Error ? `${e.message} — nothing was stored.` : "Couldn't save that — nothing was stored.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-rise">
      <PageHeader eyebrow="🔐 Vault" icon="🔍" title="Check it before it's locked" subtitle="What you see here is exactly what gets encrypted." />
      <div className="mt-6 space-y-3 rounded-2xl border border-nova-600/30 bg-nebula-900/80 p-4">
        <label className="block text-xs font-medium text-stardust-300">
          Name
          <input value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputCls} mt-1`} />
        </label>
        <div className="rounded-lg border border-nebula-700 bg-nebula-950/60 px-3 py-2">
          <p className="text-xs text-stardust-400">
            Number <Masked4 last4={payload.last4} /> · last 4 only — locked.{" "}
            <span className="text-stardust-500">Full numbers are rejected before anything is saved.</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-stardust-300">
            Expires
            <input value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} type="date" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs font-medium text-stardust-300">
            Keep photo for
            <select value={photoDays} onChange={(e) => setPhotoDays(Number(e.target.value))} className={`${inputCls} mt-1`}>
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-stardust-300">
          Notes <span className="text-stardust-500">(optional)</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Safe deposit box, key with Mom" className={`${inputCls} mt-1`} />
        </label>
        <p className="text-[11px] text-stardust-500">
          The details stay in your vault per the retention schedule for this document type.
          {payload.fileDataUrl ? " The photo is encrypted with them." : ""}
        </p>
        {err && <p className="text-xs text-aurum-200">{err}</p>}
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={busy || !label.trim()}
            className="btn-dapple flex-1 rounded-xl px-5 py-2.5 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy ? "Locking it away…" : "Save to vault"}
          </button>
          <button onClick={onBack} className="rounded-xl border border-nebula-700 px-4 py-2.5 text-sm text-stardust-300 hover:border-nova-500">
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
