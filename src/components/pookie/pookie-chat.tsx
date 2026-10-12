"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";
import type { SchoolOverview } from "@/lib/school/types";
import {
  POOKIE_TUTOR_URL,
  FALLBACK_MESSAGE,
  buildTutorContext,
  askTutor,
  classifyNeedsDepth,
  enqueueMuse,
  pollMuseQueue,
  detectPersonality,
  type ChatMessage,
  type ChatPersona,
  type TutorContext,
} from "@/lib/pookie-tutor";
import { detectClassNeon } from "@/components/pookie/class-neons";
import {
  getPookieColor,
  setPookieColor,
  subscribePookieColor,
  resolvePookieNeon,
} from "@/components/pookie/pookie-color";
import { MiniPookie, MiniMuse, moodForMessage, POOKIE_AVATAR_KEYFRAMES } from "@/components/pookie/pookie-avatars";

const STORAGE_KEY = "pookie-chat-v1";
const QUEUE_KEY = "pookie-muse-queue";
const MAX_MESSAGES = 50;
const LONG_MESSAGE = 300;

const QUICK_REPLIES = ["What are my priorities today?"];

/** Explicit depth requests escalate to the async Mookie queue.
 *  Exact keyword list from Mehedi — this list IS the escalation contract. */
const WANTS_DEPTH =
  /\bmookie\b|deeper|more detail|better plan|go deeper|\bdetailed\b|\bcomprehensive\b|\bdeep\b|\bmore\b|\btonight\b|\bdive\b|\bthorough\b|\btoday\b|this week|this month|this term|this semester|studentvue|parentvue|\bctls\b|\bclever\b|\bresearch\b|\bsearch\b|\bfind\b|\btalk\b|\bthink\b/i;

function loadHistory(childName: string): ChatMessage[] {
  const seed: ChatMessage[] = [
    {
      role: "pookie",
      text: `Hey ${childName}, Captain! 🚀 Pookie here — your co-pilot for the whole mission. School, plans, tasks, questions about life — I've got your readings and I'm ready to help with all of it. What's our first move?`,
    },
  ];
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed;
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return seed;
    return parsed
      .filter((m) => m && (m.role === "user" || m.role === "pookie") && typeof m.text === "string")
      .slice(-MAX_MESSAGES);
  } catch {
    return seed;
  }
}

function BotText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= LONG_MESSAGE || expanded) {
    return (
      <div>
        <p className="text-[15px] leading-[1.65] whitespace-pre-wrap text-star-100">{text}</p>
        {text.length > LONG_MESSAGE && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-1 text-xs font-medium text-nova-300 hover:text-nova-400"
          >
            Show less
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <p className="line-clamp-4 text-[15px] leading-[1.65] whitespace-pre-wrap text-star-100">{text}</p>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1 text-xs font-medium text-nova-300 hover:text-nova-400"
      >
        Read full answer ▾
      </button>
    </div>
  );
}

/**
 * Pookie tab chat — full-page AI co-pilot and assistant.
 *
 * FR-AI-002: "Direct mode" (Muse's straight-talk voice) is 18+ ONLY.
 * - Adults (viewerAge >= 18): an explicit Direct mode toggle. Same safety
 *   rules in both modes — mode is a tone preference, never a safety change.
 * - Under 18 (or unknown age — fail closed): no toggle, no keyword trigger,
 *   no footnote. Warm Pookie only, with a clear explanation of why.
 * The word "unfiltered" is retired from copy, comments, and docs (R7).
 */
export function PookieChat({
  overview,
  childName,
  viewerAge,
}: {
  overview: SchoolOverview;
  childName: string;
  /** The viewer's age in years, computed server-side. Null = unknown = gated. */
  viewerAge?: number | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadHistory(childName));
  const [draft, setDraft] = useState("");
  const [directMode, setDirectMode] = useState(false);
  const [, setColorTick] = useState(0);
  const [museThinking, setMuseThinking] = useState(false);
  const [museSlow, setMuseSlow] = useState(false);
  const musePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const museSlowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  const context: TutorContext = buildTutorContext(overview, childName);
  const isThinking = messages.some((m) => m.thinking);
  // FR-AI-002: 18+ gate, fail-closed on unknown age. Mode is tone only —
  // the same safety layer serves both modes (sol-school-ai §13).
  const isAdult = (viewerAge ?? 0) >= 18;
  const effectiveDirect = isAdult && directMode;
  const pookieNeon = resolvePookieNeon(getPookieColor());

  useEffect(() => subscribePookieColor(() => setColorTick((t) => t + 1)), []);

  // Resume polling for a pending Muse answer (survives reload AND remount —
  // navigating away from the chat tab unmounts this component, which must
  // not strand an answered-but-undisplayed Mookie response).
  // Deferred to a timeout callback so setState stays out of the effect body.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const pending = localStorage.getItem(QUEUE_KEY);
        if (pending && POOKIE_TUTOR_URL && !musePollRef.current) {
          const { qid, ts } = JSON.parse(pending) as { qid: string; ts: number };
          if (qid && Date.now() - ts < 1800000) {
            setMuseThinking(true);
            startMusePoll(qid);
          } else {
            localStorage.removeItem(QUEUE_KEY);
          }
        }
      } catch {
        /* polling is best-effort */
      }
    }, 0);
    return () => {
      clearTimeout(t);
      // CRITICAL: reset the refs so a remount can resume polling. A stale
      // non-null ref blocks the resume path above and strands the response.
      // QUEUE_KEY is intentionally kept — the remount resumes from it.
      if (musePollRef.current) clearInterval(musePollRef.current);
      musePollRef.current = null;
      if (museSlowTimer.current) clearTimeout(museSlowTimer.current);
      museSlowTimer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const persistable = messages.filter((m) => !m.thinking);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable.slice(-MAX_MESSAGES)));
    } catch {
      /* storage full — chat still works for the session */
    }
  }, [messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function stopMusePolling() {
    if (musePollRef.current) clearInterval(musePollRef.current);
    musePollRef.current = null;
    if (museSlowTimer.current) clearTimeout(museSlowTimer.current);
    museSlowTimer.current = null;
    setMuseThinking(false);
    setMuseSlow(false);
    try {
      localStorage.removeItem(QUEUE_KEY);
    } catch {}
  }

  function appendMuseDeep(response: string) {
    setMessages((prev) => {
      if (prev.some((m) => m.museDeep && m.text.includes(response.slice(0, 50)))) return prev;
      return [...prev, { role: "pookie", text: `🧠 **Mookie adds:**\n\n${response}`, museDeep: true, persona: "muse" }];
    });
  }

  /**
   * Start (or restart) polling for a Mookie queue answer. Polls immediately
   * once — the answer may already be waiting — then every 2s. After 5
   * minutes without an answer, backs off to 10s and shows the "taking
   * longer" state instead of silently giving up; the response is never
   * stranded while this component (or a remount) is alive.
   */
  function startMusePoll(qid: string) {
    if (musePollRef.current) clearInterval(musePollRef.current);
    const tick = async () => {
      const response = await pollMuseQueue(qid);
      if (response) {
        stopMusePolling();
        appendMuseDeep(response);
      }
    };
    // Immediate first poll — don't wait 2s when the answer is already there.
    void tick();
    musePollRef.current = setInterval(() => void tick(), 2000);
    if (museSlowTimer.current) clearTimeout(museSlowTimer.current);
    museSlowTimer.current = setTimeout(() => {
      // 5 min with no answer: back off, don't abandon.
      setMuseSlow(true);
      if (musePollRef.current) clearInterval(musePollRef.current);
      musePollRef.current = setInterval(() => void tick(), 10000);
      // Hard stop at 30 min — the queue entry expires at 24h, but the UI
      // shouldn't poll forever. The bridge message explains the state.
      museSlowTimer.current = setTimeout(() => {
        stopMusePolling();
        setMessages((prev) => [
          ...prev,
          {
            role: "pookie",
            text: "Mookie's deep dive is taking longer than usual, Captain — the request is still in the queue and will land here when it's ready. Ask me anything else in the meantime! 🔬",
          },
        ]);
      }, 25 * 60 * 1000);
    }, 5 * 60 * 1000);
  }

  /** Escalate to async Muse for a deeper take (Pookie mode only). */
  const escalateToMuse = useCallback(
    async (question: string, llamaResponse: string) => {
      if (!POOKIE_TUTOR_URL) return;
      if (museThinking) {
        // Never silently drop a depth request — tell the user Mookie is
        // already on it.
        setMessages((prev) => [
          ...prev,
          {
            role: "pookie",
            text: "Mookie's already charting a deeper course on your last question, Captain — hang tight, it'll land here in a moment! 🔬",
          },
        ]);
        return;
      }
      const bridge: ChatMessage = {
        role: "pookie",
        text: "Here's what I think so far 👆\n\nHang tight — Mookie is putting together a better plan for you… 🔬",
      };
      setMessages((prev) => [...prev, bridge]);
      setMuseThinking(true);
      try {
        const qid = await enqueueMuse(question, llamaResponse, context, messagesRef.current);
        try {
          localStorage.setItem(QUEUE_KEY, JSON.stringify({ qid, ts: Date.now() }));
        } catch {}
        startMusePoll(qid);
      } catch {
        // Enqueue failed: retract the promise, don't leave it hanging.
        setMuseThinking(false);
        setMessages((prev) => [
          ...prev.filter((m) => m !== bridge),
          {
            role: "pookie",
            text: "I tried to hail Mookie for a deeper take but the signal didn't get through, Captain. My answer above still stands — want me to try again?",
          },
        ]);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [museThinking]
  );

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isThinking) return;
    setDraft("");

    // Persona layer — FR-AI-002: under-18 (or unknown age) never gets the
    // Muse voice, keyword or otherwise. Adults: toggle, else keyword trigger.
    const persona: ChatPersona = !isAdult
      ? "pookie"
      : effectiveDirect
        ? "muse"
        : detectPersonality(trimmed);

    const userMsg: ChatMessage = { role: "user", text: trimmed, persona };

    if (!POOKIE_TUTOR_URL) {
      const fallback: ChatMessage = { role: "pookie", text: FALLBACK_MESSAGE, persona };
      setMessages((prev) => [...prev, userMsg, fallback].slice(-MAX_MESSAGES));
      return;
    }

    const history = messagesRef.current;
    const thinking: ChatMessage = { role: "pookie", text: "", thinking: true, persona };
    setMessages((prev) => [...prev, userMsg, thinking].slice(-MAX_MESSAGES));

    askTutor(history, trimmed, context, persona).then(
      (reply) => {
        const done: ChatMessage = { role: "pookie", text: reply, persona };
        setMessages((prev) => prev.map((m) => (m.thinking ? done : m)).slice(-MAX_MESSAGES));
        // Pookie shifts color to match the class being discussed.
        const neon = detectClassNeon(`${trimmed} ${reply}`);
        if (neon.id !== "pookie") setPookieColor(neon.neon);
        // Smart routing (Pookie voice only): does this need Muse's deeper take?
        if (persona === "pookie") {
          if (WANTS_DEPTH.test(trimmed)) {
            void escalateToMuse(trimmed, reply);
          } else if (reply.length > 80) {
            void classifyNeedsDepth(trimmed, reply).then((needsDepth) => {
              if (needsDepth) void escalateToMuse(trimmed, reply);
            });
          }
        }
      },
      () => {
        const fallback: ChatMessage = { role: "pookie", text: FALLBACK_MESSAGE, persona };
        setMessages((prev) => prev.map((m) => (m.thinking ? fallback : m)).slice(-MAX_MESSAGES));
      }
    );
  }

  return (
    <main className="chat-shell relative mx-auto flex w-full max-w-2xl flex-col px-4 pt-6">
      <style>{POOKIE_AVATAR_KEYFRAMES}</style>
      <div className="firefly" style={{ width: 8, height: 8, top: "10%", left: "8%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "30%", left: "92%", animationDelay: "1.8s" }} />

      <div className="animate-bloom flex items-center gap-4">
        <div className="relative">
          <PookieOrb size={52} />
          {/* comm signal indicator — the channel is open */}
          <span
            aria-hidden="true"
            className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-nebula-950"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
          </span>
        </div>
        <div>
          <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
            <span aria-hidden="true" className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-nova-400 align-middle" />
            Ship comms · Pookie
          </p>
          <h1 className="text-sunlit mt-1 text-2xl font-semibold tracking-tight">Hailing your co-pilot</h1>
        </div>
      </div>
      {isAdult ? (
        <div className="animate-bloom mt-3 flex items-center gap-3" style={{ animationDelay: "0.08s" }}>
          <button
            type="button"
            role="switch"
            aria-checked={directMode}
            onClick={() => setDirectMode((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              directMode ? "bg-nova-400/70" : "bg-nebula-700"
            }`}
            aria-label="Direct mode"
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-star-100 transition-all ${
                directMode ? "left-[22px]" : "left-0.5"
              }`}
            />
          </button>
          <p className="text-xs text-stardust-300">
            <span className="font-medium text-star-100">Direct mode</span>
            {directMode ? " on — blunter answers. " : " — blunter answers when it's on. "}
            Safety rules don&apos;t change.
          </p>
        </div>
      ) : (
        <p className="animate-bloom mt-2 text-xs text-stardust-500" style={{ animationDelay: "0.08s" }}>
          Your devoted co-pilot for the whole mission — school, plans, tasks, life. Direct mode is for adults (18+) — same safety, same smarts.
        </p>
      )}

      <div
        ref={scrollRef}
        className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-nebula-700 px-4 py-2.5 text-[15px] leading-relaxed text-star-100 shadow-glow-sm">
                {m.text}
              </p>
            </div>
          ) : m.thinking ? (
            <div key={i} className="flex gap-2.5">
              <MiniPookie size={24} speaking />
              <div className="rounded-2xl rounded-bl-md border border-nova-400/20 bg-nebula-900/70 px-4 py-3">
                <p className="animate-pulse text-sm text-stardust-300">
                  {m.persona === "muse" ? "Mookie is charting…" : "Pookie is plotting the course…"}
                </p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              {m.persona === "muse" || m.museDeep ? <MiniMuse size={24} /> : <MiniPookie size={24} mood={moodForMessage(m.text)} />}
              <div
                className="min-w-0 flex-1 rounded-2xl rounded-bl-md px-4 py-3"
                style={
                  m.persona === "muse" || m.museDeep
                    ? {
                        background: "linear-gradient(135deg, rgb(40 24 10 / 0.9), rgb(20 14 8 / 0.9))",
                        border: "1px solid rgb(251 146 60 / 0.35)",
                        boxShadow: "0 0 14px rgb(251 146 60 / 0.18)",
                      }
                    : {
                        background: "rgb(10 26 16 / 0.7)",
                        border: `1px solid ${pookieNeon}30`,
                        boxShadow: `0 0 12px ${pookieNeon}22`,
                      }
                }
              >
                {(m.persona === "muse" || m.museDeep) && (
                  <p className="mb-1 text-[10px] font-bold tracking-[0.22em] text-orange-300 uppercase">
                    {m.museDeep ? "Mookie · deeper take" : "Muse · straight talk"}
                  </p>
                )}
                <BotText text={m.text} />
              </div>
            </div>
          )
        )}
        {museThinking && (
          <div className="flex gap-2.5">
            <MiniMuse size={24} />
            <div className="pookie-researching rounded-2xl rounded-bl-md border border-orange-400/40 bg-nebula-900/70 px-4 py-3">
              <p className="animate-pulse text-sm text-orange-300">
                {museSlow
                  ? "🔬 Mookie's deep dive is taking a little longer — still on it, Captain…"
                  : "🔬 Mookie is cooking up something good…"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pt-3 pb-1">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="rounded-full border border-nova-400/30 bg-nebula-800/60 px-3.5 py-1.5 text-[13px] font-medium text-nova-300 transition-transform hover:scale-[1.03] active:scale-[0.97]"
            >
              ✨ {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
        >
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={isThinking ? "Holding the channel…" : "Hail Pookie — what's on your mind, Captain?"}
            aria-label="Message Pookie"
            className="min-w-0 flex-1 rounded-2xl border border-nova-400/25 bg-nebula-900/80 px-4 py-3 text-[15px] text-star-100 placeholder:text-stardust-500 focus:border-nova-400/60 focus:outline-none"
            style={{ boxShadow: `0 0 16px ${pookieNeon}22` }}
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={!draft.trim() || isThinking}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-nova-500 text-xl font-bold text-nebula-950 shadow-glow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
          >
            <span aria-hidden="true">↑</span>
          </button>
        </form>
      </div>
    </main>
  );
}
