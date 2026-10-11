# Audit Findings — Mobile Readiness of the Next.js Scaffold

**Auditor:** UI Full-Stack (Next.js 16 / React 19 / Tailwind) — Engineering Pod
**Date:** 2026-10-11
**Scope:** `~/workspace/pookie-app/src/**` (create-next-app scaffold: `layout.tsx`, `page.tsx`,
`globals.css`) inspected for web-only patterns that break inside a native mobile shell
(Capacitor WebView) or on mobile browsers generally.
**Status:** Findings only. No source files were edited.

Severity scale: **HIGH** (breaks rendering/interaction on phones), **MEDIUM** (degraded UX or
correctness risk), **LOW** (polish / future-proofing), **INFO** (confirmed fine).

Context: the scaffold is the stock create-next-app template — only 4 files. There is no app code
yet, so these findings are baseline defects to fix before the first real screen ships, plus
standards the build must follow.

---

## HIGH-1 — No `viewport` export: phones render at ~980px desktop width

**Location:** `src/app/layout.tsx` — metadata has `title`/`description` only; no `viewport`.

**Finding:** Without `width=device-width`, mobile browsers use a ~980px layout viewport and shrink
the page to fit. Every screen built on this scaffold renders tiny and zoomed-out on phones, and the
same applies inside a Capacitor WebView (WKWebView honors the meta viewport).

**Standard:** every root layout (and the `[childSlug]` layout if it overrides) must export:

```ts
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // pairs with safe-area handling (MEDIUM-2)
  themeColor: "#0b3b3e", // brand chrome color on mobile
};
```

Do **not** set `maximumScale: 1` / `userScalable: false` — it blocks pinch-zoom (accessibility).

---

## MEDIUM-1 — `h-full` / `min-h-full` instead of dynamic viewport units

**Location:** `src/app/layout.tsx` — `className="... h-full ..."` on `<html>`,
`min-h-full` on `<body>`.

**Finding:** `100%`/`100vh` track the *large* viewport; mobile browser chrome (URL bar show/hide)
makes the visible height change as the user scrolls, causing layout jumps and content hidden behind
the toolbar. In a Capacitor WebView the effect is smaller (no URL bar) but still present with
keyboard appearance and in-app browser chrome.

**Standard:** use `dvh` units for app shells (`min-h-dvh`), `svh` where a stable small viewport is
wanted. Reserve `%` heights for nested flex layouts only.

---

## MEDIUM-2 — No safe-area handling for notched devices

**Location:** `src/app/globals.css`, `src/app/layout.tsx` — no `env(safe-area-inset-*)` usage.

**Finding:** On notched iPhones / hole-punch Androids, full-bleed headers, bottom nav bars, and
sticky action buttons render under the notch or home indicator. With `viewportFit: "cover"`
(HIGH-1 fix) the WebView extends into the unsafe area by design — content must pad itself out.

**Standard:** define Tailwind v4 theme tokens for safe areas and use them on all fixed chrome:

```css
/* globals.css @theme */
--spacing-safe-top: env(safe-area-inset-top);
--spacing-safe-bottom: env(safe-area-inset-bottom);
```

```tsx
<header className="pt-safe-top ...">      {/* via theme tokens */}
<nav className="pb-[env(safe-area-inset-bottom)] ...">
```

---

## MEDIUM-3 — Hover-only interactive affordances

**Location:** `src/app/page.tsx` — buttons/links style interaction with `hover:` only
(`hover:bg-[#383838]`, `hover:border-transparent`, ...), no `active:` state.

**Finding:** Touch devices have no hover. Tap feedback is invisible, so buttons feel dead on
phones. This is a template habit that will propagate into every screen if not banned now.

**Standard:** every interactive element pairs `hover:` with `active:` (e.g.
`active:scale-[0.98] active:bg-...`), plus `focus-visible:` rings for keyboard/switch users.
Never use hover as the *only* signal of interactivity.

---

## MEDIUM-4 — No offline story (matters for the native shell)

**Location:** whole scaffold — no service worker, no `online`/`offline` event handling, no
cached-fallback UI.

**Finding:** The architecture is server-rendered (Server Components, RLS reads, Server Actions —
see handbook §8). In Capacitor remote-URL mode the WebView is a thin client: **no network ⇒ no
render**. Today there is not even an offline banner, so a subway tunnel shows a blank WebView
or a raw network error.

**Standard:** ship a global offline indicator (navigator.onLine + heartbeat fetch), and design
each tenant screen with an explicit degraded state (last-synced timestamp + cached content where
safe — never cached cross-tenant data). Full offline-first is out of scope; honest degraded mode
is not.

---

## MEDIUM-5 — iOS input auto-zoom trap waiting to happen

**Location:** none yet — preventive.

**Finding:** iOS Safari/WKWebView auto-zooms when focusing an input with `font-size < 16px`.
The scaffold has no forms yet, but the product is form-heavy (check-ins, portals credentials,
settings). If the design system ships 14px inputs, every form field will zoom-jerk on iPhones.

**Standard:** all text inputs/selects/textareas render at **≥16px** (`text-base` minimum) on
mobile. Enforce in the input primitives, not per-screen.

---

## LOW-1 — No touch-target standard established

**Location:** `src/app/page.tsx` — scaffold buttons are `h-12` (48px), which happens to be fine.

**Finding:** Nothing guarantees the next component keeps it. Apple HIG: 44pt minimum; Material: 48dp.

**Standard:** minimum **44×44pt** hit area for every tappable element; where visual size is smaller,
expand with `p-`/`-m-` utilities or `::before` hit-slop. Add an ESLint/stylelint-adjacent review
checklist item (no automated rule exists for this — it's a review gate).

---

## LOW-2 — No `theme-color`, no PWA manifest, no iOS web-app metas

**Location:** `src/app/layout.tsx`.

**Finding:** Cosmetic on its own, but `theme-color` controls the status-bar/chrome color in mobile
browsers and in-app browsers (school portal OAuth flows, email links). Covered by the HIGH-1 fix
(`themeColor` in the viewport export). No PWA manifest is needed — the strategy is a native shell
(Capacitor), not an installable web app — but `apple-mobile-web-app-capable` remains useful for
"add to home screen" escape hatches.

---

## LOW-3 — Font payload on cellular

**Location:** `src/app/layout.tsx` — `next/font/google` (Geist).

**Finding:** `next/font` self-hosts and subsets — already the right call. Keep it: no external
Google Fonts `<link>` (extra DNS + render-blocking on cellular). When brand fonts land, keep them
self-hosted via `next/font/local` with `display: swap` and latin subsetting.

---

## INFO — No bundle risk yet; keep it that way

The scaffold has zero dependencies beyond `next`/`react`. The mobile standard that preserves this:
prefer Server Components (zero client JS) for tenant screens, lazy-load heavy client widgets
(charts, editors) with `next/dynamic`, and hold a **200 KB gzip client-JS budget per route**
(measured via `next build` output in CI — DevOps owns the gate).

---

## Mobile-readiness checklist (before first TestFlight / internal track)

- [ ] `viewport` export with `device-width`, `initialScale: 1`, `viewportFit: "cover"`, `themeColor`
- [ ] App shell on `dvh` units; safe-area tokens on all fixed chrome
- [ ] `active:` + `focus-visible:` on every interactive element (hover never alone)
- [ ] All form inputs ≥16px
- [ ] 44pt minimum touch targets (review gate)
- [ ] Global offline indicator + per-screen degraded states
- [ ] Client-JS budget enforced in CI
