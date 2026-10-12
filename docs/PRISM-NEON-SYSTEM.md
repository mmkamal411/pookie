# PRISM NEON SYSTEM — Tokens, Classes, and Usage

**Owner:** Prism E3 (UI Engineer, neon system) · 2026-10-12
**Status:** Imported app-wide via `src/app/globals.css` → `src/styles/neon-system.css`
**Rule:** This file is the single source of truth for glows. E4 / other squads: **use these classes — do not hand-roll box-shadows.**

---

## 1. Tokens

### Color tokens (Tailwind v4 `@theme` — full utilities generated)

| Token | Hex | Use for |
|---|---|---|
| `--color-neon-green` | `#4ade80` | Success, on-track states, grade ≥ 90 |
| `--color-neon-teal` | `#2dd4bf` | Default accent, interactive surfaces |
| `--color-neon-blue` | `#7dd3fc` | Info, navigation, secondary highlights |
| `--color-neon-pink` | `#f472b6` | CTAs, links, active states (matches Nova) |

Because they live in `@theme`, you get `text-neon-teal`, `bg-neon-pink/40`, `border-neon-blue`, etc. for free.

### RGB triplet tokens (for dialling glow alpha in custom CSS)

```css
--neon-green-rgb: 74 222 128;
--neon-teal-rgb: 45 212 191;
--neon-blue-rgb: 125 211 252;
--neon-pink-rgb: 244 114 182;
```

Pattern: `box-shadow: 0 0 18px rgb(var(--neon-teal-rgb) / 0.35);`

## 2. Color selectors

Behavior classes read `--nx` (default: teal). Set the color by composing:

```tsx
.neon-green  /* green glow */  .neon-teal  /* teal glow (default) */
.neon-blue   /* blue glow  */  .neon-pink  /* pink glow */
```

## 3. Behavior classes

| Class | Effect | Use on |
|---|---|---|
| `.neon-hover` | Soft glow (16px blur, 0.32) on hover | Links, icon buttons, list rows |
| `.neon-focus` | Focus-ring glow (`:focus-visible` only) | Every focusable element; never remove outlines without this |
| `.neon-active` | Pressed: scale 0.97 + inner/outer glow | Buttons, tabs |
| `.neon-current` | Persistent glow + tinted border | Active nav item, selected tab, current step |
| `.neon-divider` | 1px gradient hairline, glows at center | Between sections (`<hr class="neon-divider neon-blue" />`) |
| `.neon-card` | Lifts 2px + glow on hover | Content cards, panels, menu tiles |
| `.neon-cta` | Persistent button glow, intensifies on hover, presses on active | **One** primary action per surface |
| `.neon-shine` | Single shine sweep on hover (no loop) | Hero surfaces only, sparingly |

### Design contract (non-negotiable)

- Opacity **0.25–0.5**, blur **12–24px** on every glow. Never harsh.
- All transitions **200ms ease** (shared contract in the file; shine sweep 600ms).
- `.neon-cta` is rationed: one primary action per surface. Secondary buttons get `.neon-hover`.

## 4. Examples

```tsx
// Primary action
<button className="neon-cta neon-pink">Add Child</button>

// Card grid
<div className="neon-card neon-blue rounded-2xl p-4">...</div>

// Nav with current-page indicator
<nav>
  <a className={`neon-hover neon-teal ${active ? "neon-current" : ""}`}>Home</a>
</nav>

// Section break
<hr className="neon-divider neon-green" />

// Focus-safe custom button
<button className="neon-hover neon-focus neon-active neon-teal">Save</button>

// Text-only accent (no glow, Tailwind utility)
<span className="text-neon-pink">Live</span>
```

## 5. Themes

- Dark (Nebula) and light (`[data-theme="light"]`) both supported; light theme softens card/hover glows so they stay luminous on white.
- `prefers-reduced-motion: reduce` disables all neon transitions, the shine sweep, and hover transforms. Glows that are already visible remain static.

## 6. File layout

```
src/styles/neon-system.css   ← this system (imported by globals.css)
src/app/globals.css          ← Nebula tokens, legacy glow classes, page CSS
```

Do **not** add new glow box-shadows to `globals.css` — extend this system instead.
