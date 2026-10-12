// Support hub (§3) — 3 entry cards (S1/S2/S3), the privacy promise, the
// "not an emergency service" line, and the "What can support see?" sheet.

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, InfoLine, Sheet } from "@/components/ui";

function FaqGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.5a4.5 4.5 0 0 0-4.4 3.6c-.1.5.2 1 .7 1.1l1.2.2c.4.1.7.5.6.9l-.3 1.2M12 17.5h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8m-8 4h5m7-2a8 8 0 0 1-8 8H7l-4 3v-3.2c-1-1.4-1.6-3-1.6-4.8a8 8 0 0 1 16 0Z" />
    </svg>
  );
}

function TicketGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8Zm6 3h4" />
    </svg>
  );
}

const CARDS = [
  {
    Icon: FaqGlyph,
    title: "Help Center & FAQ",
    sub: "Answers to common questions — searchable, plain-language.",
    route: "faq",
  },
  {
    Icon: ChatGlyph,
    title: "AI Support Chat",
    sub: "Instant answers, 24/7. A human is one tap away.",
    route: "chat",
  },
  {
    Icon: TicketGlyph,
    title: "Support Tickets",
    sub: "Open a ticket, track it, talk to a human.",
    route: "tickets",
  },
];

export function SupportHub({ childSlug, under13 }: { childSlug: string; under13: boolean }) {
  const [seeOpen, setSeeOpen] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-nova-400">
          <ChatGlyph />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">Support</h1>
          <p className="text-sm text-stardust-300">help, when you need it</p>
        </div>
      </div>

      <div className="mt-4">
        <InfoLine>
          Support works with almost nothing — your ticket and your words. Not your grades, not
          your health.{" "}
          <button onClick={() => setSeeOpen(true)} className="text-nova-300 underline">
            Why we do it this way ↗
          </button>
        </InfoLine>
      </div>

      {under13 && (
        <div className="mt-3">
          <InfoLine>
            For under-13s, support runs in a parent&apos;s session — the person Pookie talks to is
            always the parent.
          </InfoLine>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {CARDS.map((c) => (
          <Link key={c.route} href={`/c/${childSlug}/support/${c.route}`} className="block">
            <Card className="flex items-center gap-4 transition-transform hover:-translate-y-0.5">
              <span aria-hidden="true" className="text-nova-400">
                <c.Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-star-100">{c.title}</span>
                <span className="mt-0.5 block text-[13px] text-stardust-300">{c.sub}</span>
                {under13 && c.route !== "faq" && (
                  <span className="mt-1 block text-xs text-stardust-400">
                    For under-13s, support runs in a parent&apos;s session.
                  </span>
                )}
              </span>
              <span aria-hidden="true" className="shrink-0 text-nova-300">
                ›
              </span>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-5 text-center text-[13px] leading-relaxed text-stardust-300">
        Pookie Support isn&apos;t an emergency service. In an emergency, call 911. In crisis: call
        or text <a href="tel:988" className="font-semibold text-star-100 underline">988</a>.
      </p>

      <div className="mt-4 text-center">
        <Button variant="ghost" size="sm" onClick={() => setSeeOpen(true)}>
          What can support see?
        </Button>
      </div>

      <Sheet
        open={seeOpen}
        onClose={() => setSeeOpen(false)}
        title="What can support see?"
        subtitle="The visibility matrix, in plain language."
      >
        <div className="space-y-2 text-sm leading-relaxed text-stardust-200">
          <p><strong className="text-star-100">Your ticket:</strong> the subject, your messages, and any files you attach. That&apos;s the whole workspace.</p>
          <p><strong className="text-star-100">Not included:</strong> grades, health, check-ins, location, or messages with family. Agents can&apos;t open these on their own.</p>
          <p><strong className="text-star-100">One-time peeks:</strong> if an agent needs to see your grades to fix a sync bug, they ask you in the ticket. You approve once, for 24 hours, and every look is logged.</p>
          <p><strong className="text-star-100">Teen tickets:</strong> private to the teen. Parents aren&apos;t notified and can&apos;t see them.</p>
          <p><strong className="text-star-100">The log:</strong> Settings → Privacy → &ldquo;Who&apos;s looked at my stuff&rdquo; shows every agent access.</p>
        </div>
      </Sheet>
    </main>
  );
}
