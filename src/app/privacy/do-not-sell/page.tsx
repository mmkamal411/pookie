import type { Metadata } from "next";
import { DoNotSellForm } from "@/components/legal/do-not-sell-form";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Gavel 2026-10-12 — /privacy/do-not-sell.
 * "Do Not Sell or Share My Personal Information" request page.
 * Form logs the request server-side; GPC signals are honored.
 */

export const metadata: Metadata = {
  title: "Do Not Sell or Share My Personal Information — Pookie",
  description:
    "Request that Pookie not sell or share your personal information.",
};

export default function DoNotSellPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Do Not Sell or Share My Personal Information"
      updated="October 12, 2026"
    >
      <section>
        <h2>Your Right To Opt Out</h2>
        <p>
          Under laws like the California Consumer Privacy Act (CCPA), you have
          the right to tell us not to sell or share your personal information.
          Pookie does not sell personal information today — but we honor this
          right regardless. Submit the form below and we will record your
          preference and apply it going forward.
        </p>
        <p>
          If your browser sends a <strong>Global Privacy Control (GPC)</strong>{" "}
          signal, we detect it automatically and treat it as a do-not-sell
          request — no form needed.
        </p>
      </section>
      <DoNotSellForm />
    </PolicyShell>
  );
}
