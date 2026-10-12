# Mission Critical Spacecraft — Design Direction

**Status:** THE single source of truth for Pookie's visual design. Supersedes all prior direction docs.
**Issued:** Mon 2026-10-12 by the Managing Director, on Mehedi's directive after he reviewed the Pookie chat page: *"It looks more like a lavender spa station. Nothing that looks like a Mission Critical Spacecraft."*

## The Idea

The app is a spacecraft the user is flying. Every surface should read as a **NASA mission control instrument panel** — angular, technical, phosphor-lit, mission-critical. Not a spa. Not a chat app. A ship.

## Palette Tokens

| Token | Hex | Usage |
|---|---|---|
| `--hull-void` | `#05080C` | Primary background — deep space black |
| `--hull-deck` | `#0A0F16` | Panel/surface background — dark slate |
| `--hull-bulkhead` | `#11161F` | Elevated surfaces, cards |
| `--hull-line` | `#1E2836` | Borders, hairlines — visible but quiet |
| `--hull-cyan` | `#00E5FF` | Primary neon accent — data, active states, CTAs |
| `--hull-amber` | `#FFB300` | Warning/caution accent — alerts, pending, attention |
| `--hull-green` | `#00FF88` | Go/success accent — confirmed, healthy, online |
| `--hull-red` | `#FF4D5A` | Alert/critical accent — errors, urgent, offline |
| `--hull-text` | `#E8F1F2` | Primary text — near-white, cool tint |
| `--hull-text-dim` | `#8A99A8` | Secondary text — slate gray |
| `--hull-text-faint` | `#5A6B7D` | Tertiary text — labels, captions |

**BANNED:** Lavender, purple washes, pink-on-dark backgrounds, soft pastel blobs. The old lavender palette is dead. Pink may appear only inside the Pookie orb itself (divine light), never as a page accent.

## Panel Specs (HUD Cards)

- Background: `var(--hull-bulkhead)` at 0.85–0.95 opacity
- Border: 1px solid `var(--hull-line)`, with a **1px neon edge accent** on one edge (top or left) in the panel's semantic color
- **Corner brackets:** small L-shaped corner marks (8px × 8px, 1px stroke) in the accent color at the panel's top-left and bottom-right corners — the "instrument bezel" look
- Border radius: **8px max**, typically 4–6px. Pill shapes (24px+) are banned except for small status chips.
- Shadow: none (no drop shadows). Depth comes from the neon edge line + faint inner glow.
- Glow spec: `box-shadow: 0 0 12px rgb(var(--hull-cyan) / 0.15)` on the accent edge only. Never full-box neon.

## Typography

- **Data readouts** (grades, stats, telemetry, timestamps, numbers): monospace — `ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace`. Uppercase labels, letter-spacing 0.08em, in `--hull-text-dim`.
- **Prose** (body text, chat messages, descriptions): clean sans — system stack. Normal case, Title Case for headings.
- **Headings:** Title Case everywhere (Mehedi's rule). Section headers get a small neon tick mark (▸) in accent color, not emoji.
- **Never:** all-lowercase headings, emoji in headings, decorative script fonts.

## Chat Surfaces

- Message bubbles → **angular message panels**: 6px radius, 1px border (`--hull-line`), user messages get a cyan left-edge accent, Pookie messages get a subtle green left-edge accent.
- Avatars: small square (28px, 4px radius) status-light style, not big soft circles.
- Typing indicator: three blinking status dots in accent color, monospace "TRANSMITTING…" label.
- Input bar: instrument-panel style — dark deck background, 1px border, monospace placeholder, send button as a square neon-edged key.

## The Orb

Keep the Pookie orb, but demote it: **ambient instrument light, not the hero of every page.** Smaller (≤64px on pages, ≤48px in toolbar), subtler glow, no plate. Divine-light color cycling stays (it's Pookie's signature), but opacity of the glow drops to 0.3–0.5. The orb is the ship's AI core — it should feel like it's embedded in the console, not floating in a spa.

## Bottom Toolbar Console

Already on the right track (PWR/SHD bars, sector labels, mission clock). Push further:
- Darker background (`--hull-void`), sharper top edge (1px cyan hairline, no soft gradient)
- Tab labels in monospace uppercase, 10px, letter-spaced
- Active tab: cyan underline bar + cyan text, not a glowing pill
- Keep the orb centered but smaller

## Backgrounds

- Deep space black (`--hull-void`) base. Starfield stays. Nebula stays but **desaturate and darken it** — it should read as deep space through a viewport, not a purple gradient wash.
- Page transitions: background shifts subtly (the "course change" feel) — keep this, it works.

## Corner-Radius Rules

| Element | Max radius |
|---|---|
| Panels, cards, modals | 8px |
| Buttons | 6px |
| Inputs | 6px |
| Chat message panels | 6px |
| Status chips, badges | 12px (small pills OK here) |
| Avatars, icons | 4px (squarish) |

## Glow Rules (replaces the old neon-system softness)

- Opacity: 0.1–0.25 for ambient glows, never 0.5+
- Blur radius: 8–16px, not 24px+
- Glows live on **edges and status lights**, never full-surface washes
- Phosphor style: think CRT/radar green-on-black, not Instagram gradient

## What Survives From the Old Direction

- Title Case everywhere
- Subtle neon, never harsh
- The orb itself (demoted, not removed)
- Starfield + nebula background (darkened)
- Ship-console toolbar concept
- Collapsed-by-default, expandable detail (intuitiveness)
- Shame-free, elevated copy

## What Dies

- Lavender/purple page washes
- 24px+ pill radii on panels and bubbles
- Soft full-surface glows
- Pink as a page accent color
- "Spa station" rounded-everything aesthetic
