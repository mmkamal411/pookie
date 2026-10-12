"use client";

import { useState } from "react";

/**
 * Type-to-confirm modal for destructive actions.
 *
 * The user must type an exact phrase (e.g. "DELETE" or a child's name)
 * to enable the confirm button. This is the last line of defense before
 * an irreversible-with-grace-period action — it forces a deliberate,
 * reading-comprehension moment rather than a misclick.
 */
export function TypeToConfirmModal({
  title,
  body,
  confirmPhrase,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
}: {
  title: string;
  body: React.ReactNode;
  confirmPhrase: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  busy: boolean;
}) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === confirmPhrase;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="card-living relative w-full max-w-md rounded-3xl p-6">
        <h2 className="text-lg font-semibold text-star-100">{title}</h2>
        <div className="mt-3 text-sm leading-relaxed text-stardust-300">
          {body}
        </div>
        <label className="mt-5 block">
          <span className="text-xs font-medium text-stardust-300">
            Type <span className="font-bold text-white">{confirmPhrase}</span>{" "}
            to confirm
          </span>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={confirmPhrase}
            autoComplete="off"
            className="input-rooted mt-1.5 w-full rounded-2xl px-4 py-3 text-sm"
          />
        </label>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-2xl border border-white/15 px-4 py-3 text-sm font-medium text-white/85 transition hover:border-white/30 disabled:opacity-50"
          >
            Keep everything
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches || busy}
            className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
