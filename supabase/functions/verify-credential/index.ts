// STUB — verify-credential Edge Function.
// Purpose (future): test portal credentials after a parent saves them via the
// Portals UI, WITHOUT the secret ever touching the app server: the function
// reads the Vault secret via get_tenant_secret(), attempts a login against the
// school system's adapter, and returns { ok, status } only.
//
// NOT IMPLEMENTED until the migration audit signs off (C2/C3, H1/H2 open).
// See docs/handbook-sections/01-api-conventions.md §6 and PLAN.md §4.8.
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: { code: 'NOT_IMPLEMENTED' } }), {
      status: 501,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message: 'Credential verification is stubbed until the vault audit signs off.',
      },
    }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
});
