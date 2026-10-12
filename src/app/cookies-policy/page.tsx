import type { Metadata } from "next";
import { PolicyShell } from "@/components/cookies/policy-shell";

/**
 * Squad Cookie 2026-10-12 — /cookies-policy.
 * Plain-language cookies policy: what cookies are, the four categories,
 * what Pookie stores in each, lifetimes, and how to manage or delete them.
 */

export const metadata: Metadata = {
  title: "Cookies Policy — Pookie",
  description: "How Pookie uses cookies, what each category does, and how to manage your choices.",
};

export default function CookiesPolicyPage() {
  return (
    <PolicyShell
      eyebrow="Legal"
      title="Cookies Policy"
      updated="October 12, 2026"
    >
      <section>
        <h2>What Are Cookies?</h2>
        <p>
          Cookies are small text files stored on your device when you visit a website.
          They let the site remember things about you — like keeping you signed in or
          remembering a setting you chose. Pookie also uses similar technologies such
          as <strong>local storage</strong> (data saved in your browser) for the same
          purposes. When this policy says &ldquo;cookies,&rdquo; it covers both.
        </p>
      </section>

      <section>
        <h2>Who Controls The Cookies?</h2>
        <p>
          The data controller for information processed through Pookie&rsquo;s cookies
          is <strong>Pookie</strong>. Some cookies are set by third parties we rely on —
          such as analytics and authentication providers — to give us web analytics and
          keep sign-in working. Those providers only receive what they need to perform
          their service.
        </p>
      </section>

      <section>
        <h2>The Four Cookie Categories</h2>
        <p>We group every cookie Pookie uses into four categories:</p>
        <ul>
          <li>
            <strong>Strictly Necessary Cookies — Always Active.</strong> Required for
            Pookie to function. They keep you signed in, protect forms against
            forgery, remember your cookie consent choice, and load your data. These
            cannot be switched off; without them the app does not work.
          </li>
          <li>
            <strong>Analytics Cookies — Your Choice.</strong> Help us understand, in
            aggregate, how Pookie is used — which features are popular, where errors
            happen — so we can improve the app. Never tied to your name.
          </li>
          <li>
            <strong>Performance and Functional Cookies — Your Choice.</strong> Remember
            your preferences (theme, collapsed sections) and cache parts of pages so
            they load faster on repeat visits.
          </li>
          <li>
            <strong>Advertising and Social Media Cookies — Your Choice.</strong>
            Reserved for any future advertising or social sharing features. Pookie
            currently runs no advertising, so this category sets nothing today.
          </li>
        </ul>
      </section>

      <section>
        <h2>Examples Of What Pookie Stores</h2>
        <ul>
          <li>
            <strong>Session and authentication tokens</strong> (Strictly Necessary) —
            prove you are signed in as you move between pages. Cleared when you sign
            out; session cookies expire when the browser closes.
          </li>
          <li>
            <strong>Your cookie consent choice</strong> (Strictly Necessary) — stored
            in your browser&rsquo;s local storage so we do not ask you again on every
            visit. Kept until you clear it or change your settings.
          </li>
          <li>
            <strong>Theme and display preferences</strong> (Functional) — for example,
            whether you chose the light theme. Kept until you change or clear them.
          </li>
          <li>
            <strong>Aggregated page-view counts</strong> (Analytics) — how many times
            a page was visited, with no name attached. Aggregated and retained in
            summary form.
          </li>
        </ul>
      </section>

      <section>
        <h2>How Long Do Cookies Last?</h2>
        <p>
          <strong>Session cookies</strong> disappear when you close your browser.
          <strong>Persistent cookies</strong> stay until they expire or you delete
          them — most of Pookie&rsquo;s persistent cookies last between a single visit
          and twelve months, and preference cookies last until you change them. We keep
          lifetimes as short as the feature allows.
        </p>
      </section>

      <section>
        <h2>Managing Your Choices</h2>
        <p>
          You can change your mind at any time. Reopen the{" "}
          <strong>Privacy Preference Center</strong> from the{" "}
          <strong>Cookie Settings</strong> link in the footer of every page, flip any
          toggle, and choose <strong>Save My Cookie Settings</strong>. Withdrawing
          consent stops future collection; it does not delete data already collected,
          but you can ask us to delete it (see below).
        </p>
        <p>
          You can also block or delete cookies in your browser settings — look under
          Privacy or History in your browser&rsquo;s preferences. Blocking Strictly
          Necessary cookies will prevent Pookie from signing you in.
        </p>
      </section>

      <section>
        <h2>Do Not Track</h2>
        <p>
          Pookie honors your cookie choices above any browser signal. If your browser
          sends a Do Not Track signal, we treat Analytics, Functional, and Advertising
          cookies as declined unless you have explicitly opted in.
        </p>
      </section>

      <section>
        <h2>Contact Us</h2>
        <p>
          Questions about this Cookies Policy? Reach us at{" "}
          <a href="mailto:privacy@pookie.app">privacy@pookie.app</a>. We will respond
          to cookie and privacy questions within a reasonable time.
        </p>
      </section>
    </PolicyShell>
  );
}
