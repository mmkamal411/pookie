// POST /api/v1/support/tickets/[id]/confirm — user confirms a resolution
// (resolved → closed). Coded against the pending rpc_user_confirm_resolution
// contract. Until the RPC lands, the route writes the transition through
// the service-role client (RLS denies direct status updates to users) after
// validating ownership and state — the full contract check, not a shortcut.

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handleRoute(async (ctx) => {
  const ticketId = (ctx.params as { id: string }).id;
  const supabase = await createClient();

  // Contract path first: the real RPC when it exists.
  try {
    const { data, error } = await supabase.rpc("rpc_user_confirm_resolution", {
      p_ticket_id: ticketId,
    });
    if (!error) return { status: "closed", ...(data as object | null) };
    if (!/function .* does not exist|42883|PGRST202|Could not find the function/i.test(error.message ?? "")) {
      throw new ApiError(ErrorCodes.INTERNAL);
    }
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(ErrorCodes.INTERNAL);
  }

  // Fallback: same guards the RPC enforces, via the service client.
  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("id, user_id, status")
    .eq("id", ticketId)
    .maybeSingle();
  const t = ticket as { id: string; user_id: string; status: string } | null;
  if (!t || t.user_id !== ctx.userId) throw new ApiError(ErrorCodes.NOT_FOUND);
  if (t.status !== "resolved") throw new ApiError(ErrorCodes.TICKET_TRANSITION_INVALID);

  const { error: updError } = await supabaseAdmin
    .from("support_tickets")
    .update({ status: "closed", closed_at: new Date().toISOString() })
    .eq("id", ticketId);
  if (updError) throw new ApiError(ErrorCodes.INTERNAL);
  await supabaseAdmin.from("ticket_events").insert({
    ticket_id: ticketId,
    author_type: "system",
    author_id: null,
    kind: "status_change",
    body: "You confirmed this is resolved. The ticket is now closed.",
  });
  return { status: "closed" };
});
