import type { Metadata } from "next";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Gavel 2026-10-12 — /accessibility.
 * Accessibility Statement: WCAG 2.1 AA commitment, what's done,
 * known limitations, and how to report issues.
 */

export const metadata: Metadata = {
  title: "Accessibility Statement — Pookie",
  description:
    "Pookie's commitment to accessibility, what we've done, and how to report issues.",
};

export default function AccessibilityPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Accessibility Statement"
      updated="October 12, 2026"
    >
      <section>
        <h2>Our Commitment</h2>
        <p>
          Pookie is for every family — including people who navigate with
          keyboards, screen readers, voice control, or other assistive
          technologies. We are committed to meeting the{" "}
          <strong>Web Content Accessibility Guidelines (WCAG) 2.1, Level
          AA</strong>, and to treating accessibility as an ongoing practice,
          not a one-time checklist.
        </p>
      </section>

      <section>
        <h2>What We&apos;ve Done</h2>
        <ul>
          <li>
            <strong>Keyboard navigation:</strong> all interactive elements are
            reachable and operable by keyboard, with visible focus indicators.
          </li>
          <li>
            <strong>Screen reader support:</strong> meaningful landmarks, labels,
            and live regions (such as chat updates) are announced.
          </li>
          <li>
            <strong>Reduced motion:</strong> we honor your operating
            system&apos;s reduced-motion setting — decorative animations
            (including orb and cosmic effects) are stilled or simplified.
          </li>
          <li>
            <strong>Contrast:</strong> text meets WCAG AA contrast ratios
            against its background; we avoid light-on-white and other
            low-contrast combinations.
          </li>
          <li>
            <strong>Touch targets:</strong> buttons and controls meet minimum
            touch-target sizes for mobile use.
          </li>
          <li>
            <strong>Plain language:</strong> legal and privacy content is
            written in plain language, and complex information is collapsed
            with expandable detail rather than hidden.
          </li>
        </ul>
      </section>

      <section>
        <h2>Known Limitations</h2>
        <p>
          We are still improving. Areas we know need work:
        </p>
        <ul>
          <li>
            Some data visualizations (charts, progress visuals) do not yet
            have full text equivalents.
          </li>
          <li>
            A small number of older modal dialogs may not trap focus perfectly.
          </li>
          <li>
            Third-party embedded content may not meet our standards; we review
            these as we find them.
          </li>
        </ul>
        <p>
          If you encounter a barrier, tell us — reports from real users are
          how we prioritize fixes.
        </p>
      </section>

      <section>
        <h2>Report An Accessibility Issue</h2>
        <p>
          Email us at{" "}
          <a href="mailto:accessibility@pookie.app">accessibility@pookie.app</a>{" "}
          with:
        </p>
        <ul>
          <li>What you were trying to do.</li>
          <li>What happened instead (what the barrier was).</li>
          <li>
            Your device, browser, and any assistive technology you use.
          </li>
        </ul>
        <p>
          We aim to acknowledge accessibility reports within 2 business days
          and to resolve confirmed barriers promptly.
        </p>
      </section>

      <section>
        <h2>Compatibility</h2>
        <p>
          Pookie is designed to work with current versions of major browsers
          (Chrome, Safari, Firefox, Edge) on desktop and mobile, and with
          commonly used screen readers. Very old browsers may not support all
          features.
        </p>
      </section>
    </PolicyShell>
  );
}
