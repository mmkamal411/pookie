"use client";

import { useState, use } from "react";
import { createClient } from "@/lib/supabase/client";
import { PookieOrb } from "@/components/pookie-orb";

/**
 * Landing + auth. The void of space — boarding the ship.
 * Cosmic black, a field of distant stars, and the Pookie orb as a guiding
 * light on the horizon. Magic-link sign-in (no passwords anywhere). Invite
 * links land here with ?token=… and are consumed after sign-in. ?next=…
 * carries a post-auth return URL (e.g. /verify-invite?token=…) for both flows.
 *
 * Rate-limit UX: Supabase throttles magic-link sends (429 / "rate limit"
 * messages — the founder hit a project-wide throttle on launch night).
 * Those errors get plain-English copy pointing at the Google button
 * instead of raw API text, and the sent state carries a resend path so
 * a missing email is never a dead end.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    error?: string;
    next?: string;
    fresh?: string;
    purgeDate?: string;
  }>;
}) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // searchParams unwrapped with use(): available on server and client, no hydration risk.
  const params = use(searchParams);

  // Surface auth failures redirected back from /auth/callback, with a
  // recovery hint matched to the failure kind.
  const authError = params.error ?? null;
  const authErrorCopy: Record<string, string> = {
    auth: "Boarding didn't complete — try again, astronaut.",
    auth_expired:
      "That boarding pass expired — request a fresh one below.",
    auth_pkce:
      "Your browser blocked part of boarding. Enable cookies and try again — or take the magic-link airlock below.",
  };

  // Fresh start after self-service deletion: confirm what happened.
  const freshStart = params.fresh === "1";
  const purgeDate = params.purgeDate
    ? new Date(params.purgeDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  // Post-auth destination. Legacy ?token=… invites keep their /?invite=
  // handoff; ?next=… is honored only when it is a same-origin path
  // (never protocol-relative), so an attacker can't bounce users
  // off-site through our login.
  function postAuthNext(sp: {
    token?: string;
    next?: string;
  }): string | null {
    if (sp.token) return `/?invite=${sp.token}`;
    if (sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")) {
      return sp.next;
    }
    return null;
  }

  /** True when the Supabase error is a send-rate throttle. */
  function isRateLimitError(err: unknown): boolean {
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) return true;
    const msg = err instanceof Error ? err.message : "";
    return /rate.?limit|too many|request this after/i.test(msg);
  }

  const RATE_LIMIT_COPY =
    "Too many boarding attempts right now — hold position for a minute, or continue with Google above.";

  async function signInWithGoogle() {
    setOauthBusy(true);
    setError(null);
    try {
      const sp = await searchParams;
      const next = postAuthNext(sp);
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback${
            next ? `?next=${encodeURIComponent(next)}` : ""
          }`,
        },
      });
      if (error) throw error;
      // On success the browser leaves for Google's consent screen.
    } catch (err) {
      setError(
        isRateLimitError(err)
          ? RATE_LIMIT_COPY
          : err instanceof Error
            ? err.message
            : "Hold position — request incomplete. Try again in a moment.",
      );
      setOauthBusy(false);
    }
  }

  /** One magic-link send. Throws on failure; the caller maps the error. */
  async function requestLink() {
    const sp = await searchParams;
    const next = postAuthNext(sp);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    if (error) throw error;
  }

  function mapSendError(err: unknown): string {
    if (isRateLimitError(err)) return RATE_LIMIT_COPY;
    return err instanceof Error ? err.message : "Hold position — request incomplete. Try again in a moment.";
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestLink();
      setSent(true);
    } catch (err) {
      setError(mapSendError(err));
    } finally {
      setBusy(false);
    }
  }

  async function resendLink() {
    setBusy(true);
    setError(null);
    setResent(false);
    try {
      await requestLink();
      setResent(true);
    } catch (err) {
      setError(mapSendError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#010104]">
      <Starfield />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-16 lg:grid-cols-2">
        {/* Hero — the promise */}
        <section className="animate-bloom">
          <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
            Pookie · mission control
          </p>
          <h1 className="text-sunlit mt-4 text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Your whole life, flown from one cockpit.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-stardust-300">
            Time, tasks, school, family, health, money — every system on a
            single console, with a warm AI co-pilot who believes in you.
          </p>
          <ul className="mt-8 space-y-3 text-stardust-300">
            {[
              "Today's flight plan, briefed every morning",
              "School, health, and family — all systems monitored",
              "Course corrections, gently suggested",
              "A co-pilot that never stops believing in you",
            ].map((line, i) => (
              <li
                key={line}
                className="animate-rise flex items-center gap-3"
                style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              >
                <NavDot />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Auth card — the airlock */}
        <section className="animate-bloom" style={{ animationDelay: "0.2s" }}>
          <div className="card-living mx-auto w-full max-w-sm rounded-3xl p-8">
            <div className="mx-auto flex w-fit flex-col items-center">
              <PookieOrb size={72} />
              <p className="mt-2 text-[11px] tracking-[0.18em] text-stardust-500 capitalize">
                Your guiding light
              </p>
            </div>
            <h2 className="mt-5 text-center text-xl font-semibold text-star-100">
              Step aboard
            </h2>
            <p className="mt-1 text-center text-sm text-stardust-300">
              Sign in with Google or a magic link — no passwords, ever.
            </p>

            {freshStart && (
              <div className="animate-bloom mt-6 rounded-2xl border border-nova-400/25 bg-nova-500/10 p-4 text-center">
                <p className="text-sm font-medium text-star-100">
                  Done. Your old ship will be decommissioned
                  {purgeDate ? (
                    <>
                      {" "}on <strong>{purgeDate}</strong>
                    </>
                  ) : (
                    ""
                  )}
                  .
                </p>
                <p className="mt-1 text-sm text-stardust-300">
                  Sign in below anytime before then to cancel and restore
                  everything — or launch fresh right now.
                </p>
              </div>
            )}

            {sent ? (
              <div className="animate-bloom mt-6 space-y-4 rounded-2xl border border-nova-400/25 bg-nova-500/10 p-4 text-center">
                <p className="text-sm text-stardust-200">
                  Your boarding pass is on its way — check your inbox (and
                  the spam folder, just in case).
                </p>
                {resent && (
                  <p className="text-xs text-nova-300">
                    Sent again — give it a minute to arrive.
                  </p>
                )}
                {error && <p className="text-sm text-red-400">{error}</p>}
                <button
                  type="button"
                  onClick={resendLink}
                  disabled={busy}
                  className="text-sm font-medium text-nova-300 underline-offset-4 transition hover:text-nova-200 hover:underline disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Didn't get it? Resend the link"}
                </button>
                <p className="text-xs text-stardust-400">
                  Or{" "}
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={oauthBusy}
                    className="font-medium text-nova-300 underline-offset-4 hover:underline disabled:opacity-50"
                  >
                    {oauthBusy ? "Connecting…" : "continue with Google"}
                  </button>{" "}
                  instead.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {authError && authErrorCopy[authError] && (
                  <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-3 text-center">
                    <p className="text-sm text-red-300">
                      {authErrorCopy[authError]}
                    </p>
                    <p className="mt-1 text-xs text-stardust-400">
                      Boarding passes expire after a while — and private-mode
                      tabs sometimes drop the handoff. A fresh link usually
                      fixes it.
                    </p>
                  </div>
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

/** Nav beacon — the ship's position light, replacing the garden leaf dot. */
function NavDot() {
  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-nova-500/15 shadow-glow-sm">
      <span className="h-2 w-2 rounded-full bg-nova-400" />
    </span>
  );
}

/**
 * Starfield — the void. Tiny distant stars with a slow twinkle, a few soft
 * drifting motes, and a whisper of nebula color far below so the black
 * stays cosmic, not flat.
 */
function Starfield() {
  const stars = [
    { left: "6%", top: "14%", size: 2, delay: "0s", dur: "3.2s" },
    { left: "12%", top: "68%", size: 3, delay: "1.1s", dur: "4s" },
    { left: "19%", top: "32%", size: 2, delay: "2.2s", dur: "3.6s" },
    { left: "27%", top: "82%", size: 3, delay: "0.6s", dur: "4.4s" },
    { left: "35%", top: "8%", size: 2, delay: "1.8s", dur: "3s" },
    { left: "44%", top: "48%", size: 2, delay: "0.3s", dur: "3.8s" },
    { left: "52%", top: "22%", size: 3, delay: "2.6s", dur: "4.2s" },
    { left: "61%", top: "74%", size: 2, delay: "1.4s", dur: "3.4s" },
    { left: "68%", top: "12%", size: 3, delay: "0.9s", dur: "4.6s" },
    { left: "74%", top: "58%", size: 2, delay: "2s", dur: "3.1s" },
    { left: "81%", top: "30%", size: 3, delay: "1.6s", dur: "3.9s" },
    { left: "88%", top: "80%", size: 2, delay: "0.2s", dur: "4.1s" },
    { left: "94%", top: "44%", size: 2, delay: "2.9s", dur: "3.5s" },
    { left: "23%", top: "55%", size: 2, delay: "1.2s", dur: "3.7s" },
    { left: "57%", top: "90%", size: 2, delay: "2.4s", dur: "4.3s" },
    { left: "47%", top: "66%", size: 3, delay: "0.7s", dur: "3.3s" },
  ];
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            opacity: 0.55,
            animation: `twinkle ${s.dur} ease-in-out ${s.delay} infinite`,
            boxShadow: "0 0 6px rgb(255 255 255 / 0.5)",
          }}
        />
      ))}
      {/* whisper of nebula far below — depth without light pollution */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 50% 115%, rgb(76 29 149 / 0.14), transparent 65%), radial-gradient(ellipse 50% 35% at 85% -5%, rgb(244 114 182 / 0.05), transparent 60%)",
        }}
      />
    </div>
  );
}
