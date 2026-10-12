// S1 article template (§4.3 — every article, no exceptions):
// problem line → audience line → steps → LegalAccordion → "Still stuck?"
// escalation → related answers → feedback row (👍/👎 writes faq_feedback).

"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Button, Card, InfoLine, Sheet } from "@/components/ui";
import { LegalAccordion, type LegalBasis } from "./legal-accordion";
import { api } from "@/components/travel/travel-shared";

export interface Article {
  article_id: string;
  slug: string;
  title: string;
  body_md: string;
  category: string;
  age_band: string;
  related: { slug: string; title: string; category: string }[];
  legal_note_md: string | null;
  legal_citation: string | null;
  legal_basis: LegalBasis | null;
  legal_reviewed_at: string | null;
  legal_review_due_at: string | null;
  legal_version: number;
  legal_stale: boolean;
}

/** Tiny markdown: paragraphs, **bold**, and numbered lines become steps. */
function renderBody(md: string): ReactNode[] {
  const blocks = md.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n").filter((l) => l.trim());
    const isSteps = lines.length > 1 && lines.every((l) => /^\d+[.)]\s/.test(l.trim()));
    if (isSteps) {
      return (
        <ol key={i} className="list-decimal space-y-1.5 pl-5">
          {lines.map((l, j) => (
            <li key={j}>{richInline(l.replace(/^\d+[.)]\s*/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i}>
        {lines.map((l, j) => (
          <span key={j}>
            {richInline(l)}
            {j < lines.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
  });
}

function richInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="text-star-100">{p.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const FEEDBACK_REASONS = [
  { key: "wrong_answer", label: "Wrong answer" },
  { key: "out_of_date", label: "Out of date" },
  { key: "too_confusing", label: "Too confusing" },
  { key: "did_not_answer", label: "Didn't answer my question" },
] as const;

export function ArticleView({ article, childSlug }: { article: Article; childSlug: string }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [thanks, setThanks] = useState(false);

  const sendFeedback = async (helpful: boolean) => {
    setVote(helpful ? "up" : "down");
    if (!helpful) {
      setSheetOpen(true);
      return;
    }
    try {
      await api("/api/v1/support/faq/feedback", {
        method: "POST",
        body: JSON.stringify({ article_id: article.article_id, helpful: true }),
      });
    } catch {
      // feedback is best-effort
    }
  };

  const submitDown = async () => {
    try {
      await api("/api/v1/support/faq/feedback", {
        method: "POST",
        body: JSON.stringify({
          article_id: article.article_id,
          helpful: false,
          reason: reason ?? undefined,
          note: note.trim() || undefined,
        }),
      });
    } catch {
      // best-effort
    }
    setThanks(true);
  };

  return (
    <article className="space-y-4">
      <h1 className="text-xl font-semibold text-star-100">{article.title}</h1>

      {article.age_band === "teen" && (
        <InfoLine>Written for teens.</InfoLine>
      )}
      {article.age_band === "parent" && (
        <InfoLine>Written for parents.</InfoLine>
      )}

      <div className="space-y-3 text-[15px] leading-relaxed text-stardust-200">
        {renderBody(article.body_md)}
      </div>

      {article.legal_basis && (
        <LegalAccordion
          basis={article.legal_basis}
          citation={article.legal_citation}
          noteMd={article.legal_note_md}
          reviewedAt={article.legal_reviewed_at}
          reviewDueAt={article.legal_review_due_at}
          version={article.legal_version}
          stale={article.legal_stale}
        />
      )}

      <Card className="border-nova-400/30">
        <p className="text-sm font-semibold text-star-100">Still stuck?</p>
        <p className="mt-1 text-sm leading-relaxed text-stardust-300">
          Talk to us — we&apos;ll pick up where this article left off. You won&apos;t have to
          repeat yourself.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/c/${childSlug}/support/chat?article=${encodeURIComponent(article.slug)}`}
            className="rounded-xl border border-nova-300/40 bg-nova-500/15 px-4 py-2 text-sm font-medium text-star-100"
          >
            Ask Pookie about this
          </Link>
          <Link
            href={`/c/${childSlug}/support/tickets/new?category=support.faq&subject=${encodeURIComponent(article.title)}`}
            className="rounded-xl border border-nova-400/20 px-4 py-2 text-sm font-medium text-stardust-200"
          >
            Open a Ticket
          </Link>
        </div>
      </Card>

      {article.related.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-star-100">Related answers</p>
          <div className="mt-2 space-y-1.5">
            {article.related.map((r) => (
              <Link
                key={r.slug}
                href={`/c/${childSlug}/support/faq/${r.slug}`}
                className="block rounded-xl border border-nova-400/15 bg-nebula-900/50 px-3 py-2 text-sm text-star-100 transition-colors hover:border-nova-400/35"
              >
                {r.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-t border-nova-400/10 pt-3">
        <p className="text-sm text-stardust-300">Was this helpful?</p>
        <button
          onClick={() => sendFeedback(true)}
          aria-label="Yes, helpful"
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${vote === "up" ? "border-emerald-400/50 bg-emerald-500/15" : "border-nova-400/20 hover:border-nova-400/40"}`}
        >
          👍
        </button>
        <button
          onClick={() => sendFeedback(false)}
          aria-label="No, not helpful"
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${vote === "down" ? "border-amber-400/50 bg-amber-500/15" : "border-nova-400/20 hover:border-nova-400/40"}`}
        >
          👎
        </button>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="What went wrong?">
        {!thanks ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_REASONS.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReason(r.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    reason === r.key
                      ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                      : "border-nova-400/20 text-stardust-300"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Anything else? (optional)"
              className="w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
            <Button onClick={submitDown} disabled={!reason}>
              Send feedback
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-stardust-200">
              Thanks — that helps us fix it. Want a human to take it from here?
            </p>
            <div className="flex gap-2">
              <Link
                href={`/c/${childSlug}/support/chat?article=${encodeURIComponent(article.slug)}`}
                className="rounded-xl border border-nova-300/40 bg-nova-500/15 px-4 py-2 text-sm font-medium text-star-100"
              >
                Ask Pookie
              </Link>
              <Link
                href={`/c/${childSlug}/support/tickets/new`}
                className="rounded-xl border border-nova-400/20 px-4 py-2 text-sm font-medium text-stardust-200"
              >
                Open a Ticket
              </Link>
            </div>
          </div>
        )}
      </Sheet>
    </article>
  );
}
