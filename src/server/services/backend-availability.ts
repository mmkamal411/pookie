// Backend-availability guard for the settings/sync data layer.
//
// Several settings/sync services depend on backend pieces that may not be
// wired up yet on a given deployment: the SUPABASE_SERVICE_ROLE_KEY env var
// (server-side admin access) and migrated tables/RPCs (013 sync queue,
// 066 school telemetry, 003 credential vault). When they are missing, the
// route must answer 503 SERVICE_NOT_READY (plain-English "not connected
// yet") — never a 500, never a blank page.
//
// Usage: call guardServiceError(err) in a catch block around supabaseAdmin
// or Vault-RPC access.
import { ApiError, ErrorCodes } from "@/server/errors";

/** True when err means "the backend for this feature isn't wired up yet". */
export function isBackendNotReady(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    message.includes("SUPABASE_SERVICE_ROLE_KEY is not set") ||
    message.includes("Could not find the function") ||
    /relation ".*" does not exist/.test(message) ||
    /schema ".*" does not exist/.test(message)
  );
}

/**
 * Re-throw backend-availability failures as ApiError(SERVICE_NOT_READY);
 * re-throw anything else unchanged. Call in a catch block around
 * supabaseAdmin / Vault-RPC access.
 */
export function guardServiceError(err: unknown): never {
  if (err instanceof ApiError) throw err;
  if (isBackendNotReady(err)) throw new ApiError(ErrorCodes.SERVICE_NOT_READY);
  throw err;
}
