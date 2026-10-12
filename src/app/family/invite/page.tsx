import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { InviteGenerator } from "./invite-generator";
import { StandbyConsole, StandbyConsoleSpacer } from "@/components/standby-console";

export const dynamic = "force-dynamic";

/**
 * /family/invite — Parent A's invite-from-inside (FR-AUTH-011, D5).
 *
 * Generates an unguessable deep link + QR for the other parent. 7-day TTL,
 * single use. Children with court_order_restriction set are excluded —
 * self-serve linking UI is hidden entirely for them.
 */
export default async function FamilyInvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/family/invite");

  const memberships = await getMemberships();
  const parentOf = memberships.filter((m) => m.role === "parent");

  // Hide court-order-restricted children entirely (D5 custody posture).
  const { data: flags } = await supabase
    .from("children")
    .select("id, court_order_restriction")
    .in(
      "id",
      parentOf.map((m) => m.child_id),
    );
  const restricted = new Set(
    ((flags ?? []) as Array<{ id: string; court_order_restriction?: boolean }>)
      .filter((f) => f.court_order_restriction)
      .map((f) => f.id),
  );
  const eligible = parentOf
    .filter((m) => !restricted.has(m.child_id))
    .map((m) => ({
      child_id: m.child_id,
      name: m.child.nickname ?? m.child.first_name,
    }));

  return (
    <>
      <InviteGenerator children={eligible} />
      <StandbyConsoleSpacer />
      <StandbyConsole label="Family invites" />
    </>
  );
}
