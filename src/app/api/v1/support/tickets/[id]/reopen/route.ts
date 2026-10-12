// POST /api/v1/support/tickets/[id]/reopen — user reopens a ticket
// (resolved|closed → in_progress; closed only ≤30 days). Coded against the
// pending rpc_user_reopen contract; same RPC-first + guarded service-client
// fallback as the confirm route. reopened_count bumps; >2 flags lead review.

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handleRoute(async (ctx) => {
  const ticketId = (ctx.params as { id: string }).id;
  const supabase = await createClient();

  try {
    const { data, error } = await supabase.rpc("rpc_user_reopen", { p_ticket_id: ticketId });
    if (!error) return { status: "in_progress", ...(data as object | null) };
    if (!/function .* does not exist|42883|PGRST202|Could not find the function/i.test(error.message ?? "")) {
      throw new ApiError(ErrorCodes.INTERNAL);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.INTERNAL);
  }

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("id, user_id, status, closed_at, reopened_count")
    .eq("id", ticketId)
    .maybeSingle();
  const t = ticket as {
    id: string;
    user_id: string;
    status: string;
    closed_at: string | null;
    reopened_count: number | null;
  } | null;
  if (!t || t.user_id !== ctx.userId) throw new ApiError(ErrorCodes.NOT_FOUND);

  const reopenable =
    t.status === "resolved" ||
    (t.status === "closed" &&
      t.closed_at &&
      Date.now() - new Date(t.closed_at).getTime() <= 30 * 24 * 60 * 60 * 1000);
  if (!reopenable) throw new ApiError(ErrorCodes.TICKET_TRANSITION_INVALID);

  const reopenedCount = (t.reopened_count ?? 0) + 1;
  const { error: updError } = await supabaseAdmin
    .from("support_tickets")
    .update({
      status: "in_progress",
      reopened_count: reopenedCount,
      lead_review: reopenedCount > 2,
    })
    .eq("id", ticketId);
  if (updError) throw new ApiError(ErrorCodes.INTERNAL);
  await supabaseAdmin.from("ticket_events").insert({
    ticket_id: ticketId,
    author_type: "system",
    author_id: null,
    kind: "status_change",
    body: "You reopened this ticket — it's back with our team.",
  });
  return { status: "in_progress", reopened_count: reopenedCount };
});
