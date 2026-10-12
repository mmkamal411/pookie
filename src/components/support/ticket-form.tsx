// S3 new-ticket form (§6.1) — subject, category, "what's going on",
// teen-privacy banner (teen band, always visible), "?" helper sheet,
// attachment metadata (≤10 MB, client-checked), offline draft preservation.
// Submit → ticket number issued immediately → lands on the thread.

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, InfoLine, Sheet } from "@/components/ui";
import { api } from "@/components/travel/travel-shared";

const CATEGORIES = [
  { key: "school.sync", label: "School — grades not syncing" },
  { key: "school.grades", label: "School — grades & classes" },
  { key: "login.sso", label: "Login & account access" },
  { key: "billing", label: "Billing & payments" },
  { key: "support.chat", label: "From AI chat" },
  { key: "support.faq", label: "From a help article" },
  { key: "travel", label: "Travel" },
  { key: "marketplace", label: "Marketplace" },
  { key: "safety", label: "Safety concern" },
  { key: "other", label: "Something else" },
];

const DRAFT_KEY = "pookie.ticket.draft";

export function TicketForm({
  childSlug,
  isTeen,
  onBehalfOf,
}: {
  childSlug: string;
  isTeen: boolean;
  onBehalfOf?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subject, setSubject] = useState(searchParams.get("subject") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "other");
  const [body, setBody] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Restore an offline-saved draft.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as { subject: string; category: string; body: string };
        if (!subject) setSubject(d.subject ?? "");
        if (d.category) setCategory(d.category);
        setBody(d.body ?? "");
      }
    } catch {
      // no draft
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    setError("");
    if (!subject.trim()) {
      setError("Give it a subject so we know what it's about.");
      return;
    }
    if (!body.trim()) {
      setError("Tell us what's going on — a few sentences is plenty.");
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB — try a smaller one.");
      return;
    }
    if (!navigator.onLine) {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ subject, category, body }));
      } catch {
        // private mode
      }
      setError("You're offline — saved. We'll open this ticket when you're back online.");
      return;
    }
    setSaving(true);
    try {
      const attachmentLine =
        file != null
          ? `\n\nAttachment: ${file.name} (${(file.size / 1048576).toFixed(1)} MB, ${file.type || "unknown type"}) — file bytes attach with the storage update.`
          : "";
      const created = await api<{ id: string }>(`/api/v1/support/tickets`, {
        method: "POST",
        body: JSON.stringify({
          subject: subject.trim().slice(0, 120),
          category,
          body: body.trim() + attachmentLine,
          source: "manual",
        }),
      });
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }
      router.push(`/c/${childSlug}/support/tickets/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {isTeen && (
        <InfoLine tone="teal" icon="🔒">
          <strong>This ticket is private to you.</strong> Your parents won&apos;t be told you
          opened it and can&apos;t see it — unless someone&apos;s safety is at risk right now.
          Every time a support agent looks at anything of yours, it&apos;s logged and you can see
          the log in Settings → Privacy → &ldquo;Who&apos;s looked at my stuff.&rdquo;
        </InfoLine>
      )}

      {onBehalfOf && (
        <InfoLine>
          <strong>On behalf of {onBehalfOf}</strong> — Pookie talks to the parent here, never kids
          under 13.
        </InfoLine>
      )}

      <div>
        <label htmlFor="ticket-subject" className="block text-sm font-medium text-star-100">
          Subject
        </label>
        <input
          id="ticket-subject"
          value={subject}
          maxLength={120}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Grades stopped updating"
          className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="ticket-category" className="block text-sm font-medium text-star-100">
          Category
        </label>
        <select
          id="ticket-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 focus:border-nova-300/60 focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="ticket-body" className="block text-sm font-medium text-star-100">
            What&apos;s going on?
          </label>
          <button
            onClick={() => setHelpOpen(true)}
            aria-label="What can support see?"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-nova-400/30 text-xs text-nova-300"
          >
            ?
          </button>
        </div>
        <textarea
          id="ticket-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Tell us what happened — what you tried, what you expected."
          className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm leading-relaxed text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="ticket-file" className="block text-sm font-medium text-star-100">
          Attachment <span className="font-normal text-stardust-400">(optional, ≤10 MB)</span>
        </label>
        <input
          id="ticket-file"
          type="file"
          accept="image/*,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1.5 w-full text-sm text-stardust-300 file:mr-3 file:rounded-xl file:border file:border-nova-400/30 file:bg-nebula-900/70 file:px-3 file:py-1.5 file:text-sm file:text-star-100"
        />
        <p className="mt-1 text-[11px] text-stardust-500">
          Sensitive patterns (card numbers, passwords) are redacted on the way in — never stored.
        </p>
      </div>

      {error && <InfoLine tone="amber">{error}</InfoLine>}

      <Button onClick={submit} loading={saving} className="w-full sm:w-auto">
        Open ticket
      </Button>

      <Sheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="What can support see?"
        subtitle="Almost nothing — by design."
      >
        <div className="space-y-2 text-sm leading-relaxed text-stardust-200">
          <p>Support works with almost nothing — your ticket and your words. Not your grades, not your health.</p>
          <p><strong className="text-star-100">Agents can see:</strong> this ticket&apos;s messages, your name, and which module you&apos;re asking about.</p>
          <p><strong className="text-star-100">Agents can&apos;t see:</strong> grades, health, check-ins, or messages — unless you approve a one-time, 24-hour peek, right here in the ticket.</p>
          <p><strong className="text-star-100">Every look is logged.</strong> See exactly who looked at what in Settings → Privacy → &ldquo;Who&apos;s looked at my stuff.&rdquo;</p>
        </div>
      </Sheet>
    </div>
  );
}
