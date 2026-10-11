import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DemoBanner } from "@/components/demo-banner";
import { isDemoRequest } from "@/lib/demo";
import { getMemberships, setActiveChild } from "@/lib/tenant/actions";
import { TenantProvider } from "@/components/tenant-provider";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

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
  // Demo sessions have no Supabase user — memberships come from mock data.
  if (!user && !(await isDemoRequest())) redirect("/login");

  const { childSlug } = await params;
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  // Demo sessions: the /demo route handler already set the active-child
  // cookie (cookies().set() throws in Server Components on the edge).
  if (!(await isDemoRequest())) {
    await setActiveChild(membership.child_id);
  }

  return (
    <>
      <DemoBanner />
      <TenantProvider
        memberships={memberships}
        activeChildId={membership.child_id}
      >
        {children}
      </TenantProvider>
    </>
  );
}
