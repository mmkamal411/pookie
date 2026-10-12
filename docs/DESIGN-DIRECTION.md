# Pookie Themes — Design Direction

**Status:** THE single source of truth for Pookie's visual design. Supersedes ALL prior direction docs.
**Issued:** Mon 2026-10-12 12:42 by Mehedi — TWO themes, user-switchable under Settings → Profile.

## The Two Themes

### "Space Black" (default)
Deep space black backgrounds with subtle animated glowing neon lights everywhere. "The black dashboard looked nicer." The problem was never dark — it was the LAVENDER/PURPLE wash.

### "Bright Bridge" (alternative)
The 9:35 AM reference direction: bright white bridge aesthetic, cool color temperature (icy blues, cyans, clean whites), well-lit airy interiors, holographic display panels, cosmic window as hero, LED strip lighting.

## Shared Rules (both themes)

- **NO top toolbar.** Removed entirely — it takes too much space.
- **Command Center button:** Small spacecraft-themed button tucked in the top-right corner with a **pulsing neon ring / blinking indicator** so users instantly find it. Opens the secret mission-critical menu.
- **Command Center menu:** Holographic panel unfolding, classified-document aesthetic, mission-critical styling. Contains User Profile, Theme switcher, Account settings, Child management, Sign out.
- **Bottom Command Deck:** Home / Today / Pookie / Progress / More. The ship's console. Persists across all pages.
- Title Case everywhere. Spacecraft metaphors only (no nature/growth language).
- **BANNED (both themes):** Lavender, purple washes, pink accents, warm tones. Zero warmth.

## Space Black Palette

| Token | Hex | Usage |
|---|---|---|
| `--space-black` | `#050510` | Primary background |
| `--space-panel` | `#0B1020` | Panel/surface background |
| `--space-elevated` | `#111832` | Elevated surfaces, cards |
| `--space-line` | `#1E2A4A` | Borders, hairlines |
| `--neon-cyan` | `#00E5FF` | Primary neon accent |
| `--neon-teal` | `#00FFC8` | Secondary accent |
| `--neon-green` | `#00FF88` | Go/healthy accent |
| `--neon-amber` | `#FFB300` | Warning/caution accent |
| `--neon-red` | `#FF4444` | Alert/critical accent |
| `--space-text` | `#E8F0FE` | Primary text |
| `--space-text-dim` | `#8A9BB8` | Secondary text |
| `--space-text-faint` | `#4A5A78` | Tertiary text |

## Bright Bridge Palette

| Token | Hex | Usage |
|---|---|---|
| `--bridge-white` | `#F4F8FA` | Primary background — cool white, icy |
| `--bridge-panel` | `#FFFFFF` | Panel/surface background |
| `--bridge-glass` | `#EAF2F6` | Elevated surfaces |
| `--bridge-line` | `#D5E2E9` | Borders, hairlines |
| `--bridge-cyan` | `#00B8D4` | Primary neon accent |
| `--bridge-ice` | `#7DD3FC` | Secondary accent |
| `--bridge-amber` | `#F59E00` | Warning/caution accent |
| `--bridge-green` | `#00C853` | Go/success accent |
| `--bridge-red` | `#E5484D` | Alert/critical accent |
| `--bridge-text` | `#0E1B24` | Primary text |
| `--bridge-text-dim` | `#4A6070` | Secondary text |
| `--bridge-text-faint` | `#8AA0AE` | Tertiary text |

## Implementation

- `data-theme="space-black"` (default, no attribute) / `data-theme="bright-bridge"` on `<html>`
- `useTheme()` hook in `src/components/use-theme.ts` — `Theme = "space-black" | "bright-bridge"`
- localStorage key: `pookie-theme`
- Instant switch, no reload, persists across sessions
