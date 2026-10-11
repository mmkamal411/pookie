"use client";

/**
 * Per-class neon identities — Pookie tints to match the class being
 * discussed. Subtle, distinct, readable. Ported from d-dash's tutor.
 */

export interface ClassNeon {
  id: string;
  /** hex for border/glow accents */
  neon: string;
  /** rgba triple for shadow glows */
  glow: string;
  /** readable text color on the neon */
  text: string;
  /** name + alias matchers (lowercase) */
  match: string[];
}

export const CLASS_NEONS: ClassNeon[] = [
  { id: "apcsp", neon: "#22d3ee", glow: "34,211,238", text: "#a5f3fc",
    match: ["ap csp", "apcsp", "computer science", "csp"] },
  { id: "envsci", neon: "#4ade80", glow: "74,222,128", text: "#bbf7d0",
    match: ["environmental", "env sci", "envsci"] },
  { id: "chinese", neon: "#f87171", glow: "248,113,113", text: "#fecaca",
    match: ["chinese"] },
  { id: "gov", neon: "#fbbf24", glow: "251,191,36", text: "#fde68a",
    match: ["government", "gov"] },
  { id: "geometry", neon: "#a78bfa", glow: "167,139,250", text: "#ddd6fe",
    match: ["geometry"] },
  { id: "litcomp", neon: "#f472b6", glow: "244,114,182", text: "#fbcfe8",
    match: ["lit", "comp ii", "literature", "litcomp"] },
];

/** Default Pookie green when no specific class is detected. */
export const DEFAULT_NEON: ClassNeon = {
  id: "pookie",
  neon: "#4ade80",
  glow: "74,222,128",
  text: "#bbf7d0",
  match: [],
};

/** Detect which class a message is about from class names/aliases. */
export function detectClassNeon(text: string): ClassNeon {
  const lower = text.toLowerCase();
  for (const n of CLASS_NEONS) {
    if (n.match.some((m) => lower.includes(m))) return n;
  }
  return DEFAULT_NEON;
}
