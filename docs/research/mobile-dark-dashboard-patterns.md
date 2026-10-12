# Research: Mobile Dark Dashboard Patterns (Space-Black)

**Team 2, Researcher 2 — 2026-10-12.** Recommendations for Pookie's space-black layout: floating corner controls, bottom tab bar with center hero, cards on dark, text contrast.

## 1. Floating Corner Controls
- **Size:** 40–48px touch targets (44px iOS minimum; our 40px menu button gets 44px hit area via padding).
- **Placement:** top-right corner, 12–16px from edges, below the status-bar safe area (`env(safe-area-inset-top)`). Top-right is the correct slot for secondary/utility controls — primary actions stay thumb-reachable at the bottom.
- **Treatment:** circular, 1px neon border at 0.35 alpha, dark fill at 0.8 alpha + backdrop blur, subtle breathing glow. It should read as "instrument," not "button" — small, quiet, always findable.
- **Behavior:** opens a dropdown panel (not a full screen) for quick utility menus; panel anchors to the button's corner.

## 2. Bottom Tab Bar with Center Hero
- **Structure:** 5 tabs (Home · Today · Pookie · Progress · More), center tab elevated as the hero (our orb). This is the established pattern (e.g. center FAB in material-style bars).
- **Active state:** accent-colored label + small underline/LED tick; inactive tabs at 60% opacity. Always show labels — icon-only bars hurt comprehension.
- **Bar treatment:** dark glass (`#0B1020` at 0.85 + blur), 1px cyan LED strip along the top edge, `env(safe-area-inset-bottom)` padding. Fixed, never scrolls away.
- **Content clearance:** pages keep a bottom spacer (we use `h-32`) so the deck never covers content.

## 3. Cards on Dark Backgrounds
- **Depth without shadows:** on near-black, shadows are invisible — use 1px borders at 0.1–0.2 alpha + elevation via lighter surfaces (`#050510` → `#0B1020` → `#111832`).
- **Radius:** 6–8px max on panels, 6px buttons/inputs. Large pill radii read as "consumer app," not "instrument."
- **Corner brackets:** 8–10px L-marks in the accent color at top-left + bottom-right on key panels — the single cheapest way to get the HUD feel.
- **Information density:** one idea per card; collapsed by default, expandable on tap.

## 4. Text Contrast on Black
- **Targets (WCAG AA):** 4.5:1 normal text, 3:1 large text / UI components.
- **Our tokens vs `#050510`:** primary `#E8F0FE` ≈ 15:1 ✓; dim `#8A9BB8` ≈ 5.5:1 ✓ (body-safe); faint `#4A5A78` ≈ 2.8:1 — captions/large labels only, never body copy.
- **Never pure black `#000000`:** causes halation (glow/blur) for users with astigmatism and OLED smearing. Our `#050510` base avoids this.
- **Never pure white `#FFFFFF` text:** use `#E8F0FE` (cool-tinted near-white) to cut eye strain.
- **Neon text:** cyan `#00E5FF` on black ≈ 10:1 — safe for labels and short readouts; avoid long neon paragraphs (vibration). Desaturate brights ~10% vs their light-mode equivalents.
- **Focus visibility:** keyboard focus rings must hit 3:1 on dark — use a 2px cyan outline at 0.7 alpha.

## 5. Applied to Pookie (checklist)
- [x] No top toolbar; 40px spacecraft User Menu button top-right.
- [x] Bottom Command Deck: 5 tabs, orb center hero, cyan LED top edge.
- [x] Panels: 6px radius, 1px `--space-line` borders, corner brackets on key surfaces.
- [x] Type: monospace readouts + sans prose; Title Case headings.
- [ ] Audit pass: any `text-white/40`-style utilities below 3:1 get bumped to dim token (Team 3 verification).
