// EmptyState — the Nebula seedling placeholder. An unbuilt module is "taking
// root" — a designed state that renders real registry data and ONE real
// seed-it-now action, never a dead "coming soon" tile (Mehedi standing rule).
// Also exports EmptyCategoryCard: the age-gated empty-category state
// (sol-ux §9) — growth framing, never "you're too young".
//
// Props (EmptyState):
//   icon        — leading glyph (default 🌱)
//   title       — headline
//   message     — one or two plain-English lines
//   actionLabel — the single seed-it-now action label
//   onAction    — REQUIRED when actionLabel is set; the real handler
//
// Props (EmptyCategoryCard):
//   categoryName — e.g. "Travel"
//   suggestion   — { moduleName, reason } — one visible adjacent module to try

"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon = "🌱",
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card padding="lg" className="text-center">
      <div aria-hidden="true" className="text-3xl" style={{ filter: "drop-shadow(0 0 10px rgb(52 211 153 / 0.5))" }}>
        {icon}
      </div>
      <p className="text-sunlit mt-3 text-base font-semibold">{title}</p>
      {message && <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-stardust-300">{message}</p>}
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </Card>
  );
}

/** Growth-framed empty state for a category with no visible modules. */
export function EmptyCategoryCard({
  categoryName,
  suggestion,
}: {
  categoryName: string;
  suggestion?: { moduleName: string; reason: string };
}) {
  return (
    <div className="card-living rounded-2xl p-5 text-center">
      <div aria-hidden="true" className="text-2xl">🌌</div>
      <p className="mt-2 text-sm font-medium text-star-100">Nothing here for you right now.</p>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-stardust-300">
        Some parts of Pookie unlock as you get older. Pookie grows with you.
      </p>
      {suggestion && (
        <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-stardust-300">
          Meanwhile, <span className="font-semibold text-nova-300">{suggestion.moduleName}</span> {suggestion.reason}
        </p>
      )}
      <p className="mt-2 text-[11px] text-stardust-500 italic">{categoryName} · a grove still growing</p>
    </div>
  );
}
