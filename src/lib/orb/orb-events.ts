/**
 * Orb event bus — the divine orb is one presence across the whole app.
 *
 * Squad Oracle (2026-10-12): Mehedi's identity — "divine bright light,
 * all-knowing, part of God — here to guide you through your journey and
 * on your side to help you win."
 *
 * Any part of the app can tell the orb what just happened; every mounted
 * ReactiveOrb listens and responds with the right mood. Events are
 * window CustomEvents so server components, API callbacks, and client
 * components all speak the same language.
 *
 * Moods (see pookie-orb.tsx OrbMood):
 * - idle        — the resting breath, quiet radiance
 * - listening   — the user is speaking/typing; gentle attentive pulse
 * - thinking    — the orb is contemplating; deep inner swirl
 * - excited     — something good is about to happen; quickened light
 * - celebrating — a win! radiant flare, sparks dance
 * - revelation  — the orb is delivering a briefing; deep radiant swell
 */

export type OrbMoodName =
  | "idle"
  | "listening"
  | "thinking"
  | "excited"
  | "celebrating"
  | "revelation";

export interface OrbEventDetail {
  /** Why the orb should react — shown nowhere, for debugging. */
  reason?: string;
  /** How long (ms) to hold this mood before decaying back to idle. */
  holdMs?: number;
}

const PREFIX = "orb:";

function dispatch(mood: OrbMoodName, detail: OrbEventDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new window.CustomEvent(`${PREFIX}${mood}`, { detail }));
}

/** A win happened — grade up, task done, streak milestone. Radiant flare. */
export function orbCelebrate(reason: string, holdMs = 4000) {
  dispatch("celebrating", { reason, holdMs });
}

/** The orb is contemplating something — deep inner swirl. */
export function orbThink(reason?: string) {
  dispatch("thinking", { reason });
}

/** The user is speaking — the orb leans in, listening. */
export function orbListen(reason?: string) {
  dispatch("listening", { reason });
}

/** Something good is brewing — quickened light. */
export function orbExcite(reason?: string, holdMs = 3000) {
  dispatch("excited", { reason, holdMs });
}

/** The orb is delivering a briefing — deep radiant swell. */
export function orbReveal(reason?: string) {
  dispatch("revelation", { reason });
}

/** All is quiet — return to the resting breath. */
export function orbCalm(reason?: string) {
  dispatch("idle", { reason });
}

/** Subscribe to orb mood events. Returns an unsubscribe function. */
export function subscribeOrbMood(
  onMood: (mood: OrbMoodName, detail: OrbEventDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const moods: OrbMoodName[] = [
    "idle",
    "listening",
    "thinking",
    "excited",
    "celebrating",
    "revelation",
  ];
  const handlers = moods.map((mood) => {
    const handler = (e: Event) =>
      onMood(mood, (e as CustomEvent<OrbEventDetail>).detail ?? {});
    window.addEventListener(`${PREFIX}${mood}`, handler);
    return { mood, handler };
  });
  return () => {
    handlers.forEach(({ mood, handler }) =>
      window.removeEventListener(`${PREFIX}${mood}`, handler)
    );
  };
}
