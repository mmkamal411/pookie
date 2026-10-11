"use client";

import { useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { PookieOrb } from "@/components/pookie-orb";

/**
 * Landing + auth. First thing a family sees: warmth, not a form.
 * Magic-link sign-in (no passwords anywhere). Invite links land here
 * with ?token=… and are consumed after sign-in.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; demo?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Demo entry — deploy-gated via public env var, link-gated via ?demo=1.
  // searchParams unwrapped with use(): available on server and client, no hydration risk.
  const params = use(searchParams);
  const demoAvail =
    process.env.NEXT_PUBLIC_DEMO_MODE === "1" && params.demo === "1";

  // Surface auth failures redirected back from /auth/callback.
  const authError = params.error === "auth";

  async function signInWithGoogle() {
    setOauthBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      // On success the browser leaves for Google's consent screen.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setOauthBusy(false);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sp = await searchParams;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            sp.token ? `?next=/?invite=${sp.token}` : ""
          }`,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-nebula-950">
      <Fireflies />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
        {/* Hero — the promise */}
        <section className="animate-bloom">
          <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
            Pookie
          </p>
          <h1 className="text-sunlit mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Everything a mother would be worried about — gently watched over.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stardust-300">
            Grades, health, safety, and dreams — growing together like a
            garden, tended with care, guided by intelligence that feels like
            love.
          </p>
          <ul className="mt-8 space-y-3 text-stardust-300">
            {[
              "School, watched over daily",
              "Health, held with care",
              "Safety, wrapped in warmth",
              "Futures, nurtured patiently",
            ].map((line, i) => (
              <li
                key={line}
                className="animate-rise flex items-center gap-3"
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                <LeafDot />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Auth card — the doorway */}
        <section className="animate-bloom" style={{ animationDelay: "0.2s" }}>
          <div className="card-living mx-auto w-full max-w-sm rounded-3xl p-8">
            <div className="mx-auto flex w-fit">
              <PookieOrb size={72} />
            </div>
            <h2 className="mt-5 text-center text-xl font-semibold text-star-100">
              Come on in
            </h2>
            <p className="mt-1 text-center text-sm text-stardust-300">
              Sign in with Google or your email — we&apos;ll send a magic
              link. No passwords, ever.
            </p>

            {sent ? (
              <p className="animate-bloom mt-6 rounded-2xl border border-nova-400/25 bg-nova-500/10 p-4 text-center text-sm text-stardust-200">
                Your link is fluttering toward your inbox — check your email.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {authError && (
                  <p className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-center text-sm text-red-300">
                    Sign-in didn&apos;t finish — please try again.
                  </p>
                )}
                <button
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={oauthBusy}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white py-3 text-sm font-semibold text-nebula-950 shadow-glow-sm transition hover:bg-stardust-200 disabled:opacity-50"
                >
                  <GoogleGlyph />
                  {oauthBusy ? "Connecting…" : "Continue with Google"}
                </button>
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-star-100/15" />
                  <span className="text-xs text-stardust-400">or</span>
                  <span className="h-px flex-1 bg-star-100/15" />
                </div>
                <form onSubmit={sendLink} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input-rooted w-full rounded-2xl px-4 py-3 text-sm"
                  />
                  {error && <p className="text-sm text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={busy}
                    className="btn-dapple w-full rounded-2xl py-3 text-sm font-semibold text-nebula-950 disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send magic link"}
                  </button>
                </form>
              </div>
            )}
            {demoAvail && (
              <a
                href="/demo"
                className="animate-bloom mt-4 block rounded-2xl border border-aurum-400/30 bg-aurum-400/10 py-3 text-center text-sm font-semibold text-aurum-200 shadow-sun-warm transition hover:bg-aurum-400/20"
              >
                ✨ View demo — no login needed
              </a>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function LeafDot() {  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nova-500/15 shadow-glow-sm">
      <span className="h-2 w-2 rounded-full bg-nova-400" />
    </span>
  );
}

function Fireflies() {
  const dots = [
    { left: "8%", top: "20%", size: 10, delay: "0s" },
    { left: "18%", top: "70%", size: 7, delay: "1.2s" },
    { left: "42%", top: "12%", size: 12, delay: "0.6s" },
    { left: "65%", top: "82%", size: 8, delay: "2s" },
    { left: "78%", top: "28%", size: 11, delay: "1.6s" },
    { left: "90%", top: "62%", size: 6, delay: "0.3s" },
    { left: "30%", top: "45%", size: 5, delay: "2.4s" },
    { left: "55%", top: "55%", size: 9, delay: "1s" },
  ];
  const ascenders = [
    { left: "12%", top: "60%", size: 6, delay: "0s" },
    { left: "35%", top: "75%", size: 8, delay: "2.5s" },
    { left: "58%", top: "65%", size: 5, delay: "1.2s" },
    { left: "72%", top: "70%", size: 7, delay: "4s" },
    { left: "88%", top: "55%", size: 6, delay: "3s" },
  ];
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {dots.map((d, i) => (
        <span
          key={`f-${i}`}
          className="firefly"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
          }}
        />
      ))}
      {ascenders.map((d, i) => (
        <span
          key={`a-${i}`}
          className="ascend-particle"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            animationDelay: d.delay,
          }}
        />
      ))}
      {/* divine light wash — dappled sunlight + heavenly radiance from above */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgb(254 243 199 / 0.1), transparent 60%), radial-gradient(ellipse 80% 60% at 70% 20%, rgb(244 114 182 / 0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgb(251 191 36 / 0.05), transparent 60%)",
        }}
      />
    </div>
  );
}
