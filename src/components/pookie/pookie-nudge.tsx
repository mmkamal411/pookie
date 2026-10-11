"use client";

import { useEffect, useState } from "react";
import {
  POOKIE_TUTOR_URL,
  buildTutorContext,
  type TutorContext,
} from "@/lib/pookie-tutor";
import { CLASS_NEONS, detectClassNeon } from "@/components/pookie/class-neons";
import type { SchoolOverview } from "@/lib/school/types";

const TUTOR_TIMEOUT_MS = 10000;
const SEEN_KEY = "pookie-nudge-seen";

/** Ask the worker for one short proactive line grounded in live data. */
async function generateNudge(trigger: string, context: TutorContext): Promise<{ text: string; classId?: string } | null> {
  if (!POOKIE_TUTOR_URL) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TUTOR_TIMEOUT_MS);
  try {
    const res = await fetch(`${POOKIE_TUTOR_URL}/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            role: "user",
            text:
              `[SYSTEM: You are Pookie, ${context.studentName}'s AI study buddy. Write ONE short nudge — ` +
              `max 12 words, like a friend tapping his shoulder. Warm, specific, actionable. ` +
              `Trigger: ${trigger}. Use the live data. ` +
              `If it's about a specific class, name the class. ` +
              `Never mention you are an AI.]`,
          },
        ],
        context,
      }),
    });
    if (!res.ok) throw new Error(`tutor ${res.status}`);
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("empty");
    const text = data.reply.trim();
    const neon = detectClassNeon(text);
    return { text, classId: neon.id === "pookie" ? undefined : neon.id };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Local fallback when the AI is unreachable — still data-driven. */
function fallbackNudge(trigger: string, context: TutorContext): { text: string; classId?: string } {
  const weakest = context.weakestClass;
  const due = context.dueNext[0];
  if (trigger === "sync-complete" && weakest) {
    return { text: `${weakest.name} needs love at ${weakest.grade ?? "—"}` };
  }
  if (due) {
    return { text: `${due.title} — ${due.due}` };
  }
  if (weakest) {
    return { text: `${weakest.name} at ${weakest.grade ?? "—"} — let's fix that` };
  }
  return { text: "Ready to make today count?" };
}

function alreadyShownToday(key: string): boolean {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
    return seen[key] === new Date().toDateString();
  } catch {
    return false;
  }
}

function markShownToday(key: string) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as Record<string, string>;
    seen[key] = new Date().toDateString();
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* best-effort */
  }
}

/**
 * PookieNudgeHost — tiny bubble above the toolbar orb.
 * Welcome nudge once per day (3s in); sync-complete nudge when the
 * `pookie-sync-just-done` flag is fresh. Auto-dismisses after 12s.
 * Fixed positioning means it can mount from any tab that has overview data.
 */
export function PookieNudgeHost({
  overview,
  childName,
}: {
  overview: SchoolOverview;
  childName: string;
}) {
  const [trigger, setTrigger] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | undefined>(undefined);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("pookie") === "test") {
        const t = setTimeout(() => setTrigger("welcome"), 800);
        return () => clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
    if (!alreadyShownToday("nudge-welcome")) {
      const t = setTimeout(() => {
        setTrigger("welcome");
        markShownToday("nudge-welcome");
      }, 3000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    try {
      const flag = localStorage.getItem("pookie-sync-just-done");
      if (flag) {
        const age = Date.now() - parseInt(flag, 10);
        localStorage.removeItem("pookie-sync-just-done");
        if (age < 60000 && !alreadyShownToday("nudge-sync")) {
          const t = setTimeout(() => {
            setTrigger("sync-complete");
            markShownToday("nudge-sync");
          }, 2000);
          return () => clearTimeout(t);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!trigger) return;
    let cancelled = false;
    const context = buildTutorContext(overview, childName);
    (async () => {
      const result = (await generateNudge(trigger, context)) ?? fallbackNudge(trigger, context);
      if (cancelled) return;
      setText(result.text);
      setClassId(result.classId);
      setVisible(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [trigger, overview, childName]);

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => setVisible(false), 12000);
    return () => clearTimeout(t);
  }, [text]);

  if (!trigger || !visible) return null;

  const neon = classId ? CLASS_NEONS.find((c) => c.id === classId) : CLASS_NEONS[0];

  return (
    <div
      className="animate-rise fixed bottom-24 left-1/2 z-50 -translate-x-1/2"
      role="status"
      aria-live="polite"
      aria-label="Pookie nudge"
    >
      <div
        className="relative max-w-60 rounded-2xl rounded-bl-md border px-3 py-2 backdrop-blur-md"
        style={{
          borderColor: `${neon?.neon}55`,
          background: "rgb(6 15 10 / 0.92)",
          boxShadow: `0 0 16px rgba(${neon?.glow},0.25), 0 4px 16px rgba(0,0,0,0.5)`,
        }}
      >
        {text ? (
          <p className="text-xs leading-snug font-semibold text-star-100">{text}</p>
        ) : (
          <div className="flex items-center gap-1 py-1" aria-label="Pookie is thinking">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1.5 animate-bounce rounded-full"
                style={{ backgroundColor: neon?.neon, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          aria-label="Dismiss nudge"
          onClick={() => setVisible(false)}
          className="absolute -top-1.5 -right-1.5 rounded-full bg-nebula-700 px-1 text-[10px] text-stardust-300 shadow hover:text-star-100"
        >
          ✕
        </button>
        <div
          className="absolute -bottom-[5px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-r border-b"
          style={{ borderColor: `${neon?.neon}55`, background: "rgb(6 15 10 / 0.92)" }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
