import type { Metadata } from "next";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Gavel 2026-10-12 — /terms.
 * Terms of Service: acceptance, eligibility, license, acceptable use, IP,
 * disclaimers, liability, indemnification, termination, arbitration,
 * governing law, amendments, parental consent, health + AI disclaimers,
 * school-credentials authorization.
 */

export const metadata: Metadata = {
  title: "Terms of Service — Pookie",
  description: "The terms that govern your use of Pookie.",
};

export default function TermsPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Terms of Service"
      updated="October 12, 2026"
    >
      <section>
        <h2>1. Acceptance Of These Terms</h2>
        <p>
          By creating an account, signing in, or using Pookie (the
          &ldquo;Service&rdquo;), you agree to these Terms of Service
          (&ldquo;Terms&rdquo;) and our Privacy Statement. If you do not agree,
          do not use the Service. We may ask you to click to accept these Terms
          during sign-up or when they change — that click is your agreement.
        </p>
      </section>

      <section>
        <h2>2. Who Can Use Pookie</h2>
        <p>
          You must be at least 13 years old to create your own account. Children
          under 13 may use Pookie only through a parent-managed account and only
          after the parent completes our verifiable parental consent process
          (see <a href="/privacy/children">Children&apos;s Privacy</a>). By
          using the Service, you represent that you meet these eligibility
          requirements and that the information you provide is accurate.
        </p>
      </section>

      <section>
        <h2>3. Your License To Use Pookie</h2>
        <p>
          We grant you a limited, non-exclusive, non-transferable, revocable
          license to use the Service for personal, non-commercial family use.
          You may not copy, modify, resell, or reverse-engineer the Service, or
          use it to build a competing product.
        </p>
      </section>

      <section>
        <h2>4. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Break any law or violate anyone&apos;s rights through the Service.</li>
          <li>Upload harmful, abusive, or unlawful content.</li>
          <li>Attempt to access other users&apos; accounts or data.</li>
          <li>Interfere with the Service&apos;s operation or security.</li>
          <li>Use automated tools to scrape or overload the Service.</li>
          <li>Misrepresent your identity or your relationship to a child.</li>
        </ul>
        <p>
          We may suspend or terminate accounts that violate these rules.
        </p>
      </section>

      <section>
        <h2>5. Your Content And Intellectual Property</h2>
        <p>
          You keep ownership of the content you add to Pookie (notes, uploads,
          messages). By adding it, you give us permission to store and display
          it to you and the people you choose to share it with — nothing more.
          Pookie&apos;s name, logo, design, and software remain our property
          and are protected by intellectual property laws.
        </p>
      </section>

      <section>
        <h2>6. School Credentials Authorization</h2>
        <p>
          When you provide school portal credentials (such as StudentVUE,
          ParentVUE, or CTLS logins), you authorize Pookie — and the sync
          workers you designate — to use those credentials solely to retrieve
          your family&apos;s school data (grades, assignments, attendance,
          messages) on your behalf. You represent that you are authorized to
          share these credentials (for example, as the student or as a parent
          or guardian). We store credentials securely and never display them
          back to you or anyone else. You may remove them at any time, which
          stops future syncs.
        </p>
      </section>

      <section>
        <h2>7. Health Information Disclaimer</h2>
        <p>
          Pookie&apos;s health and wellbeing features are organizational tools,
          not medical advice. Nothing in the Service — including reminders,
          summaries, or AI responses — is a diagnosis, treatment recommendation,
          or substitute for professional medical advice. Always consult a
          qualified health professional about medical questions.
        </p>
      </section>

      <section>
        <h2>8. AI Output Disclaimer</h2>
        <p>
          Pookie and Muse are AI assistants. Their responses are generated
          automatically and may be inaccurate, incomplete, or out of date.
          Do not rely on AI output for legal, medical, financial, or safety
          decisions without independent verification. AI responses do not
          create an attorney-client, doctor-patient, or other professional
          relationship.
        </p>
      </section>

      <section>
        <h2>9. Warranty Disclaimer</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as
          available.&rdquo; To the fullest extent permitted by law, we disclaim
          all warranties, express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not
          guarantee the Service will be uninterrupted, error-free, or that
          school data syncs will always succeed.
        </p>
      </section>

      <section>
        <h2>10. Limitation Of Liability</h2>
        <p>
          To the fullest extent permitted by law, Pookie and its operators will
          not be liable for any indirect, incidental, special, consequential,
          or punitive damages arising from your use of the Service. Our total
          liability for any claim will not exceed the amounts you paid us (if
          any) in the twelve months before the claim — or $50 if you paid
          nothing.
        </p>
      </section>

      <section>
        <h2>11. Indemnification</h2>
        <p>
          You agree to indemnify and hold harmless Pookie and its operators
          from claims, damages, and expenses (including reasonable attorney
          fees) arising from your misuse of the Service, your violation of
          these Terms, or your violation of anyone&apos;s rights.
        </p>
      </section>

      <section>
        <h2>12. Termination</h2>
        <p>
          <strong>You</strong> may delete your account at any time from account
          settings. After deletion, you have a 30-day window to request an
          export of your data by contacting{" "}
          <a href="mailto:privacy@pookie.app">privacy@pookie.app</a>; after that
          window, your data is permanently deleted. <strong>We</strong> may
          suspend or terminate your account for violations of these Terms, with
          notice where practical. Sections 9 through 14 survive termination.
        </p>
      </section>

      <section>
        <h2>13. Disputes: Arbitration And Class Waiver</h2>
        <p>
          Any dispute arising from these Terms or the Service will be resolved
          by binding individual arbitration — not in court, and not as part of
          a class action. You waive any right to participate in a class,
          collective, or representative action. You may opt out of arbitration
          within 30 days of first accepting these Terms by emailing{" "}
          <a href="mailto:legal@pookie.app">legal@pookie.app</a> with the
          subject &ldquo;Arbitration Opt-Out.&rdquo;
        </p>
      </section>

      <section>
        <h2>14. Governing Law</h2>
        <p>
          These Terms are governed by the laws of the State of Georgia, USA,
          without regard to conflict-of-law principles.
        </p>
      </section>

      <section>
        <h2>15. Changes To These Terms</h2>
        <p>
          We may update these Terms from time to time. When we make material
          changes, we will notify you in the app and, where appropriate, ask
          you to accept the new Terms before continuing to use the Service.
          Continued use after the changes take effect constitutes acceptance.
        </p>
      </section>

      <section>
        <h2>16. Severability And Entire Agreement</h2>
        <p>
          If any part of these Terms is found unenforceable, the rest remains
          in effect. These Terms, together with our Privacy Statement and
          Cookies Policy, are the entire agreement between you and Pookie
          regarding the Service.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these Terms? Contact us at{" "}
          <a href="mailto:legal@pookie.app">legal@pookie.app</a>.
        </p>
      </section>
    </PolicyShell>
  );
}
