// Crisis pattern-interrupt (§5.3 — THE UNMISSABLE RULE).
// Crisis language NEVER goes into a ticket queue alone. The support flow
// freezes; an inline resource block renders (not a modal) and persists for
// the session. No auto-ticket — a ticket is created only at explicit user
// request. Warm, present copy — no clinical language, no "just between us"
// promises.

"use client";

import { useState } from "react";
import { Button, Card, Sheet } from "@/components/ui";

export const CRISIS_PATTERNS = [
  "kill myself",
  "killing myself",
  "want to die",
  "wanna die",
  "end my life",
  "ending my life",
  "feel like ending it",
  "suicide",
  "suicidal",
  "self harm",
  "self-harm",
  "cutting myself",
  "cut myself",
  "hurt myself",
  "hurting myself",
  "no reason to live",
  "better off dead",
  "nobody would care if i died",
  "would care if i died",
  "nobody cares if i die",
];

export function isCrisisMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_PATTERNS.some((p) => lower.includes(p));
}

export function CrisisInterrupt() {
  const [tellOpen, setTellOpen] = useState(false);
  const [draft, setDraft] = useState(
    "I need to tell you something hard. I'm having thoughts about hurting myself and I need help. Can you stay with me and help me get support?",
  );

  return (
    <Card padding="lg" className="border-teal-400/30 bg-teal-950/30">
      <p className="text-[15px] font-semibold text-star-100">We&apos;re really glad you told Pookie.</p>
      <p className="mt-1 text-sm leading-relaxed text-stardust-200">
        You don&apos;t have to handle this alone:
      </p>
      <div className="mt-3 grid gap-2">
        <a
          href="tel:988"
          className="rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2.5 text-center text-sm font-semibold text-star-100"
        >
          📞 Call or text 988
        </a>
        <a
          href="sms:741741?&body=HOME"
          className="rounded-xl border border-teal-400/40 bg-teal-500/15 px-4 py-2.5 text-center text-sm font-semibold text-star-100"
        >
          💬 Text HOME to 741741
        </a>
        <a
          href="tel:18007154225"
          className="rounded-xl border border-teal-400/25 bg-nebula-900/60 px-4 py-2.5 text-center text-sm font-medium text-stardust-100"
        >
          📍 GA Crisis &amp; Access Line: 1-800-715-4225
        </a>
        <Button variant="ghost" onClick={() => setTellOpen(true)}>
          🧡 Help me tell a trusted adult
        </Button>
      </div>
      <p className="mt-3 text-sm text-stardust-300">Pookie stays here with you.</p>

      <Sheet
        open={tellOpen}
        onClose={() => setTellOpen(false)}
        title="Tell a trusted adult"
        subtitle="Edit it to sound like you, then send it to someone you trust."
      >
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={5}
            className="w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm leading-relaxed text-star-100 focus:border-nova-300/60 focus:outline-none"
          />
          <Button
            onClick={() => {
              void navigator.clipboard?.writeText(draft).catch(() => {});
              setTellOpen(false);
            }}
          >
            Copy message
          </Button>
          <p className="text-xs leading-relaxed text-stardust-400">
            Telling a trusted adult is the bravest next step. You can also call or text 988 any
            time — they&apos;re there 24/7.
          </p>
        </div>
      </Sheet>
    </Card>
  );
}
