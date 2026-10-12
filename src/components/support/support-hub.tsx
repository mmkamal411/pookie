// Support hub (§3) — 3 entry cards (S1/S2/S3), the privacy promise, the
// "not an emergency service" line, and the "What can support see?" sheet.

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, InfoLine, Sheet } from "@/components/ui";

const CARDS = [
  {
    icon: "📖",
    title: "Help Center & FAQ",
    sub: "Answers to common questions — searchable, plain-language.",
    route: "faq",
  },
  {
    icon: "💬",
    title: "AI Support Chat",
    sub: "Instant answers, 24/7. A human is one tap away.",
    route: "chat",
  },
  {
    icon: "🎫",
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
        <span aria-hidden="true" className="text-3xl">
          💬
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
              <span aria-hidden="true" className="text-3xl">
                {c.icon}
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
