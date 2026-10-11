import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, setActiveChild } from "@/lib/tenant/actions";
import { TenantProvider } from "@/components/tenant-provider";

// Tenant-scoped route — always renders at request time.
export const instant = false;

/**
 * Child dashboard shell — slug-routed tenant context from day one.
 * Verifies the slug belongs to the caller's membership set; anything
 * else 404s (RLS would deny the data regardless).
 */
export default async function ChildDashboard({
  params,
  children,
}: {
  params: Promise<{ childSlug: string }>;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { childSlug } = await params;
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  await setActiveChild(membership.child_id);

  return (
    <TenantProvider
      memberships={memberships}
      activeChildId={membership.child_id}
    >
      {children}
    </TenantProvider>
  );
}
