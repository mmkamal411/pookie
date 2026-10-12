import type { Metadata } from "next";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Gavel 2026-10-12 — /privacy/children.
 * Children's Privacy & Parents' Rights: COPPA notice in plain language —
 * what we collect from under-13s, verifiable parental consent, parent
 * rights, and how to contact us.
 */

export const metadata: Metadata = {
  title: "Children's Privacy & Parents' Rights — Pookie",
  description:
    "How Pookie protects children's privacy, our parental consent process, and parents' rights under COPPA.",
};

export default function ChildrenPrivacyPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Children's Privacy & Parents' Rights"
      updated="October 12, 2026"
    >
      <section>
        <h2>Our Commitment To Children&apos;s Privacy</h2>
        <p>
          Pookie takes children&apos;s privacy seriously. We comply with the
          Children&apos;s Online Privacy Protection Act (COPPA), the federal
          law that protects the personal information of children under 13.
          The short version: <strong>we do not collect personal information
          from children under 13 without a parent&apos;s verifiable
          consent</strong> — and parents stay in control at all times.
        </p>
      </section>

      <section>
        <h2>What We Collect From Children Under 13</h2>
        <p>
          When a parent adds a child under 13 to Pookie, we collect only what
          is needed to provide the Service:
        </p>
        <ul>
          <li>
            <strong>Account basics:</strong> the child&apos;s name, birthdate
            (to verify age tier), and — only with parental consent — a login
            email.
          </li>
          <li>
            <strong>School information:</strong> classes, grades, assignments,
            and attendance pulled from school portals the parent connects.
          </li>
          <li>
            <strong>Activity the parent enables:</strong> check-ins, tasks, or
            health entries the family chooses to track.
          </li>
        </ul>
        <p>
          We do <strong>not</strong> collect precise location from children,
          serve them advertising, or share their information with third parties
          for marketing.
        </p>
      </section>

      <section>
        <h2>Verifiable Parental Consent</h2>
        <p>
          Before a child under 13 receives their own Pookie login, a parent
          must complete our verifiable consent process. This means:
        </p>
        <ul>
          <li>
            The parent signs in to their own verified Pookie account — proving
            they are the account holder.
          </li>
          <li>
            The parent reviews a direct notice (shown in the app, not just a
            link) explaining exactly what data is collected from the child,
            how it is used, and who can see it.
          </li>
          <li>
            The parent chooses a verification method — signed consent form,
            card verification, or a scheduled video call — and explicitly
            confirms.
          </li>
          <li>
            The consent is recorded with a timestamp in an audit log the parent
            can review.
          </li>
        </ul>
        <p>
          Without completed consent, the default is closed: no login is issued
          to the child.
        </p>
      </section>

      <section>
        <h2>Parents&apos; Rights</h2>
        <p>At any time, a parent may:</p>
        <ul>
          <li>
            <strong>Review</strong> the personal information we have collected
            from their child.
          </li>
          <li>
            <strong>Request deletion</strong> of their child&apos;s personal
            information — we will delete it unless we are required to keep it
            by law.
          </li>
          <li>
            <strong>Refuse further collection</strong> by revoking consent,
            which immediately stops new logins and new data collection for the
            child.
          </li>
          <li>
            <strong>Limit sharing</strong> — parents control exactly who sees
            their child&apos;s information through the Sharing screen
            (including mentors such as uncles, aunts, or tutors).
          </li>
        </ul>
        <p>
          To exercise any of these rights, use the Sharing screen in the app
          or contact us at{" "}
          <a href="mailto:privacy@pookie.app">privacy@pookie.app</a>. We will
          respond within a reasonable time and will verify you are the
          child&apos;s parent before acting.
        </p>
      </section>

      <section>
        <h2>Teens 13 And Older</h2>
        <p>
          Teens aged 13–17 manage their accounts with shared oversight: parents
          keep the access they were granted, and teens gain graduated control
          as they get older (see our Privacy Statement for the age-tier
          details). At 18, the account becomes fully the adult&apos;s own.
        </p>
      </section>

      <section>
        <h2>Contact Us About Children&apos;s Privacy</h2>
        <p>
          Questions about how we handle children&apos;s information? Contact
          our privacy team at{" "}
          <a href="mailto:privacy@pookie.app">privacy@pookie.app</a> with the
          subject &ldquo;Children&apos;s Privacy.&rdquo;
        </p>
      </section>
    </PolicyShell>
  );
}
