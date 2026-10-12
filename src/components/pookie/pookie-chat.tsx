"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
import { setPookieColor } from "@/components/pookie/pookie-color";
import { orbListen, orbThink, orbCelebrate, orbCalm } from "@/lib/orb/orb-events";
import { MiniPookie, MiniMuse, moodForMessage, POOKIE_AVATAR_KEYFRAMES } from "@/components/pookie/pookie-avatars";

const STORAGE_KEY = "pookie-chat-v1";
const QUEUE_KEY = "pookie-muse-queue";
const MAX_MESSAGES = 50;
const LONG_MESSAGE = 300;

const QUICK_REPLIES = ["What are my priorities today?"];

/** Local chat keyframes — blinking status dots for the transmitting indicator. */
const BRIDGE_CHAT_KEYFRAMES = `
  @keyframes bridge-blink { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
`;

/** Explicit depth requests escalate to the async Mookie queue.
 *  Exact keyword list from Mehedi — this list IS the escalation contract. */
const WANTS_DEPTH =
  /\bmookie\b|deeper|more detail|better plan|go deeper|\bdetailed\b|\bcomprehensive\b|\bdeep\b|\bmore\b|\btonight\b|\bdive\b|\bthorough\b|\btoday\b|this week|this month|this term|this semester|studentvue|parentvue|\bctls\b|\bclever\b|\bresearch\b|\bsearch\b|\bfind\b|\btalk\b|\bthink\b/i;

/** Action intents — "remind me to X", "add a task to X", "todo: X".
 *  Squad Value: Pookie Chat → Actions. When detected, we create a real
 *  family task via the API and confirm in-chat. */
const TASK_INTENT =
  /^(?:remind me to|remind me|add (?:a )?task(?: to)?|todo:?|task:?)\s+(.+)/i;

async function tryCreateTaskFromIntent(text: string): Promise<string | null> {
  const m = text.trim().match(TASK_INTENT);
  if (!m) return null;
  const title = m[1].trim().slice(0, 280);
  if (!title) return null;
  try {
    const res = await fetch("/api/v1/household/tasks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, source: "pookie-chat" }),
    });
    const json = await res.json();
    if (!json.ok) return null;
    return title;
  } catch {
    return null;
  }
}

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

/** Square status-light frame around chat avatars (4px radius per bridge spec). */
function StatusFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="shrink-0 border p-0.5"
      style={{
        borderColor: "rgb(var(--bridge-line-rgb))",
        background: "rgb(var(--bridge-glass-rgb))",
        borderRadius: 4,
      }}
    >
      {children}
    </div>
  );
}

/** Three blinking status dots — the mission-control typing indicator. */
function TypingDots({ tone = "green" }: { tone?: "green" | "amber" }) {
  const rgb = tone === "amber" ? "var(--bridge-amber-rgb)" : "var(--bridge-green-rgb)";
  return (
    <span className="flex items-center gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: `rgb(${rgb})`,
            animation: `bridge-blink 1.2s ease-in-out ${d * 0.2}s infinite`,
          }}
        />
      ))}
    </span>
  );
}

function BotText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const cyan = { color: "rgb(var(--bridge-cyan-rgb))" } as const;
  if (text.length <= LONG_MESSAGE || expanded) {
    return (
      <div>
        <p
          className="text-[15px] leading-[1.65] whitespace-pre-wrap"
          style={{ color: "rgb(var(--bridge-text-rgb))" }}
        >
          {text}
        </p>
        {text.length > LONG_MESSAGE && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="mt-1 text-xs font-medium hover:underline"
            style={cyan}
          >
            Show Less
          </button>
        )}
      </div>
    );
  }
  return (
    <div>
      <p
        className="line-clamp-4 text-[15px] leading-[1.65] whitespace-pre-wrap"
        style={{ color: "rgb(var(--bridge-text-rgb))" }}
      >
        {text}
      </p>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="mt-1 text-xs font-medium hover:underline"
        style={cyan}
      >
        Read Full Answer ▾
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
  const [museThinking, setMuseThinking] = useState(false);
  const [museSlow, setMuseSlow] = useState(false);
  // Squad Singularity: the one orb lives in the toolbar — the chat speaks
  // to her through the orb event bus. She listens while you type, thinks
  // while the answer brews, and flares warm when it lands.
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Squad Singularity: while the user types, the toolbar orb leans in — listening.
  useEffect(() => {
    if (isThinking) return; // thinking takes precedence
    if (draft.trim().length > 0) orbListen("chat typing");
    else orbCalm("chat idle");
  }, [draft, isThinking]);

  useEffect(() => {
    return () => {
      if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
    };
  }, []);

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
    // Squad Singularity: the toolbar orb contemplates — deep inner swirl.
    orbThink("chat answering");

    // Squad Value: Pookie Chat → Actions. Detect task intents and create
    // a real family task. The confirmation rides along with Pookie's reply.
    const taskPromise = tryCreateTaskFromIntent(trimmed);

    askTutor(history, trimmed, context, persona).then(
      async (reply) => {
        const createdTitle = await taskPromise;
        const finalReply = createdTitle
          ? `Done, Captain — I've added "${createdTitle}" to the family task list. ✓\n\n${reply}`
          : reply;
        const done: ChatMessage = { role: "pookie", text: finalReply, persona };
        setMessages((prev) => prev.map((m) => (m.thinking ? done : m)).slice(-MAX_MESSAGES));
        // Squad Singularity: the answer lands — the toolbar orb flares warm,
        // then drifts back to rest on its own.
        if (celebrateTimer.current) clearTimeout(celebrateTimer.current);
        orbCelebrate("chat reply landed", 2600);
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
        orbCalm("chat fallback");
      }
    );
  }

  return (
    <main
      className="relative mx-auto flex w-full max-w-2xl flex-col px-4 pt-6"
      style={{ background: "rgb(var(--bridge-white-rgb) / 0.86)" }}
    >
      <style>{`${POOKIE_AVATAR_KEYFRAMES}\n${BRIDGE_CHAT_KEYFRAMES}`}</style>

      {/* Header — bright instrument panel with cyan LED strip and corner brackets */}
      <header className="bridge-panel bridge-panel-accent bridge-cyan animate-bloom px-4 py-3">
        <div className="flex items-center gap-4">
          {/* AI core link — ambient instrument light; the one orb watches from the toolbar. */}
          <div
            className="relative flex h-8 w-8 items-center justify-center rounded-full"
            style={{
              border: "1px solid rgb(var(--bridge-cyan-rgb) / 0.35)",
              background: "rgb(var(--bridge-cyan-rgb) / 0.06)",
            }}
            aria-hidden="true"
          >
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{
                background: "rgb(var(--bridge-green-rgb))",
                boxShadow: "0 0 8px rgb(var(--bridge-green-rgb) / 0.55)",
              }}
            />
            <span
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid rgb(var(--bridge-cyan-rgb) / 0.12)",
                animation: "orb-beckon 4s ease-in-out infinite",
              }}
            />
          </div>
          <div>
            <p className="bridge-title">Ship Comms · Pookie</p>
            <h1
              className="mt-1 text-2xl font-semibold tracking-tight"
              style={{ color: "rgb(var(--bridge-text-rgb))" }}
            >
              Hailing Your Co-Pilot
            </h1>
          </div>
        </div>

        {/* Technical readouts — link state, mode, message count */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1" role="status">
          <span>
            <span className="bridge-readout-label">Link </span>
            <span className="bridge-readout text-[11px]" style={{ color: "rgb(var(--bridge-green-rgb))" }}>
              Secure
            </span>
          </span>
          <span>
            <span className="bridge-readout-label">Mode </span>
            <span className="bridge-readout text-[11px]">{effectiveDirect ? "Direct" : "Pookie"}</span>
          </span>
          <span>
            <span className="bridge-readout-label">Msgs </span>
            <span className="bridge-readout text-[11px]">{messages.length}</span>
          </span>
        </div>

        {/* Squad Gavel 2026-10-12 — persistent AI disclosure: subtle, always visible during chat. */}
        <p
          className="mt-2 text-[11px]"
          style={{ color: "rgb(var(--bridge-text-faint-rgb))" }}
          role="note"
        >
          You&apos;re chatting with Pookie, an AI assistant. Responses are generated automatically and may be inaccurate — verify important details.
        </p>

        {isAdult ? (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={directMode}
              aria-label="Direct mode"
              onClick={() => setDirectMode((v) => !v)}
              className="bridge-btn px-3 py-1.5 text-[11px]"
            >
              Direct · {directMode ? "On" : "Off"}
            </button>
            <p className="text-xs" style={{ color: "rgb(var(--bridge-text-dim-rgb))" }}>
              Blunter answers when it&apos;s on. Safety rules don&apos;t change.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs" style={{ color: "rgb(var(--bridge-text-faint-rgb))" }}>
            Your devoted co-pilot for the whole mission — school, plans, tasks, life. Direct mode is for adults (18+) — same safety, same smarts.
          </p>
        )}
      </header>

      <div
        ref={scrollRef}
        className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
        aria-live="polite"
      >
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p
                className="bridge-msg bridge-msg-user max-w-[85%] px-4 py-2.5 text-[15px] leading-relaxed"
                style={{ color: "rgb(var(--bridge-text-rgb))" }}
              >
                {m.text}
              </p>
            </div>
          ) : m.thinking ? (
            <div key={i} className="flex gap-2.5">
              <StatusFrame>
                <MiniPookie size={24} speaking />
              </StatusFrame>
              <div className="bridge-msg bridge-msg-ai flex items-center gap-3 px-4 py-3">
                <TypingDots />
                <p className="bridge-readout text-[11px]" style={{ color: "rgb(var(--bridge-text-dim-rgb))" }}>
                  {m.persona === "muse" ? "Analyzing…" : "Transmitting…"}
                </p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex gap-2.5">
              <StatusFrame>
                {m.persona === "muse" || m.museDeep ? (
                  <MiniMuse size={24} />
                ) : (
                  <MiniPookie size={24} mood={moodForMessage(m.text)} />
                )}
              </StatusFrame>
              <div
                className={`bridge-msg min-w-0 flex-1 px-4 py-3 ${
                  m.persona === "muse" || m.museDeep ? "bridge-amber" : "bridge-msg-ai"
                }`}
              >
                {(m.persona === "muse" || m.museDeep) && (
                  <p
                    className="mb-1 text-[10px] font-bold tracking-[0.22em] uppercase"
                    style={{ color: "rgb(var(--bridge-amber-rgb))" }}
                  >
                    {m.museDeep ? "Mookie · Deeper Take" : "Muse · Straight Talk"}
                  </p>
                )}
                <BotText text={m.text} />
              </div>
            </div>
          )
        )}
        {museThinking && (
          <div className="flex gap-2.5">
            <StatusFrame>
              <MiniMuse size={24} />
            </StatusFrame>
            <div className="bridge-msg bridge-amber flex items-center gap-3 px-4 py-3">
              <TypingDots tone="amber" />
              <p className="bridge-readout text-[11px]" style={{ color: "rgb(var(--bridge-text-dim-rgb))" }}>
                {museSlow ? "Deep Scan Delayed — Still On It…" : "Deep Scan In Progress…"}
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
              className="bridge-btn px-3 py-1.5 text-[11px]"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="bridge-panel bridge-panel-accent bridge-cyan p-2">
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
              className="bridge-input min-w-0 flex-1 px-4 py-3 text-[15px]"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!draft.trim() || isThinking}
              className="bridge-btn flex h-12 w-12 shrink-0 items-center justify-center text-lg disabled:opacity-40"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
