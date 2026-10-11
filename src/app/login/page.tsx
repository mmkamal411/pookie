"use client";

import { useState } from "react";
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
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const params = await searchParams;
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback${
            params.token ? `?next=/?invite=${params.token}` : ""
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
    <main className="relative flex min-h-screen overflow-hidden bg-canopy-950">
      <Fireflies />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
        {/* Hero — the promise */}
        <section className="animate-bloom">
          <p className="text-sm font-medium tracking-[0.2em] text-leaf-400 uppercase">
            Pookie
          </p>
          <h1 className="text-sunlit mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Everything a mother would be worried about — gently watched over.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-bark-300">
            Grades, health, safety, and dreams — growing together like a
            garden, tended with care, guided by intelligence that feels like
            love.
          </p>
          <ul className="mt-8 space-y-3 text-bark-300">
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
            <h2 className="mt-5 text-center text-xl font-semibold text-dew-100">
              Come on in
            </h2>
            <p className="mt-1 text-center text-sm text-bark-300">
              Sign in with your email — we&apos;ll send a magic link. No
              passwords, ever.
            </p>

            {sent ? (
              <p className="animate-bloom mt-6 rounded-2xl border border-leaf-400/25 bg-leaf-500/10 p-4 text-center text-sm text-moss-200">
                Your link is fluttering toward your inbox — check your email.
              </p>
            ) : (
              <form onSubmit={sendLink} className="mt-6 space-y-4">
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
                  className="btn-dapple w-full rounded-2xl py-3 text-sm font-semibold text-canopy-950 disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Send magic link"}
                </button>
              </form>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function LeafDot() {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-leaf-500/15 shadow-glow-sm">
      <span className="h-2 w-2 rounded-full bg-leaf-400" />
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
            "radial-gradient(ellipse 90% 55% at 50% -10%, rgb(254 243 199 / 0.1), transparent 60%), radial-gradient(ellipse 80% 60% at 70% 20%, rgb(74 222 128 / 0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 20% 80%, rgb(251 191 36 / 0.05), transparent 60%)",
        }}
      />
    </div>
  );
}
