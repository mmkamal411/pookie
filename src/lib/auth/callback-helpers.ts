/**
 * Pure helpers for /auth/callback. Framework-free by design so they can be
 * unit-tested with node --test (no Next.js runtime needed).
 */

/**
 * Allow only same-origin post-auth destinations. The login page validates
 * ?next= the same way, but the callback must not trust it blindly — a
 * crafted /auth/callback?next=//evil.com would otherwise bounce a freshly
 * authenticated user off-site (`${origin}//evil.com` normalizes away).
 */
export function safePostAuthNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

/** Login ?error= codes the callback can produce. */
export type AuthFailureCode = "auth" | "auth_expired" | "auth_pkce";

/**
 * Map a Supabase code-exchange failure to a login ?error= code so the
 * login page can show a targeted recovery hint instead of one generic
 * "try again":
 *  - auth_expired: the magic link / OAuth code is stale — request a fresh one.
 *  - auth_pkce: the PKCE verifier didn't survive the round trip (blocked
 *    storage/cookies, private tab) — enable cookies or use a magic link.
 *  - auth: everything else.
 */
export function authFailureCode(message: string): AuthFailureCode {
  const m = message.toLowerCase();
  if (
    m.includes("expired") ||
    m.includes("invalid_grant") ||
    m.includes("invalid grant")
  ) {
    return "auth_expired";
  }
  if (m.includes("code verifier") || m.includes("pkce")) {
    return "auth_pkce";
  }
  return "auth";
}
