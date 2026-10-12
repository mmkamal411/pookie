import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClaimsInbox } from "./claims-inbox";

export const dynamic = "force-dynamic";

/**
 * /family/claims — incoming second-parent claims awaiting a decision.
 *
 * - Parent A sees the under-13 queue routed to them.
 * - The teen sees their own 13+ queue (they approve their other parent).
 * Approving creates the link immediately; rejecting locks re-requests for
 * 30 days. No claim form data (name/DOB/email) is echoed — the approver acts
 * on the request, not on re-displayed PII.
 */
export default async function ClaimsInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/family/claims");

  return <ClaimsInbox />;
}
