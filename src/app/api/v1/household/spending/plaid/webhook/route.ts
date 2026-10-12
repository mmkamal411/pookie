// POST /api/v1/household/spending/plaid/webhook — Plaid webhook receiver.
// Plaid cannot authenticate as a Pookie user, so this route deliberately does
// NOT use handleRoute (which requires a session). It only triggers a sync for
// the item named in the webhook body — the body is never trusted for data.
// Served over HTTPS; Plaid signs nothing, so the sync path re-verifies via
// the stored encrypted access token.
import { NextRequest, NextResponse } from 'next/server';
import { handlePlaidWebhook } from '@/server/services/plaid';

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const result = await handlePlaidWebhook(body);
    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    console.error(`[${requestId}] plaid webhook error:`, err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL', message: 'Something went wrong.', requestId } },
      { status: 500 },
    );
  }
}
