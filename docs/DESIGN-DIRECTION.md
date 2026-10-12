# Space Black Command Deck — Design Direction

**Status:** THE single source of truth for Pookie's visual design. Supersedes ALL prior direction docs.
**Issued:** Mon 2026-10-12 12:38 by Mehedi — "I like how we used to have shades of space black color with subtle animated glowing neon lights everywhere. The black dashboard looked nicer."

## The Correction

Mehedi killed the "Bright White Bridge" direction. The problem was NEVER dark — it was the LAVENDER/PURPLE wash. The signature look is **space black with subtle animated neon glows**. The white bridge draft (`fb28115`, `.bridge-*` tokens) is superseded but kept as reference.

## The Idea

The app is a spacecraft the user is flying — a **dark command deck** with subtle animated glowing neon lights everywhere. Think: deep space blacks, thin cyan/teal/green/amber neon edges on panels, soft animated glows that breathe, holographic data readouts. A cockpit that feels alive at night.

## Palette Tokens

| Token | Hex | Usage |
|---|---|---|
| `--space-black` | `#050510` | Primary background — deep space black |
| `--space-panel` | `#0B1020` | Panel/surface background — dark slate |
| `--space-elevated` | `#111832` | Elevated surfaces, cards |
| `--space-line` | `#1E2A4A` | Borders, hairlines — dark blue-gray |
| `--neon-cyan` | `#00E5FF` | Primary neon accent — data, active states, CTAs |
| `--neon-teal` | `#00FFC8` | Secondary accent — highlights, success |
| `--neon-green` | `#00FF88` | Go/healthy accent — confirmed, good news |
| `--neon-amber` | `#FFB300` | Warning/caution accent — alerts, pending |
| `--neon-red` | `#FF4444` | Alert/critical accent — errors, urgent |
| `--space-text` | `#E8F0FE` | Primary text — near-white with cool tint |
| `--space-text-dim` | `#8A9BB8` | Secondary text — muted blue-gray |
| `--space-text-faint` | `#4A5A78` | Tertiary text — labels, captions |

**BANNED:** Lavender, purple washes, pink as a page accent, warm tones of any kind. Zero warmth. The old lavender palette is dead. The white bridge is not the default.

## Layout Rules

- **NO top toolbar.** It opens up the screen. Removed 2026-10-12.
- **User Menu button:** Small spacecraft-themed button (40px) tucked in the top-right corner. Subtle cyan glow. Opens the User Menu. Never dominates.
- **Bottom Command Deck:** Home / Today / Pookie / Progress / More. The ship's console. Persists across all pages.
- **All other UI** = spacecraft modules. Angular panels, thin neon edges, corner brackets on key surfaces.
- **Pookie orb:** Center of the Command Deck. Subtle ambient glow, not the hero of every page.

## Animation

- Subtle animated glows everywhere — breathing, pulsing, shimmer. Never harsh, never strobing.
- Panels lift on hover/touch. Stars brighten near pointer. Buttons glow on interaction.
- "Not flat — alive."

## Typography

- Technical/monospace for data readouts (grades, stats, telemetry).
- Clean sans for prose.
- Title Case for all headings (Mehedi's standing rule).

## Language

- Spacecraft/spaceship/commander metaphors only. No grow/nature/plant metaphors (purged 2026-10-12).
