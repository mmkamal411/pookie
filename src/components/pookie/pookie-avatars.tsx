"use client";

import { getPookieColor, resolvePookieNeon } from "@/components/pookie/pookie-color";

/** Pookie's mood from message content — drives the avatar's gesture. */
export function moodForMessage(text: string): "happy" | "thinking" | "encouraging" | "idle" {
  const t = text.toLowerCase();
  if (/great|awesome|amazing|proud|nice work|well done|you got this/i.test(t)) return "happy";
  if (/let'?s|try|focus|you can|keep going|don't give up/i.test(t)) return "encouraging";
  if (/hmm|consider|think about|maybe|what if/i.test(t)) return "thinking";
  return "idle";
}

/**
 * Mini Pookie — the chat avatar. Matches the shared Pookie color, shifts
 * with the topic, and gestures subtly based on what she's saying.
 */
export function MiniPookie({
  size = 28,
  color,
  mood = "idle",
  speaking = false,
}: {
  size?: number;
  color?: string;
  mood?: "happy" | "thinking" | "encouraging" | "idle";
  speaking?: boolean;
}) {
  const neon = color ?? resolvePookieNeon(getPookieColor());
  const plump = getPookieColor() ? 1.12 : 1;

  const anim = speaking
    ? "pookie-speak 1.6s ease-in-out infinite"
    : mood === "happy"
      ? "pookie-happy 2.4s ease-in-out infinite"
      : mood === "encouraging"
        ? "pookie-nod 2s ease-in-out infinite"
        : mood === "thinking"
          ? "pookie-sway 3.2s ease-in-out infinite"
          : "pookie-idle 3.6s ease-in-out infinite";

  return (
    <div
      className="shrink-0 rounded-full"
      aria-hidden="true"
      style={{
        width: size * plump,
        height: size * (getPookieColor() ? 1.06 : 1),
        background: `radial-gradient(circle at 35% 30%, ${neon}cc, ${neon} 60%)`,
        boxShadow: `0 0 10px ${neon}55, inset 0 -2px 6px rgba(0,0,0,0.25)`,
        transition: "background 0.4s ease, box-shadow 0.4s ease",
        animation: anim,
      }}
    >
      <svg viewBox="0 0 40 40" style={{ width: size * plump, height: size }} aria-hidden="true">
        <circle cx="14" cy="16" r="2.6" fill="#2d2a26" />
        <circle cx="26" cy="16" r="2.6" fill="#2d2a26" />
        <circle cx="14.8" cy="15.2" r="0.9" fill="white" opacity="0.95" />
        <circle cx="26.8" cy="15.2" r="0.9" fill="white" opacity="0.95" />
        <ellipse cx="9.5" cy="20" rx="2" ry="1.3" fill="#ff9eb0" opacity="0.55" />
        <ellipse cx="30.5" cy="20" rx="2" ry="1.3" fill="#ff9eb0" opacity="0.55" />
        {mood === "happy" ? (
          <path d="M 15 23 Q 20 28.5 25 23 Q 20 26 15 23" fill="#2d2a26" />
        ) : mood === "thinking" ? (
          <path d="M 17 25 Q 20 26 23 24.5" stroke="#2d2a26" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        ) : (
          <path d="M 15 23.5 Q 20 27.5 25 23.5" stroke="#2d2a26" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

/** Mini Muse — direct, sharp, no-nonsense. Warm ember palette. */
export function MiniMuse({ size = 28 }: { size?: number }) {
  const neon = "#fb923c";
  return (
    <div
      className="shrink-0 rounded-full"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 35% 30%, #fed7aa, ${neon} 60%)`,
        boxShadow: `0 0 10px ${neon}55, inset 0 -2px 6px rgba(0,0,0,0.2)`,
        animation: "pookie-idle 3.6s ease-in-out infinite",
      }}
    >
      <svg viewBox="0 0 40 40" style={{ width: size, height: size }} aria-hidden="true">
        <circle cx="13" cy="16" r="3.5" fill="#2d2a26" />
        <circle cx="27" cy="16" r="3.5" fill="#2d2a26" />
        <circle cx="14.5" cy="14.5" r="1.2" fill="#fff" opacity="0.8" />
        <circle cx="28.5" cy="14.5" r="1.2" fill="#fff" opacity="0.8" />
        <circle cx="9" cy="21" r="2.5" fill="#f87171" opacity="0.5" />
        <circle cx="31" cy="21" r="2.5" fill="#f87171" opacity="0.5" />
        <path d="M 12 24 Q 20 32 28 24" stroke="#2d2a26" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Pookie chat keyframes — injected once per chat mount. */
export const POOKIE_AVATAR_KEYFRAMES = `
  @keyframes pookie-idle { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
  @keyframes pookie-speak { 0%,100% { transform: translateY(0) scale(1,1); } 30% { transform: translateY(-3px) scale(1.04,0.96); } 60% { transform: translateY(0) scale(0.97,1.03); } }
  @keyframes pookie-happy { 0%,100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-4px) rotate(-6deg); } 75% { transform: translateY(-4px) rotate(6deg); } }
  @keyframes pookie-nod { 0%,100% { transform: translateY(0); } 30% { transform: translateY(2px); } 60% { transform: translateY(-1px); } }
  @keyframes pookie-sway { 0%,100% { transform: translateX(0) rotate(0deg); } 50% { transform: translateX(2px) rotate(4deg); } }
  @keyframes pookie-border-breathe { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  @keyframes pookie-chip-pulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.25); } }
  @keyframes pookie-thinking-glow {
    0%, 100% { box-shadow: 0 0 12px rgb(0 229 255 / 0.3); }
    50% { box-shadow: 0 0 24px rgb(0 229 255 / 0.6), 0 0 48px rgb(0 229 255 / 0.3); }
  }
  .pookie-researching {
    position: relative;
    overflow: hidden;
    animation: pookie-thinking-glow 2s ease-in-out infinite;
  }
`;
