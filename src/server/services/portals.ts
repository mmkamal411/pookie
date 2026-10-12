// School Credential Storage — framework-free business logic.
//
// SECURITY CONTRACT (003_credential_vault.sql):
//   * Passwords live ONLY in Supabase Vault (AES-256-GCM, managed). The
//     child_portals table holds METADATA; vault_secret_id is granted to NO
//     client role and is excluded from the child_portals_public view.
//   * Writes go through set_tenant_secret() — INVOKED WITH THE END-USER'S
//     JWT, never the service_role key (the function's parent check reads
//     auth.uid()). This service therefore uses the user-session client
//     exclusively. supabaseAdmin must NEVER touch these paths.
//   * The plaintext password is accepted in the POST body, passed straight
//     into the RPC argument, and never logged, never stored, never returned.
//     Search this file for "password" — it must appear only as a function
//     parameter flowing into the RPC call.
//   * "Test connection" here = test_portal_connection(): decrypts the Vault
//     material server-side and returns BOOLEAN only — it proves the stored
//     credential exists and is intact, NOT that the school portal accepts it.
//     The LIVE portal login check is the verify-credential Edge Function
//     (supabase/functions/verify-credential — stub; future work). The route
//     must not present a boolean true as "portal login verified".
import { createClient } from "@/lib/supabase/server";
import { guardServiceError } from "@/server/services/backend-availability";

export type PortalStatus = "unverified" | "verified" | "failed";

export interface PortalMetadata {
  id: string;
  child_id: string | null;
  portal_key: string;
  label: string;
  /** Username with all but the first character masked, e.g. 'd••••••'. Never the password. */
  username_masked: string | null;
  /** True when a Vault secret is stored behind this row (row exists ⇒ secret exists). */
  has_credential: boolean;
  status: PortalStatus;
  last_verified_at: string | null;
  consecutive_failures: number;
  credentials_updated_at: string;
  created_at: string;
}

function maskUsername(username: string | null): string | null {
  if (username == null || username === "") return null;
  if (username.length <= 1) return "•";
  return username[0] + "•".repeat(Math.min(username.length - 1, 24));
}

/** Portal metadata for the child (secret-less view). Parent-asserted by the route. */
export async function listPortals(childId: string): Promise<{ portals: PortalMetadata[] }> {
  const supabase = await createClient();
  // Missing credential vault (003 not migrated) → 503 SERVICE_NOT_READY,
  // never a 500.
  let data: unknown[] | null;
  try {
    const { data: rows, error } = await supabase
      .from("child_portals_public")
      .select(
        "id, child_id, portal_key, label, username, status, last_verified_at, consecutive_failures, credentials_updated_at, created_at",
      )
      .eq("child_id", childId)
      .order("portal_key");
    if (error) throw error;
    data = rows;
  } catch (err) {
    guardServiceError(err);
  }
  const portals: PortalMetadata[] = ((data ?? []) as Array<{
    id: string;
    child_id: string | null;
    portal_key: string;
    label: string;
    username: string | null;
    status: PortalStatus;
    last_verified_at: string | null;
    consecutive_failures: number;
    credentials_updated_at: string;
    created_at: string;
  }>).map((p) => ({
    id: p.id,
    child_id: p.child_id,
    portal_key: p.portal_key,
    label: p.label,
    username_masked: maskUsername(p.username),
    has_credential: true,
    status: p.status,
    last_verified_at: p.last_verified_at,
    consecutive_failures: p.consecutive_failures,
    credentials_updated_at: p.credentials_updated_at,
    created_at: p.created_at,
  }));
  return { portals };
}

export interface SavePortalInput {
  portal_key: string;
  label: string;
  username?: string | null;
  /** Plaintext password — passed ONLY into set_tenant_secret(); never logged. */
  password: string;
}

/**
 * Save (upsert) a portal credential. Rotates the Vault secret and resets the
 * row to status='unverified'. The password value never touches a log line.
 */
export async function savePortal(
  childId: string,
  input: SavePortalInput,
): Promise<{ portal: { id: string; portal_key: string; status: PortalStatus } }> {
  const supabase = await createClient();
  // Missing set_tenant_secret() (003 not migrated) → 503 SERVICE_NOT_READY,
  // never a 500.
  try {
    const { data, error } = await supabase.rpc("set_tenant_secret", {
      p_child_id: childId,
      p_portal_key: input.portal_key,
      p_label: input.label,
      p_username: input.username ?? null,
      p_secret: input.password,
    });
    if (error) throw error;
    return {
      portal: { id: data as string, portal_key: input.portal_key, status: "unverified" },
    };
  } catch (err) {
    guardServiceError(err);
  }
}

export interface PortalTestResult {
  ok: boolean;
  checked_at: string;
  /**
   * Honest scope label for the UI:
   *  'pre_save'       — password supplied but NOT persisted; only format/sanity
   *                     checks ran (non-empty, known portal_key). This is NOT a
   *                     portal login. The live login check is the future
   *                     verify-credential Edge Function.
   *  'vault_material' — no password supplied; the SAVED Vault secret was
   *                     decrypted server-side, proving it exists and is intact.
   *                     Also not a live portal login.
   */
  scope: "pre_save" | "vault_material";
  message: string;
}

export interface TestPortalInput {
  portal_key: string;
  /** When present: validate-before-save — the password is checked, never stored. */
  username?: string | null;
  password?: string | null;
}

const KNOWN_PORTAL_KEYS = new Set(["studentvue", "parentvue", "ctls-learn", "o365"]);

/**
 * Test-connection, dual mode. The password (when supplied) is used for
 * sanity checks ONLY and is never persisted, never logged, never returned.
 */
export async function testPortal(
  childId: string,
  input: TestPortalInput,
): Promise<PortalTestResult> {
  const checked_at = new Date().toISOString();
  if (!KNOWN_PORTAL_KEYS.has(input.portal_key)) {
    return {
      ok: false,
      checked_at,
      scope: "pre_save",
      message: `Unknown portal '${input.portal_key}'. Expected one of: ${[...KNOWN_PORTAL_KEYS].join(", ")}.`,
    };
  }
  if (input.password != null) {
    // Validate-before-save: sanity only. Live portal login is the
    // verify-credential Edge Function (future) — this must not be presented
    // as "portal login verified".
    if (input.password === "") {
      return { ok: false, checked_at, scope: "pre_save", message: "Password must not be empty." };
    }
    return {
      ok: true,
      checked_at,
      scope: "pre_save",
      message:
        "Format checks passed. Live portal login verification runs after save (verify-credential).",
    };
  }
  // Saved-credential mode: decrypt the Vault material server-side, boolean only.
  const supabase = await createClient();
  // Missing test_portal_connection() (003 not migrated) → 503, never a 500.
  let data: unknown;
  try {
    const { data: result, error } = await supabase.rpc("test_portal_connection", {
      p_child_id: childId,
      p_portal_key: input.portal_key,
    });
    if (error) throw error;
    data = result;
  } catch (err) {
    guardServiceError(err);
  }
  const ok = data === true;
  return {
    ok,
    checked_at,
    scope: "vault_material",
    message: ok
      ? "Stored credential decrypts correctly."
      : "No working credential stored for this portal.",
  };
}

/** Remove a portal credential: deletes the Vault secret AND the metadata row. Idempotent. */
export async function removePortal(
  childId: string,
  portalKey: string,
): Promise<{ removed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_tenant_secret", {
    p_child_id: childId,
    p_portal_key: portalKey,
  });
  if (error) throw error;
  return { removed: data === true };
}
