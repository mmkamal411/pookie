import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Squad Gavel 2026-10-12 — POST /api/v1/privacy/do-not-sell.
 *
 * Public (unauthenticated) endpoint: anyone may submit a do-not-sell/share
 * request. Validates the payload, logs it in structured form for the privacy
 * team to action, and returns a confirmation reference number.
 *
 * NOTE: this is a v1 log-and-queue implementation. Production should persist
 * requests to a privacy_requests table with identity-verification workflow.
 */

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(160),
  requestType: z.enum(["do-not-sell", "limit-sensitive"]),
});

function reference(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DNS-${t}-${r}`;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BAD_JSON", message: "Invalid request body." } },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION", message: "Name, email, and request type are required." },
      },
      { status: 400 },
    );
  }

  const ref = reference();
  // Structured log for the privacy team — picked up by log monitoring.
  // TODO(prod): persist to privacy_requests table + trigger verification email.
  console.info(
    JSON.stringify({
      event: "privacy.do_not_sell_request",
      reference: ref,
      requestType: parsed.data.requestType,
      email: parsed.data.email,
      at: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true, data: { reference: ref } });
}
