"use client";

import { useEffect, useRef, useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";
import {
  subscribeOrbMood,
  type OrbMoodName,
} from "@/lib/orb/orb-events";

/**
 * ReactiveOrb — the orb as one living presence across the app.
 *
 * Squad Oracle (2026-10-12): wraps PookieOrb and listens to the global
 * orb event bus (src/lib/orb/orb-events.ts). Transient moods
 * (celebrating, excited) decay back to the base mood after their hold
 * window; thinking/listening/revelation persist until calmed.
 *
 * Priority: an explicit `mood` prop always wins over the bus — used by
 * the chat header, which manages its own conversation state.
 */
export function ReactiveOrb({
  size = 56,
  mood: forcedMood,
  interactive = true,
  className,
}: {
  size?: number;
  mood?: OrbMoodName;
  interactive?: boolean;
  className?: string;
}) {
  const [busMood, setBusMood] = useState<OrbMoodName>("idle");
  const decayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (forcedMood) return; // the parent drives this orb directly
    const clearDecay = () => {
      if (decayTimer.current) clearTimeout(decayTimer.current);
      decayTimer.current = null;
    };
    const unsub = subscribeOrbMood((mood, detail) => {
      clearDecay();
      setBusMood(mood);
      // Transient moods decay back to the resting breath.
      if (mood === "celebrating" || mood === "excited") {
        decayTimer.current = setTimeout(
          () => setBusMood("idle"),
          detail.holdMs ?? 4000
        );
      }
    });
    return () => {
      clearDecay();
      unsub();
    };
  }, [forcedMood]);

  const mood = forcedMood ?? busMood;

  return (
    <span className={className} style={{ display: "inline-flex" }}>
      <PookieOrb size={size} mood={mood} interactive={interactive} />
    </span>
  );
}
