/**
 * withRetry — retry-once helper for transient DB/network failures.
 *
 * Retries once (default) on network/timeout/5xx-class errors.
 * Never retries on 4xx, auth failures, or RLS denials (deterministic).
 *
 * Used by getMemberships() and getSchoolOverview() so a single
 * PostgREST blip doesn't crash the page.
 */

type RetryOpts = {
  retries?: number;
  delayMs?: number;
};

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; status?: number; message?: string };
  // PostgREST/Supabase error codes for transient failures
  const msg = (e.message ?? "").toLowerCase();
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("econnreset") ||
    msg.includes("socket hang up") ||
    msg.includes("502") ||
    msg.includes("503") ||
    msg.includes("504")
  ) {
    return true;
  }
  // HTTP 5xx status codes
  if (e.status && e.status >= 500 && e.status < 600) return true;
  // Never retry auth/RLS/4xx — those are deterministic
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {},
): Promise<T> {
  const retries = opts.retries ?? 1;
  const delayMs = opts.delayMs ?? 250;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRetryable(err)) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}
