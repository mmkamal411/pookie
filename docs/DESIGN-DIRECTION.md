# Bright White Bridge — Design Direction

**Status:** THE single source of truth for Pookie's visual design. Supersedes all prior direction docs (including the interim "Mission Critical Spacecraft / deep space blacks" draft).
**Issued:** Mon 2026-10-12 by the Managing Director, on Mehedi's correction: the 9:35 AM visual target stands — the **BRIGHT WHITE BRIDGE** aesthetic from his reference images. "Deep space blacks" was wrong. The lavender/purple wash is the enemy.

## The Idea

The app is a spacecraft the user is flying — but it's the **bright, well-lit bridge**, not a dark dungeon. Think the white bridge shots: cool color temperature, every panel lit up, holographic cyan displays, a panoramic cosmic window as the emotional centerpiece. A cockpit you'd want to spend your morning in.

## Palette Tokens

| Token | Hex | Usage |
|---|---|---|
| `--bridge-white` | `#F4F8FA` | Primary background — cool white, icy |
| `--bridge-panel` | `#FFFFFF` | Panel/surface background — clean white |
| `--bridge-glass` | `#EAF2F6` | Elevated surfaces, secondary cards |
| `--bridge-line` | `#D5E2E9` | Borders, hairlines — cool gray-blue |
| `--bridge-cyan` | `#00B8D4` | Primary neon accent — data, active states, CTAs (slightly deeper than dark-mode cyan for light-surface contrast) |
| `--bridge-ice` | `#7DD3FC` | Secondary accent — highlights, hover states |
| `--bridge-amber` | `#F59E00` | Warning/caution accent — alerts, pending |
| `--bridge-green` | `#00C853` | Go/success accent — confirmed, healthy |
| `--bridge-red` | `#E5484D` | Alert/critical accent — errors, urgent |
| `--bridge-text` | `#0E1B24` | Primary text — deep slate, near-black with cool tint |
| `--bridge-text-dim` | `#4A6070` | Secondary text — slate |
| `--bridge-text-faint` | `#8AA0AE` | Tertiary text — labels, captions |

**BANNED:** Lavender, purple washes, pink as a page accent, warm tones of any kind. Zero warmth. The old lavender palette is dead.

**Dark mode** may exist as a user option (the Hull dark tokens are preserved), but the **default signature look is bright, cool, well-lit**.

## Panel Specs (Holographic Display Panels)

- Background: `var(--bridge-panel)` (white) or `var(--bridge-glass)` (elevated)
- Border: 1px solid `var(--bridge-line)`, with a **1px cyan LED-strip accent** along one edge (top or left)
- **Corner brackets:** small L-shaped corner marks (8px × 8px, 1px stroke) in `--bridge-cyan` at top-left and bottom-right — the instrument bezel look
- Border radius: **8px max**, typically 4–6px. Pill shapes (24px+) banned except small status chips.
- Shadow: soft, cool — `0 2px 12px rgb(0 184 212 / 0.08)`. No heavy drop shadows.
- Glow spec: subtle cyan edge glow `0 0 10px rgb(0 184 212 / 0.12)` on the accent edge. Holographic, not neon-sign.

## The Window (Emotional Centerpiece)

- Every page background features the **cosmic viewport**: stars/Earth visible through a panoramic window framing. This is the hero of the page, not the orb.
- The window sits BEHIND the bright panels — panels float over the viewport like bridge consoles.
- Keep the starfield. Nebula: cool teal/cyan wisps only, very low alpha, never purple.

## LED Strip Lighting

- Thin cyan strips (1–2px) run along panel top edges, section dividers, and the toolbar top edge.
- Status lights: small (6–8px) glowing dots — cyan (active), green (ok), amber (pending), red (alert).

## Typography

- **Data readouts** (grades, stats, telemetry, timestamps, numbers): monospace — `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace`. Uppercase labels, letter-spacing 0.08em, in `--bridge-text-dim`.
- **Prose** (body text, chat messages, descriptions): clean sans — system stack. Title Case for headings.
- **Headings:** Title Case everywhere (Mehedi's rule). Section headers get a small cyan tick mark (▸).
- **Never:** all-lowercase headings, emoji in headings, decorative scripts.

## Chat Surfaces

- Messages → **angular panels**: white/glass background, 6px radius, 1px `--bridge-line` border, cyan left-edge accent for user, green for Pookie.
- Avatars: small square (28px, 4px radius) status-light bezels.
- Typing indicator: three blinking cyan dots + monospace "TRANSMITTING…" label.
- Input bar: console style — white panel, 1px border, cyan focus glow, square send key.

## The Orb

Ambient instrument light, not the hero. Smaller (≤64px on pages, ≤48px toolbar), subtle glow. Divine-light color cycling stays (Pookie's signature) but the orb sits within the bright bridge like a holographic core — it should glow gently against the light surfaces. The WINDOW is the page hero, not the orb.

## Bottom Toolbar Console

Bright bridge version: white/glass background, cyan top LED-strip edge, monospace uppercase tab labels (10px, letter-spaced), active tab = cyan underline + cyan text. PWR/SHD bars in cyan/green. Orb centered, smaller.

## Corner-Radius Rules

| Element | Max radius |
|---|---|
| Panels, cards, modals | 8px |
| Buttons | 6px |
| Inputs | 6px |
| Chat message panels | 6px |
| Status chips, badges | 12px |
| Avatars, icons | 4px |

## What Survives

- Title Case everywhere
- Angular HUD panels, corner brackets, LED strips, status lights
- Monospace data readouts + clean sans prose
- The orb (demoted to ambient)
- Starfield + cool nebula (never purple)
- Collapsed-by-default, expandable detail
- Shame-free, elevated copy

## What Dies

- Deep space black backgrounds as the default (dark mode = option only)
- Lavender/purple washes (the enemy)
- 24px+ pill radii on panels and bubbles
- Warm tones of any kind
- The orb as page hero
