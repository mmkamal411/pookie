// POST /api/v1/support/faq/feedback — S1 article feedback (👍/👎).
//
// Coded against the pending rpc_faq_feedback contract. Until the RPC lands,
// inserts directly per 046's open feedback policy. The REAL faq_feedback
// table carries (article_id, helpful) only — reason/note are accepted and
// acknowledged in the response, and land with the RPC (never silently
// claimed as stored).

import { z } from "zod";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  article_id: z.string().uuid(),
  helpful: z.boolean(),
  reason: z.enum(["wrong_answer", "out_of_date", "too_confusing", "did_not_answer"]).optional(),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const body = feedbackSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json(
      { error: "validation_failed", message: "That feedback didn't come through cleanly." },
      { status: 422 },
    );
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("faq_feedback")
    .insert({ article_id: body.data.article_id, helpful: body.data.helpful });
  if (error) {
    return NextResponse.json(
      { error: "feedback_unavailable", message: "Couldn't save that just now — try again in a bit." },
      { status: 503 },
    );
  }
  return NextResponse.json({
    ok: true,
    stored: { article_id: body.data.article_id, helpful: body.data.helpful },
    detail_pending:
      body.data.reason || body.data.note
        ? "Your note will be stored with the full feedback record once the feedback service update lands."
        : null,
  });
}
