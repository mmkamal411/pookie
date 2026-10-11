import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  consumeInvite,
  getActiveChildId,
  getMemberships,
  setActiveChild,
} from "@/lib/tenant/actions";

// Tenant resolution reads the session cookie — this route always blocks.
export const instant = false;

/**
 * Root router — resolves login email → tenant per the plan (§4.1):
 * - No session → /login
 * - ?invite= token → consume it, then continue
 * - 0 memberships → /login (pending-invite state; no data rendered)
 * - 1 membership → straight into that child's dashboard (no switcher, ever)
 * - N memberships (parent) → /select-child
 * - Existing session with active child → that child's dashboard
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  if (params.invite) await consumeInvite(params.invite);

  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/login?error=no-invite");

  const activeChildId = await getActiveChildId();
  const active = memberships.find((m) => m.child_id === activeChildId);
  if (active) redirect(`/c/${active.child.slug}`);

  if (memberships.length === 1) {
    await setActiveChild(memberships[0].child_id);
    redirect(`/c/${memberships[0].child.slug}`);
  }

  redirect("/select-child");
}
