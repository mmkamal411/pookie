"use client";

/**
 * The orb's greetings — Squad Orb (2026-10-12).
 * Mehedi's directive: be CREATIVE. Rotate through a curated pool of short,
 * classy, sophisticated sci-fi greetings. Never the same twice in a row
 * within a session. Time-aware, with rare/special ones for delight.
 * Tone: the poise of a starship's AI — literary sci-fi, never cartoon.
 */

export type Daypart = "morning" | "afternoon" | "evening" | "night";

export function daypartForHour(h: number): Daypart {
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

const POOL: Record<Daypart, string[]> = {
  morning: [
    "Good morning, Captain. Your ship is prepared.",
    "Good morning. The day is yours to chart.",
    "Good morning, Captain — a fresh orbit awaits.",
    "Rise and shine, Captain. All systems green.",
    "Good morning. The stars kept your course warm.",
  ],
  afternoon: [
    "Good afternoon, Captain. The helm is yours.",
    "Good afternoon. Steady as she goes.",
    "Good afternoon, Captain — the mission continues.",
    "Welcome back aboard, Captain.",
    "Good afternoon. Your ship held formation.",
  ],
  evening: [
    "Good evening, Captain. The stars are aligned.",
    "Good evening. The cosmos missed you, Captain.",
    "Good evening, Captain — orbit stable.",
    "The night shift is yours, Captain.",
    "Good evening. All decks await your command.",
  ],
  night: [
    "Burning the midnight oil, Captain?",
    "The quiet hours suit you, Captain.",
    "Still awake, Captain? The stars are listening.",
    "A night owl at the helm. I like it.",
  ],
};

/** Rare delights — surfaced sparingly, never twice in a session. */
const RARE = [
  "The cosmos missed you, Captain.",
  "Orbit stable. Ready when you are.",
  "All systems await your command.",
  "Welcome home, Captain.",
  "The void is quieter without you.",
];

const RARE_CHANCE = 0.18;

/**
 * Pick the next greeting. Avoids repeating the previous one; rare lines
 * appear occasionally and never repeat within the session.
 */
export function nextGreeting(
  state: { last: string | null; seenRare: Set<string> },
): { text: string; state: { last: string | null; seenRare: Set<string> } } {
  const daypart = daypartForHour(new Date().getHours());
  const unseenRare = RARE.filter((r) => !state.seenRare.has(r));
  if (unseenRare.length > 0 && Math.random() < RARE_CHANCE) {
    const pick = unseenRare[Math.floor(Math.random() * unseenRare.length)];
    return {
      text: pick,
      state: { last: pick, seenRare: new Set(state.seenRare).add(pick) },
    };
  }
  const candidates = POOL[daypart].filter((g) => g !== state.last);
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return { text: pick, state: { last: pick, seenRare: state.seenRare } };
}
