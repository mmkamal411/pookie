// S2 AI Support Chat (§5) — support intents only, wired to the real
// pookie-tutor worker. Persistent AI disclosure chip; first-run InfoLine;
// all five escalation tripwires; the two-step handoff contract; crisis
// pattern-interrupt (freezes the flow, never the ticket queue alone).

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, InfoLine } from "@/components/ui";
import { api } from "@/components/travel/travel-shared";
import { CrisisInterrupt, isCrisisMessage } from "./crisis-interrupt";
import { HandoffStep1, HandoffStep2, summarizeConversation } from "./handoff-contract";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SEEN_KEY = "pookie.s2.seen";
const SUGGESTIONS = ["Grades not syncing", "How do I share with a parent?", "Delete my account", "Talk to a human"];

const HUMAN_PATTERNS = ["human", "real person", "talk to someone", "agent", "someone real", "person please"];
const DELETE_PATTERNS = ["delete my account", "delete account", "export my data", "download my data", "erase my data"];
const UNCERTAIN_MARKERS = ["i'm not sure", "i am not sure", "i don't know", "not certain", "can't say for sure"];

function isAfterHoursET(): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()),
  );
  return hour < 9 || hour >= 17;
}

export function AiChat({
  childSlug,
  initialArticle,
  parentContextName,
}: {
  childSlug: string;
  initialArticle?: string;
  parentContextName?: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [seenIntro, setSeenIntro] = useState(true);
  const [online, setOnline] = useState(true);
  const [configNeeded, setConfigNeeded] = useState(false);
  const [frozen, setFrozen] = useState(false); // crisis freeze
  const [handedOff, setHandedOff] = useState(false);
  const [handoff, setHandoff] = useState<"idle" | "summary" | "done">("idle");
  const [summary, setSummary] = useState<string[]>([]);
  const [addMode, setAddMode] = useState(false);
  const [handoffBusy, setHandoffBusy] = useState(false);
  const [ticket, setTicket] = useState<{ number: string; id: string; slaDueAt: string | null } | null>(null);
  const [lowConfidenceOffer, setLowConfidenceOffer] = useState(false);
  const [proactiveOffered, setProactiveOffered] = useState(false);
  const [userTurns, setUserTurns] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeenIntro(window.localStorage.getItem(SEEN_KEY) === "1");
    } catch {
      setSeenIntro(true);
    }
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, handoff, frozen]);

  const dismissIntro = () => {
    setSeenIntro(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // private mode
    }
  };

  const startHandoff = useCallback(
    (msgs: Msg[]) => {
      setSummary(summarizeConversation(msgs));
      setHandoff("summary");
      setLowConfidenceOffer(false);
    },
    [],
  );

  const confirmHandoff = async () => {
    setHandoffBusy(true);
    try {
      const transcript = messages
        .map((m) => `${m.role === "user" ? "You" : "Pookie AI"}: ${m.content}`)
        .join("\n\n");
      const firstUser = messages.find((m) => m.role === "user")?.content ?? "Help needed";
      const created = await api<{ id: string; ticket_number: string; sla_due_at: string }>(
        "/api/v1/support/tickets",
        {
          method: "POST",
          body: JSON.stringify({
            subject: firstUser.slice(0, 120),
            category: "support.chat",
            body: `Handoff from AI support chat.\n\nWhat I'll hand them:\n${summary.map((b) => `- ${b}`).join("\n")}`,
            source: "s2_escalation",
          }),
        },
      );
      // Attach the full transcript as its own thread row (ai_transcript kind).
      try {
        await api(`/api/v1/support/tickets/${created.id}/events`, {
          method: "POST",
          body: JSON.stringify({
            body: `Chat transcript (from AI support chat):\n\n${transcript.slice(0, 7500)}`,
            kind: "ai_transcript",
          }),
        });
      } catch {
        // the ticket itself is open; the transcript attach is best-effort
      }
      setTicket({ number: created.ticket_number, id: created.id, slaDueAt: created.sla_due_at ?? null });
      setHandoff("done");
      setHandedOff(true);
    } catch {
      setSummary((s) => s);
    } finally {
      setHandoffBusy(false);
    }
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending || frozen || handedOff) return;

    // Tripwire 4: crisis language — freeze, inline resources, never the queue.
    if (isCrisisMessage(content)) {
      setMessages((m) => [...m, { role: "user", content }]);
      setFrozen(true);
      setInput("");
      return;
    }

    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    const turns = userTurns + 1;
    setUserTurns(turns);

    // Tripwire 2: explicit human request — immediate handoff, no persuasion.
    const lower = content.toLowerCase();
    if (HUMAN_PATTERNS.some((p) => lower.includes(p))) {
      startHandoff(next);
      return;
    }

    // Tripwire 5: deletion/export — plain-language info + immediate human ticket.
    if (DELETE_PATTERNS.some((p) => lower.includes(p))) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Deleting your account is a big step — a person on our team will handle this with you to make sure it's done right. Here's what it means: your data is deleted on a 30-day schedule, and some records are kept only as long as the law requires. I'm opening a ticket for you now so a human takes it from here.",
        },
      ]);
      setSummary([`Wants to ${content.slice(0, 80)}`, "Needs plain-language deletion info + human handling"]);
      setHandoff("summary");
      return;
    }

    setSending(true);
    try {
      const data = await api<{ status: string; reply?: string; message?: string }>(
        "/api/v1/support/chat",
        {
          method: "POST",
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            article_slug: initialArticle,
          }),
        },
      );
      if (data.status === "configuration_needed") {
        setConfigNeeded(true);
        setSending(false);
        return;
      }
      const reply = data.reply ?? "Hmm — I didn't get that. Try rephrasing?";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      // Tripwire 1: low confidence — never bluff; offer a human.
      if (UNCERTAIN_MARKERS.some((mk) => reply.toLowerCase().includes(mk))) {
        setLowConfidenceOffer(true);
      }
      // Tripwire 3: 3 failed attempts on one intent — proactive handoff offer.
      if (turns >= 3 && !proactiveOffered && !lowConfidenceOffer) {
        setProactiveOffered(true);
        setLowConfidenceOffer(true);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content:
            "Pookie's AI is resting right now — open a ticket and a human will pick it up.",
        },
      ]);
      setConfigNeeded(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-[60dvh] flex-col">
      {/* Persistent AI disclosure — always visible, never dismissible. */}
      <div className="sticky top-0 z-10 -mx-4 bg-[#050510]/90 px-4 py-2 backdrop-blur-md">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-nova-400/30 bg-nebula-900/80 px-3 py-1 text-xs font-medium text-stardust-200">
          🤖 AI assistant — not a person
        </span>
        {parentContextName && (
          <p className="mt-1 text-xs text-stardust-400">
            You&apos;re chatting as {parentContextName} — Pookie talks to parents here, never kids
            under 13.
          </p>
        )}
      </div>

      {!seenIntro && (
        <div className="mt-3">
          <InfoLine>
            I&apos;m Pookie&apos;s support assistant — an AI. I can walk you through features and
            fix common problems. I <strong>can&apos;t</strong> see your private data (grades,
            health, check-ins), delete or export your account, or make promises about the law.{" "}
            <strong>A human is one tap away anytime</strong> — just say &lsquo;human.&rsquo;
            <span className="mt-2 block">
              <Button size="sm" variant="ghost" onClick={dismissIntro}>
                Got it
              </Button>
            </span>
          </InfoLine>
        </div>
      )}

      {isAfterHoursET() && !frozen && (
        <div className="mt-3">
          <InfoLine icon="🌙">
            It&apos;s after hours — our team is back at 9 AM ET, and tickets filed now are first
            in line. I can keep helping meanwhile.
          </InfoLine>
        </div>
      )}

      <div className="mt-4 flex-1 space-y-3">
        {messages.length === 0 && !frozen && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-full border border-nova-400/25 bg-nebula-900/60 px-3 py-1.5 text-[13px] text-stardust-200 transition-colors hover:border-nova-400/50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "border border-nova-400/30 bg-nova-500/15 text-star-100"
                  : "border border-teal-400/20 bg-teal-950/40 text-stardust-100"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start">
            <div className="animate-pulse rounded-2xl border border-teal-400/20 bg-teal-950/40 px-4 py-2.5 text-sm text-stardust-300">
              Thinking…
            </div>
          </div>
        )}

        {lowConfidenceOffer && handoff === "idle" && !frozen && (
          <Card padding="sm" className="border-amber-400/25">
            <p className="text-sm text-stardust-200">
              {proactiveOffered && userTurns >= 3
                ? "I've tried a few ways and we might still be stuck — let me get you a person. I'll send them our whole chat so you don't repeat anything."
                : "I'm not sure I have this right — want me to bring in a human?"}
            </p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => startHandoff(messages)}>
                Yes, get a human
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLowConfidenceOffer(false)}>
                Let me rephrase
              </Button>
            </div>
          </Card>
        )}

        {frozen && <CrisisInterrupt />}

        {handoff === "summary" && (
          <HandoffStep1
            bullets={summary}
            busy={handoffBusy}
            onConfirm={confirmHandoff}
            onAdd={() => setAddMode(true)}
          />
        )}
        {handoff === "done" && ticket && (
          <HandoffStep2
            ticketNumber={ticket.number}
            ticketId={ticket.id}
            slaDueAt={ticket.slaDueAt}
            childSlug={childSlug}
          />
        )}

        {handedOff && (
          <InfoLine icon="🔒">
            This chat is now attached to ticket {ticket?.number} —{" "}
            <Link href={`/c/${childSlug}/support/tickets/${ticket?.id}`} className="text-nova-300 underline">
              continue there
            </Link>
            .
          </InfoLine>
        )}

        {configNeeded && !handedOff && (
          <InfoLine tone="amber">
            Pookie&apos;s AI is resting right now —{" "}
            <Link href={`/c/${childSlug}/support/tickets/new`} className="text-nova-300 underline">
              open a ticket
            </Link>{" "}
            and a human will pick it up.
          </InfoLine>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-20 mt-4 -mx-4 bg-[#050510]/90 px-4 py-2 backdrop-blur-md">
        {!online && (
          <div className="mb-2">
            <InfoLine tone="amber">
              You&apos;re offline — Pookie&apos;s AI needs a connection. Your message is saved and
              will send when you&apos;re back.
            </InfoLine>
          </div>
        )}
        {addMode && handoff === "summary" ? (
          <p className="mb-2 text-xs text-stardust-400">
            Add one more note below, then the summary card will update.
          </p>
        ) : null}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (addMode && handoff === "summary") {
                  const content = input.trim();
                  if (content) {
                    const next: Msg[] = [...messages, { role: "user", content }];
                    setMessages(next);
                    setSummary(summarizeConversation(next));
                    setAddMode(false);
                    setInput("");
                  }
                } else {
                  send(input);
                }
              }
            }}
            placeholder={frozen || handedOff ? "This chat is paused." : "Describe what's going wrong…"}
            disabled={!online || frozen || handedOff || sending}
            className="flex-1 rounded-2xl border border-nova-400/30 bg-nebula-900/80 px-4 py-2.5 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none disabled:opacity-50"
          />
          {!handedOff && !frozen && (
            <Button
              variant="ghost"
              onClick={() => startHandoff(messages)}
              aria-label="Get a human"
              title="Get a human"
            >
              Human
            </Button>
          )}
          <Button
            onClick={() => {
              if (addMode && handoff === "summary") {
                const content = input.trim();
                if (content) {
                  const next: Msg[] = [...messages, { role: "user", content }];
                  setMessages(next);
                  setSummary(summarizeConversation(next));
                  setAddMode(false);
                  setInput("");
                }
              } else {
                send(input);
              }
            }}
            disabled={!online || frozen || handedOff || sending || !input.trim()}
            loading={sending}
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
