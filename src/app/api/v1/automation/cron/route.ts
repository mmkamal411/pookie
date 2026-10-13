// POST /api/v1/automation/cron — background AI cycle runner.
// Called by the Cloudflare `pookie-automation` worker's Cron Triggers (phase 2).
// Until then, invoke manually or from any scheduler.
//
// Auth: shared secret, NOT a user session (cron has no pilot). The request
// must carry header `x-automation-secret` equal to AUTOMATION_CRON_SECRET.
// Fail closed: no secret configured → 503, never an open runner.
//
// Envelope matches the house shape: { ok, data } / { ok:false, error }.
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runAutomationCycle } from "@/lib/automation";

export const dynamic = "force-dynamic";

function secretsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const configured = process.env.AUTOMATION_CRON_SECRET;
  const provided = req.headers.get("x-automation-secret") ?? "";

  if (!configured) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "SERVICE_NOT_READY",
          message: "The overnight check isn't set up yet. Your data is still here.",
          requestId,
        },
      },
      { status: 503 },
    );
  }
  if (!provided || !secretsEqual(provided, configured)) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "Not allowed.", requestId },
      },
      { status: 403 },
    );
  }

  let refreshLayout = false;
  try {
    const body = (await req.json()) as { refreshLayout?: unknown };
    refreshLayout = body.refreshLayout === true;
  } catch {
    // No body — default cycle (watchers only).
  }

  try {
    const result = await runAutomationCycle({ refreshLayout });
    return NextResponse.json({ ok: true, data: result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL",
          message: "The overnight check ran into a problem. Your data is still here.",
          requestId,
        },
      },
      { status: 500 },
    );
  }
}
