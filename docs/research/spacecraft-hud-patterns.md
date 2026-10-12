# Research: Spacecraft HUD Patterns for Space-Black + Neon

**Team 2, Researcher 1 — 2026-10-12.** Question: how do the best spacecraft/sci-fi HUD interfaces handle dark backgrounds + neon without looking cheap? Sources: SpaceX Dragon capsule touchscreen UI, NASA mission control, Elite Dangerous / Star Citizen HUDs, Linear / Vercel / Raycast dark dashboards.

## 7 Techniques to Adopt

### 1. Progressive disclosure (SpaceX Dragon)
Dragon replaced 1,000+ shuttle switches with three touchscreens that show only the controls relevant to the current flight phase. **Adopt:** keep Pookie's collapsed-by-default pattern; each module shows its top-3 actions first, detail expands on tap. Never render every control at once — density is the enemy of the cockpit feel.

### 2. Monochromatic accent discipline (Elite Dangerous)
Elite's HUD is famously ONE hue (orange default; players re-theme to a single cyan). Restraint is what makes it read as "instrument," not "arcade." **Adopt:** cyan (#00E5FF) is the primary neon everywhere; green/amber/red are reserved strictly for semantic status (go / caution / alert). Never decorate with all four at once on one surface.

### 3. Edge-lighting, never washes (sci-fi HUDs + Star Citizen)
Game HUDs glow on 1px edges, corner brackets, and status dots — panels themselves stay near-black. Full-surface color washes are what read as cheap. **Adopt:** glows live on borders and LED strips at 0.1–0.25 alpha; panel fills stay `#050510`–`#111832`. This is already our rule — enforce it in review.

### 4. Translucent layered panels (Elite's cockpit UI)
Elite's panels are faintly translucent so the scene behind stays visible; depth comes from elevation (lighter surfaces), not drop shadows. **Adopt:** panels at ~0.92 alpha over the starfield; elevation = lighter surface token (`--space-elevated`), not shadows. Shadows on black are invisible anyway.

### 5. Data-first monospace readouts (NASA mission control)
Mission control is tables of monospace telemetry: uppercase 10–11px labels, tabular numbers, values in the accent color. **Adopt:** grades, stats, timestamps, counts all render in monospace (`hull-readout` / `space-readout`); prose stays in clean sans. Uppercase labels with 0.08–0.12em letter-spacing.

### 6. Ambient status lights (Dragon's physical backups + LED strips)
Spacecraft pair every color signal with a label or icon — color is never the only channel. **Adopt:** small 6–8px pulsing status dots (`.glow-dot`) always sit next to a text label ("Secure", "Synced", "Pending"). Mehedi's rule stands: no emoji in headings; dots + words.

### 7. Restraint in motion (Linear / Vercel / Raycast)
The best dark dashboards animate at 200ms ease, lift cards 2–4px on hover, and pulse CTAs on 3s+ cycles. Nothing strobes; nothing begs for attention. **Adopt:** transitions 200ms; ambient glows on 3–4s `ease-in-out` infinite cycles at low alpha; `prefers-reduced-motion` stills everything (already global in our CSS — keep it).

## What "cheap" looks like (avoid)
- Multi-color gradients across whole panels; rainbow text.
- High-alpha outer glows (bloom) on large surfaces.
- Flicker / strobe effects (also an accessibility hazard).
- Neon on every element — if everything glows, nothing does. Accent the 10% that matters.
