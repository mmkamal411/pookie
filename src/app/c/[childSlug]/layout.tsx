import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, setActiveChild } from "@/lib/tenant/actions";
import { TenantProvider } from "@/components/tenant-provider";
import { ChildSwitcher } from "@/components/child-switcher";
import { ChildToolbar } from "@/components/child-toolbar";
import { PookiePinball } from "@/components/pookie-pinball";

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
  if (!user) redirect("/login");

  const { childSlug } = await params;
  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  await setActiveChild(membership.child_id);

  return (
    <>
      <TenantProvider
        memberships={memberships}
        activeChildId={membership.child_id}
      >
        <header
          className="sticky top-0 z-40 border-b border-nova-400/10"
          style={{
            background: "linear-gradient(180deg, rgb(20 20 50 / 0.6), rgb(5 5 16 / 0.75))",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
            <ChildSwitcher />
            <Link
              href={`/c/${childSlug}/settings`}
              aria-label="Settings"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-nova-400/20 bg-nebula-900/70 text-lg text-stardust-300 transition-colors hover:border-nova-400/40 hover:text-nova-300"
            >
              <span aria-hidden="true">⚙</span>
            </Link>
          </div>
        </header>
        {children}
        {/* Spacer so the fixed bottom toolbar never covers page content. */}
        <div className="h-24" aria-hidden="true" />
        <ChildToolbar childSlug={childSlug} />
        <PookiePinball />
      </TenantProvider>
    </>
  );
}
