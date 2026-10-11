// Client-safe Cloudflare Worker tutor client.
// Ported from d-dash's tutor integration; the worker URL is build-time
// config (NEXT_PUBLIC_POOKIE_TUTOR_URL). When unset, the chat degrades to
// the local fallback — never a dead screen.
import type { SchoolOverview } from "@/lib/school/types";
import { letterGrade } from "@/lib/grades";
import { dueDateLabel } from "@/components/school/styles";

export const POOKIE_TUTOR_URL = (process.env.NEXT_PUBLIC_POOKIE_TUTOR_URL || "").replace(/\/$/, "");
export const TUTOR_TIMEOUT_MS = 10000;

/* ------------------------------------------------------------------ */
/* Personality — keyword-triggered, never a toggle                      */
/* ------------------------------------------------------------------ */

/** Pookie (default): warm tutor. Muse: direct, unfiltered straight-talk. */
export type ChatPersona = "pookie" | "muse";

/**
 * Trigger phrases that summon Muse's voice for the response. Case-insensitive
 * substring match against the user's message. Documented here by design —
 * this list IS the personality contract.
 */
export const MUSE_TRIGGERS = [
  "be straight with me",
  "straight talk",
  "no sugarcoating",
  "don't sugarcoat",
  "dont sugarcoat",
  "stop sugarcoating",
  "be honest",
  "be real",
  "be blunt",
  "blunt",
  "tough love",
  "real talk",
  "tell it like it is",
  "give it to me straight",
  "cut the fluff",
  "no fluff",
  "no bs",
  "brutal honesty",
  "brutally honest",
];

/** Keyword detection layer — runs before any chat request is sent. */
export function detectPersonality(text: string): ChatPersona {
  const lower = text.toLowerCase();
  return MUSE_TRIGGERS.some((t) => lower.includes(t)) ? "muse" : "pookie";
}

/**
 * Session rule: the personality reverts to Pookie on the next message
 * unless keywords trigger again. Each message is classified independently —
 * there is no sticky mode.
 */
export function museSystemInstruction(childName: string): string {
  return (
    `[SYSTEM: You are Muse — ${childName}'s straight-talk advisor, not the warm tutor. ` +
    `Be direct and unfiltered: no sugarcoating, no fluff, no excessive encouragement. ` +
    `Say the hard thing plainly in short sentences. Name the real problem, not the comfortable one. ` +
    `End with the single action that matters most. Never mention you are an AI or a language model.]`
  );
}

export const FALLBACK_MESSAGE =
  "Good question — here's what I can actually help with right now:\n\n" +
  "• Your grades and the path to 90 in any class (try \"How do I raise Geometry?\")\n" +
  "• What's due next, ordered by grade impact\n" +
  "• Study plans and making up missing work\n\n" +
  "Ask me one of those and I'll pull your real numbers.";

export interface ChatMessage {
  role: "user" | "pookie";
  text: string;
  /** Transient "thinking" bubble — never persisted, never sent to the backend. */
  thinking?: boolean;
  /** Muse's deeper take — rendered with distinct straight-talk styling. */
  museDeep?: boolean;
  /** Voice that produced this message — Muse persona shows the Muse indicator. */
  persona?: ChatPersona;
}

export interface TutorContext {
  studentName: string;
  timeOfDay: string;
  grades: { class: string; grade: number | null; letter: string }[];
  weakestClass: { name: string; grade: number | null; letter: string } | null;
  belowGoal: string[];
  dueNext: { title: string; class: string; due: string }[];
}

/** Build the live context payload from the shared SchoolOverview shape. */
export function buildTutorContext(overview: SchoolOverview, childName: string): TutorContext {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";
  const graded = overview.classes.filter((c) => c.numeric != null);
  const weakest =
    graded.length > 0
      ? [...graded].sort((a, b) => (a.numeric ?? 0) - (b.numeric ?? 0))[0]
      : null;
  return {
    studentName: childName,
    timeOfDay,
    grades: overview.classes.map((c) => ({
      class: c.display_name ?? c.name,
      grade: c.numeric,
      letter: letterGrade(c.numeric),
    })),
    weakestClass: weakest
      ? {
          name: weakest.display_name ?? weakest.name,
          grade: weakest.numeric,
          letter: letterGrade(weakest.numeric),
        }
      : null,
    belowGoal: overview.classes
      .filter((c) => c.numeric != null && c.numeric < 90)
      .map((c) => c.display_name ?? c.name),
    dueNext: overview.due_next.slice(0, 5).map((d) => ({
      title: d.title,
      class: d.class_name,
      due: dueDateLabel(d.due_date),
    })),
  };
}

function withTimeout(): { controller: AbortController; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TUTOR_TIMEOUT_MS);
  return { controller, done: () => clearTimeout(timer) };
}

/** POST /chat — Llama answers with the live context attached.
 *  persona="muse" sends mode:"muse" AND a system instruction prepended to the
 *  message (the worker may ignore the flag; the instruction is the reliable path). */
export async function askTutor(
  history: ChatMessage[],
  userText: string,
  context: TutorContext,
  persona: ChatPersona = "pookie"
): Promise<string> {
  const { controller, done } = withTimeout();
  try {
    const outgoing =
      persona === "muse"
        ? `${museSystemInstruction(context.studentName)}\n\n${userText}`
        : userText;
    const userMsg: ChatMessage = { role: "user", text: outgoing };
    const payload = {
      messages: [...history, userMsg]
        .filter((m) => !m.thinking && m.text.trim().length > 0)
        .slice(-20)
        .map((m) => ({ role: m.role, text: m.text })),
      context,
      mode: persona,
    };
    const res = await fetch(`${POOKIE_TUTOR_URL}/chat`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`tutor ${res.status}`);
    const data = (await res.json()) as { reply?: unknown };
    if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("empty reply");
    return data.reply.trim();
  } finally {
    done();
  }
}

/** Ask Llama whether a question needs Muse's deeper analysis. */
export async function classifyNeedsDepth(question: string, answer: string): Promise<boolean> {
  if (!POOKIE_TUTOR_URL) return false;
  const { controller, done } = withTimeout();
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
              `Question: "${question.slice(0, 300)}"\nAnswer given: "${answer.slice(0, 500)}"\n\n` +
              `Is this question fully and completely answered above, or would it benefit from deeper analysis, ` +
              `a detailed plan, or more thorough explanation? Reply with exactly one word: SIMPLE (fully answered, ` +
              `no more needed) or DEEP (needs more depth).`,
          },
        ],
      }),
    });
    done();
    if (!res.ok) return false;
    const data = (await res.json()) as { reply?: unknown };
    return String(data.reply || "").trim().toUpperCase().includes("DEEP");
  } catch {
    return false;
  } finally {
    done();
  }
}

/** Enqueue a question for Muse's async deeper take. Returns the queue id. */
export async function enqueueMuse(
  question: string,
  llamaResponse: string,
  context: TutorContext,
  history: ChatMessage[]
): Promise<string> {
  const { controller, done } = withTimeout();
  try {
    const res = await fetch(`${POOKIE_TUTOR_URL}/muse-queue`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: question,
        llamaResponse,
        context,
        history: history
          .filter((m) => !m.thinking && m.text.trim())
          .slice(-8)
          .map((m) => ({ role: m.role, text: m.text })),
      }),
    });
    if (!res.ok) throw new Error("queue failed");
    const data = (await res.json()) as { id?: unknown };
    if (typeof data.id !== "string" || !data.id) throw new Error("no queue id");
    return data.id;
  } finally {
    done();
  }
}

/** Poll one queue item. Returns the response text once answered, else null. */
export async function pollMuseQueue(queueId: string): Promise<string | null> {
  const { controller, done } = withTimeout();
  try {
    const res = await fetch(`${POOKIE_TUTOR_URL}/muse-queue/${queueId}`, {
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: unknown; response?: unknown };
    if (data.status === "answered" && typeof data.response === "string" && data.response.trim()) {
      return data.response.trim();
    }
    return null;
  } catch {
    return null;
  } finally {
    done();
  }
}
