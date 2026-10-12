import type { Metadata } from "next";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Cookie 2026-10-12 — /privacy.
 * Plain-language privacy statement: what Pookie collects, why, sharing,
 * retention, rights, and children's privacy (under-13 parental consent).
 */

export const metadata: Metadata = {
  title: "Privacy Statement — Pookie",
  description: "How Pookie collects, uses, shares, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Privacy Statement"
      updated="October 12, 2026"
    >
      <section>
        <h2>Our Promise In Plain Language</h2>
        <p>
          Pookie is your personal assistant for running your life — school, family,
          health, money, and home. That means we handle information that matters to
          you. We collect only what the app needs to work, we never sell your
          personal information, and you stay in control: you can see, correct,
          export, or delete your data at any time.
        </p>
      </section>

      <section>
        <h2>What We Collect</h2>
        <ul>
          <li>
            <strong>Account information</strong> — your name, email address, and
            sign-in credentials, so we know who you are and can keep your account
            secure.
          </li>
          <li>
            <strong>Family profiles you create</strong> — names, birthdates, and
            relationships for children or family members you add, so Pookie can
            personalize school tracking, health, and household features.
          </li>
          <li>
            <strong>School information</strong> — classes, grades, assignments, and
            attendance pulled from school portals you connect, plus anything you or
            your child enter by hand.
          </li>
          <li>
            <strong>Health and wellbeing entries</strong> — only what you choose to
            log, such as workouts, meals, or check-ins. We never infer diagnoses.
          </li>
          <li>
            <strong>Household and financial details</strong> — bills, shopping lists,
            and documents you add so Pookie can remind and organize.
          </li>
          <li>
            <strong>Messages with Pookie AI</strong> — your conversations with the
            assistant, used to answer you and improve responses.
          </li>
          <li>
            <strong>Device and usage information</strong> — covered by our{" "}
            <a href="/cookies-policy">Cookies Policy</a>: page views and feature
            usage in aggregate, only with your consent.
          </li>
        </ul>
      </section>

      <section>
        <h2>Why We Use It</h2>
        <p>We use your information to:</p>
        <ul>
          <li>Run the app — sign you in, show your dashboard, sync your data.</li>
          <li>Provide the features you ask for — grade tracking, reminders, lists, insights.</li>
          <li>Keep the app safe — detect abuse, prevent unauthorized access.</li>
          <li>Improve Pookie — understand which features help, in aggregate.</li>
          <li>Communicate with you — sign-in codes, important account notices.</li>
        </ul>
        <p>
          We do <strong>not</strong> use your data to train shared AI models, and we
          do <strong>not</strong> sell your personal information to anyone.
        </p>
      </section>

      <section>
        <h2>Who We Share With</h2>
        <ul>
          <li>
            <strong>Service providers</strong> — companies that help us run Pookie
            (hosting, authentication, analytics), bound by contract to use your data
            only for our service.
          </li>
          <li>
            <strong>School portals you connect</strong> — we exchange data with
            portals like StudentVUE or ParentVUE only when you provide credentials
            and ask us to sync.
          </li>
          <li>
            <strong>People you invite</strong> — family members, mentors, or
            co-parents see only what you explicitly grant them, under the sharing
            rules you control.
          </li>
          <li>
            <strong>Legal requirements</strong> — if the law requires disclosure, we
            will narrow it as much as possible and tell you unless forbidden.
          </li>
        </ul>
      </section>

      <section>
        <h2>Children&rsquo;s Privacy</h2>
        <p>
          Pookie is designed for families, so we take children&rsquo;s privacy
          seriously:
        </p>
        <ul>
          <li>
            <strong>Under 13:</strong> a child account requires verified parental
            consent before it can be used. Parents manage these accounts and can
            review or delete the child&rsquo;s information at any time.
          </li>
          <li>
            <strong>Ages 13–15:</strong> shared oversight — teens participate in
            their own privacy choices, with safeguards such as cooling-off periods
            on access changes.
          </li>
          <li>
            <strong>Ages 16–17:</strong> teens control their own sharing and can
            change it instantly.
          </li>
        </ul>
        <p>
          We never knowingly collect a child&rsquo;s information without the
          required parental consent. If you believe we have, contact us and we will
          delete it promptly.
        </p>
      </section>

      <section>
        <h2>How Long We Keep Data</h2>
        <p>
          We keep your information only as long as your account is active or as
          needed to provide the service. When you delete something — a list, a
          message, a child profile — it is removed from active systems. Backups may
          retain copies for a limited time before they age out. If you delete your
          account, we purge your personal data within a reasonable period, except
          where the law requires us to keep records.
        </p>
      </section>

      <section>
        <h2>Your Rights</h2>
        <p>Wherever you live, you can:</p>
        <ul>
          <li>
            <strong>See</strong> what personal information we hold about you.
          </li>
          <li>
            <strong>Correct</strong> anything inaccurate.
          </li>
          <li>
            <strong>Delete</strong> your data or your account.
          </li>
          <li>
            <strong>Export</strong> your data in a portable format.
          </li>
          <li>
            <strong>Withdraw consent</strong> for optional processing such as
            analytics cookies — via the Cookie Settings footer link.
          </li>
          <li>
            <strong>Object or restrict</strong> certain uses of your data.
          </li>
        </ul>
        <p>
          Email <a href="mailto:privacy@pookie.app">privacy@pookie.app</a> to exercise
          any of these rights. We respond within a reasonable time and never
          penalize you for asking.
        </p>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          We protect your data with encryption in transit and at rest, strict access
          controls (support staff see only what their role requires, and every
          access is logged), and regular security reviews. No system is perfect —
          if we ever discover a breach affecting you, we will tell you promptly.
        </p>
      </section>

      <section>
        <h2>Changes To This Statement</h2>
        <p>
          If we make material changes, we will notify you in the app and update the
          date above. Continuing to use Pookie after changes take effect means you
          accept the updated statement.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          Pookie is the data controller for your information. Questions, requests,
          or complaints: <a href="mailto:privacy@pookie.app">privacy@pookie.app</a>.
          You also have the right to contact your local data protection authority.
        </p>
      </section>
    </PolicyShell>
  );
}
