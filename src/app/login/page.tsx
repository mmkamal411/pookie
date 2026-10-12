"use client";

import { useState, use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PookieOrb, type OrbMood } from "@/components/pookie-orb";
import { SoulOrb } from "@/components/soul-orb";
import { nextGreeting, greetingContext, type GreetContext } from "@/components/login-greetings";

/**
 * Landing + auth. Squad Orb (2026-10-12) — Mehedi's directive: the login
 * page is EXTREMELY simple. Just the divine orb, floating in the living
 * cosmos, greeting the traveler: "Good morning/afternoon/evening, Captain."
 * Nothing else. Tapping the orb magically materializes the sign-in options
 * like holographic controls. All auth logic (Supabase magic link + Google
 * OAuth) is unchanged — only the presentation is new.
 *
 * Flow: greeting → (tap orb, burst of light) → clearance (choose Google or
 * email boarding pass) → email entry → transmitted. Sci-fi lingo throughout.
 * ?token=… invites and ?next=… return URLs are honored by both flows.
 */
type Phase = "greeting" | "clearance" | "email" | "transmitted";

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
  const [phase, setPhase] = useState<Phase>("greeting");
  const [bursting, setBursting] = useState(false);
  const [orbMood, setOrbMood] = useState<OrbMood>("idle");
  const [email, setEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = use(searchParams);
  const router = useRouter();

  // Seamless login: if a session already exists (or silently refreshes via
  // the stored refresh token), sail straight past — the orb greeting is
  // for logged-OUT travelers only.
  const [checkingSession, setCheckingSession] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          const next = postAuthNext(params);
          router.replace(next ?? "/");
          return;
        }
      } catch {
        // Fall through to the greeting — a failed check must never
        // strand anyone on a blank page.
      }
      if (!cancelled) setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rotating greetings — a delightful surprise, never the same twice.
  // Rotates every 9s while idle on the greeting phase.
  const greetState = useRef<{ last: string | null; seenRare: Set<string> }>({
    last: null,
    seenRare: new Set(),
  });
  // Contextual awareness — the orb knows if this is a first meeting or a
  // quick return, and greets accordingly.
  const greetCtx = useRef<GreetContext | null>(null);
  if (greetCtx.current === null && typeof window !== "undefined") {
    greetCtx.current = greetingContext();
  }
  const [greeting, setGreeting] = useState(() => {
    const g = nextGreeting(greetState.current, greetCtx.current ?? undefined);
    greetState.current = g.state;
    return g.text;
  });
  const [greetKey, setGreetKey] = useState(0);
  useEffect(() => {
    if (phase !== "greeting") return;
    const t = window.setInterval(() => {
      const g = nextGreeting(greetState.current);
      greetState.current = g.state;
      setGreeting(g.text);
      setGreetKey((k) => k + 1);
    }, 9000);
    return () => window.clearInterval(t);
  }, [phase]);

  const authError = params.error ?? null;
  const authErrorCopy: Record<string, string> = {
    auth: "Boarding didn't complete — try again, Captain.",
    auth_expired: "That boarding pass expired — request a fresh one.",
    auth_pkce:
      "Your browser blocked part of boarding. Enable cookies and try again — or take the email airlock.",
  };

  const freshStart = params.fresh === "1";
  const purgeDate = params.purgeDate
    ? new Date(params.purgeDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  function postAuthNext(sp: { token?: string; next?: string }): string | null {
    if (sp.token) return `/?invite=${sp.token}`;
    if (sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")) {
      return sp.next;
    }
    return null;
  }

  function isRateLimitError(err: unknown): boolean {
    const status = (err as { status?: number } | null)?.status;
    if (status === 429) return true;
    const msg = err instanceof Error ? err.message : "";
    return /rate.?limit|too many|request this after/i.test(msg);
  }

  const RATE_LIMIT_COPY =
    "Too many boarding attempts right now — hold position for a minute, or continue with Google.";

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
    return err instanceof Error
      ? err.message
      : "Hold position — request incomplete. Try again in a moment.";
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestLink();
      setPhase("transmitted");
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

  /** The magical tap — the orb understands, flares with revelation,
      then reveals the clearance options. */
  function tapOrb() {
    if (phase !== "greeting" || bursting) return;
    setBursting(true);
    setOrbMood("revelation");
    window.setTimeout(() => {
      setPhase("clearance");
      setBursting(false);
      setOrbMood("excited");
    }, 680);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      {/* The living cosmos is mounted globally in the root layout — the orb
          floats directly in it. No local starfield, no clutter. */}
      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        {checkingSession ? (
          <>
            <PookieOrb size={96} mood="thinking" interactive={false} />
            <p className="animate-bloom mt-8 text-sm tracking-[0.22em] text-stardust-400 uppercase">
              Establishing uplink…
            </p>
          </>
        ) : (
          <>
        {/* The orb — the entire login page. A soul, not a logo:
            unpredictable entrances, organic drift, alive. */}
        <div className="relative inline-block">
          {phase === "greeting" && !bursting && (
            <span aria-hidden="true" className="tap-hint absolute inset-0 rounded-full" />
          )}
          <SoulOrb size={132} mood={orbMood} bursting={bursting} onTap={tapOrb} />
        </div>

        {phase === "greeting" && (
          <div className="animate-bloom mt-8">
            <h1
              key={greetKey}
              className="greeting-glow greeting-transmission text-3xl font-semibold tracking-tight text-star-100 sm:text-4xl"
            >
              {greeting}
            </h1>
            <p className="mt-3 text-sm tracking-[0.22em] text-stardust-400 uppercase">
              Touch the light to request boarding clearance
            </p>
          </div>
        )}

        {phase === "clearance" && (
          <div className="mt-8 w-full">
            <h1 className="animate-bloom text-2xl font-semibold tracking-tight text-star-100">
              Verify your identity, Captain
            </h1>
            <p className="animate-bloom mt-2 text-sm text-stardust-400" style={{ animationDelay: "0.1s" }}>
              Choose your boarding method
            </p>

            {freshStart && (
              <div className="animate-bloom mt-5 rounded-2xl border border-nova-400/25 bg-nova-500/10 p-4">
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

            {authError && authErrorCopy[authError] && (
              <div className="animate-bloom mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-3">
                <p className="text-sm text-red-300">{authErrorCopy[authError]}</p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={oauthBusy}
                className="holo-panel login-materialize flex w-full items-center justify-center gap-3 px-6 py-4 text-[15px] font-semibold text-star-100 transition hover:brightness-125 disabled:opacity-50"
                style={{ animationDelay: "0.15s" }}
              >
                <GoogleGlyph />
                {oauthBusy ? "Establishing secure uplink…" : "Continue with Google"}
              </button>
              <button
                type="button"
                onClick={() => setPhase("email")}
                className="holo-panel login-materialize flex w-full items-center justify-center gap-3 px-6 py-4 text-[15px] font-semibold text-star-100 transition hover:brightness-125"
                style={{ animationDelay: "0.28s" }}
              >
                <TicketGlyph />
                Email boarding pass
              </button>
            </div>
            {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
          </div>
        )}

        {phase === "email" && (
          <div className="animate-bloom mt-8 w-full">
            <h1 className="text-2xl font-semibold tracking-tight text-star-100">
              Where shall we transmit your boarding pass?
            </h1>
            <form onSubmit={sendLink} className="mt-6 space-y-3">
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="holo-panel input-rooted w-full px-5 py-4 text-center text-[15px] text-star-100 placeholder:text-stardust-500"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="holo-panel flex w-full items-center justify-center gap-3 px-6 py-4 text-[15px] font-semibold text-star-100 transition hover:brightness-125 disabled:opacity-50"
              >
                <TicketGlyph />
                {busy ? "Transmitting boarding pass…" : "Transmit boarding pass"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setPhase("clearance")}
              className="mt-4 text-sm text-stardust-400 underline-offset-4 transition hover:text-stardust-200 hover:underline"
            >
              Choose another way
            </button>
          </div>
        )}

        {phase === "transmitted" && (
          <div className="animate-bloom mt-8 w-full">
            <h1 className="text-2xl font-semibold tracking-tight text-star-100">
              Boarding pass transmitted
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-stardust-300">
              Check your inbox, Captain — and the spam folder, just in case.
            </p>
            {resent && (
              <p className="mt-2 text-sm text-nova-300">
                Transmitted again — give it a minute to arrive.
              </p>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={resendLink}
                disabled={busy}
                className="holo-panel flex w-full items-center justify-center px-6 py-4 text-[15px] font-semibold text-star-100 transition hover:brightness-125 disabled:opacity-50"
              >
                {busy ? "Transmitting…" : "Didn't arrive? Re-transmit"}
              </button>
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={oauthBusy}
                className="w-full py-2 text-sm font-medium text-nova-300 underline-offset-4 transition hover:text-nova-200 hover:underline disabled:opacity-50"
              >
                {oauthBusy ? "Establishing secure uplink…" : "Or continue with Google instead"}
              </button>
            </div>
          </div>
        )}
          </>
        )}
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

/** Boarding-pass ticket glyph for the email magic-link option. */
function TicketGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2.5 2.5 0 0 0 0 5v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2.5 2.5 0 0 0 0-5z" />
      <path d="M13 5v2m0 4v2m0 4v2" strokeDasharray="2 2" />
    </svg>
  );
}
