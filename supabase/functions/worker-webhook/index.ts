// STUB — worker-webhook Edge Function.
// Purpose (future): receive job lifecycle events from laptop sync workers
// (claim/finish/heartbeat) as an alternative to direct Supabase RPC calls,
// giving us a single place for HMAC verification, rate limiting, and
// per-worker allowlist checks before the RPC layer.
//
// NOT IMPLEMENTED until the migration audit signs off. Workers continue to
// call the Supabase RPCs directly (rpc_claim_sync, etc.).
// See docs/handbook-sections/01-api-conventions.md §2 (REST for machines).
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
        message: 'Worker webhook is stubbed until the audit signs off.',
      },
    }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
});
