# Research: Animated Glow Techniques + CSS Utility Library

**Team 2, Researcher 3 — 2026-10-12.** Micro-interactions and animated glow techniques for the Space Black Command Deck. The library ships in `src/styles/neon-system.css` ("SPACE BLACK COMMAND DECK" block); this doc is the usage guide.

## Performance Rules (non-negotiable)
1. **Animate cheap properties.** `transform` and `opacity` are GPU-composited. `box-shadow` animation triggers paint — acceptable only on small elements (buttons, dots, 40px icons) and at low counts (≤ ~20 animated glows per viewport).
2. **Slow cycles.** 3–4s `ease-in-out infinite` for ambient glows. Fast pulsing (<1s) reads as alarm, not ambience.
3. **Low alpha.** Ambient glow alpha 0.1–0.25; hover/active may reach 0.5 briefly. Never strobe.
4. **No layout thrash.** Keyframes touch only `box-shadow`, `opacity`, `transform`, `background-position` — never width/height/margin.
5. **Reduced motion.** The global `prefers-reduced-motion` rule stills all animation; the library adds its own guard so utilities degrade to static glows.
6. **Shimmer via pseudo-element.** Border shimmer uses an `::after` gradient sweep with `transform: translateX()` — composited, not painted per frame.

## The Library

| Class | Effect | Use on |
|---|---|---|
| `.glow-breathe` | Slow box-shadow breathe (3.6s) in `--gx` accent | Menu button, orb ring, hero panels |
| `.glow-breathe-fast` | 2.2s variant | Typing indicator container |
| `.glow-dot` | 8px status light, pulsing halo (2.4s) | "Secure", "Synced", "Aboard" readouts |
| `.glow-edge-shimmer` | 1px top-edge gradient sweep (4s) | Panel accent edges, deck LED strip |
| `.glow-text` | Soft animated text-shadow (3s) | Short neon labels, never paragraphs |
| `.glow-hover` | Lift 2px + glow on hover, 200ms | Cards, rows |
| `.glow-static` | One-shot static glow, no animation | Reduced-motion fallback, calm surfaces |

Accent override: `--gx: var(--neon-green-rgb)` (default cyan). Example:

```html
<button class="glow-breathe" style="--gx: var(--neon-green-rgb)">Launch</button>
<span class="glow-dot" style="--gx: var(--neon-amber-rgb)"></span>
```

## Keyframes (in neon-system.css)
- `glow-breathe`: `0%,100%` soft halo → `50%` slightly stronger halo.
- `glow-dot-pulse`: opacity/scale pulse on the dot's halo ring.
- `edge-shimmer`: `translateX(-120%)` → `translateX(120%)` gradient sweep.
- `glow-text-soft`: text-shadow 4px→8px drift.

## Don't
- Stack `.glow-breathe` on large panels (paint cost) — use `.glow-edge-shimmer` or static `box-shadow` instead.
- Animate glows on scroll-driven lists; keep them on chrome (buttons, deck, headers).
- Use flicker keyframes anywhere (accessibility hazard).
