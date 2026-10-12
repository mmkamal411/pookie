// POST /api/v1/household/spending/plaid/webhook — RETIRED.
//
// WINDOW-NOT-VAULT (2026-10-12): Plaid webhooks are non-functional without
// server-stored access tokens. Since the token lives on the phone (secure
// enclave) and the server only fetches on explicit user view, there is nothing
// for a webhook to trigger. This endpoint returns 410 Gone.
//
// If Plaid sends webhooks, they are safely ignored.
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: 'GONE',
        message:
          'Plaid webhooks are retired. Bank data is fetched live on view — ' +
          'the access token lives on your phone, not our servers.',
      },
    },
    { status: 410 },
  );
}
