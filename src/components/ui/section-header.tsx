// SectionHeader — the one consistent section heading across Pookie.
// Eyebrow (small caps, softly glowing) + Title Case heading + optional
// action slot, closed out by a soft neon divider. Divine-light: the
// divider is a fading gradient with a soft glow, never a hard rule.
//
// Title Case enforcement: when `title` arrives entirely lower- or
// upper-case it is converted to Title Case automatically (Mehedi's
// standing rule). Mixed-case titles are left untouched so proper nouns
// and brand names never get mangled.
//
// Props:
//   eyebrow — tiny lead-in line (rendered in caps)
//   title   — the heading text (Title Case enforced)
//   sub     — one quiet supporting line
//   action  — optional right-aligned slot (a link, button, badge…)
//   level   — heading level: 2 (default) | 3

import type { ReactNode } from "react";

const SMALL_WORDS = new Set([
  "a", "an", "and", "as", "at", "but", "by", "for", "in", "nor", "of", "on",
  "or", "so", "the", "to", "up", "via", "vs", "with", "yet",
]);

/** Convert an all-lower or all-upper string to Title Case. */
export function toTitleCase(input: string): string {
  if (!input) return input;
  const letters = input.replace(/[^a-zA-Z]/g, "");
  const isLower = letters === letters.toLowerCase();
  const isUpper = letters === letters.toUpperCase();
  if (!isLower && !isUpper) return input; // mixed case — trust the author
  return input
    .split(/(\s+)/)
    .map((word, i) =>
      word.trim().length === 0
        ? word
        : i !== 0 && SMALL_WORDS.has(word.toLowerCase())
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

export function SectionHeader({
  eyebrow,
  title,
  sub,
  action,
  level = 2,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? "h3" : "h2";
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold tracking-[0.18em] text-nova-300/90 uppercase [text-shadow:0_0_12px_rgb(244_114_182/0.45)]">
              {eyebrow}
            </p>
          )}
          <Heading className="text-sunlit mt-0.5 truncate text-lg font-semibold tracking-tight">
            {toTitleCase(title)}
          </Heading>
          {sub && <p className="mt-0.5 text-xs leading-relaxed text-stardust-300">{sub}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {/* soft neon divider — E3 system */}
      <hr aria-hidden="true" className="neon-divider neon-pink mt-2 border-0" />
    </div>
  );
}
