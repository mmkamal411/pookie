/**
 * GlassPane — every page as a digital glass viewscreen.
 *
 * Mehedi 2026-10-12: each page's content sits on a consistent frosted-glass
 * pane with a subtle neon edge and soft inner glow — like a modern sci-fi
 * spaceship viewscreen. One shared max-width (max-w-5xl) across the whole
 * site so the viewscreen never changes size between pages.
 *
 * Pages keep their own internal spacing; the pane is the frame, not the
 * layout. Text stays high-contrast on the glass — glows never touch
 * readability.
 */
export function GlassPane({ children }: { children: React.ReactNode }) {
  return <div className="glass-pane relative mx-auto w-full max-w-5xl">{children}</div>;
}
