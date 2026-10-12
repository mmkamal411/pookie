import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { TenantProvider } from "@/components/tenant-provider";
import { ChildSwitcher } from "@/components/child-switcher";
import { ShipSettingsControl } from "@/components/ship-settings-control";
import { GlassPane } from "@/components/glass-pane";
import PageGlide from "@/components/page-glide";
import { WindowManagerProvider } from "@/components/window-manager";
import { ModuleWindowFrame } from "@/components/module-window";
import { MinimizedDock } from "@/components/minimized-dock";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * Child dashboard shell — slug-routed tenant context from day one.
 * Verifies the slug belongs to the caller's membership set; anything
 * else 404s (RLS would deny the data regardless).
 *
 * Header identity model (Mehedi 2026-10-12): the top-right crew cluster
 * shows the LOGGED-IN USER (parent) as a pilot readout, grouped with the
 * ship-systems control. Tapping the name docks the crew-roster module to
 * switch which child is viewed. The child name never sits in the header.
 *
 * Every page renders inside <GlassPane> — one consistent digital-glass
 * viewscreen (same max-width site-wide).
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
  // F4: Signed-in user with zero visible memberships → onboarding, not 404.
  // This is the recovery path for fresh accounts or transient lookup failures.
  if (memberships.length === 0) redirect("/onboarding");
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  // Parent display name for the crew cluster. profiles (017) may not be
  // applied yet — degrade to the email handle, never crash.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const parentName =
    profile?.display_name?.trim() || user.email?.split("@")[0] || "You";

  // NOTE: Do NOT call setActiveChild() here. cookies().set() throws
  // "Cookies can only be modified in a Server Action or Route Handler"
  // when executed during Server Component render, which 500s this layout
  // for every user (Squad 2 root-cause 2026-10-12). The tenant is already
  // resolved from the URL slug and passed to TenantProvider below —
  // the cookie is redundant for rendering.

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
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
            <p className="instrument-label" aria-hidden="true">
              Pookie
            </p>
            {/* Crew + ship-controls cluster: parent readout + systems dial */}
            <div className="console-cluster flex items-center gap-0.5 rounded-full py-1 pr-1.5 pl-1">
              <ChildSwitcher parentName={parentName} role={membership.role} />
              <span className="console-cluster-divider" aria-hidden="true" />
              <ShipSettingsControl childSlug={childSlug} />
            </div>
          </div>
        </header>
        <WindowManagerProvider>
          <GlassPane>
            <PageGlide>
              <ModuleWindowFrame>{children}</ModuleWindowFrame>
            </PageGlide>
          </GlassPane>
          {/* Stowed-module chips — float above the Command Deck (Squad Windows 2026-10-12). */}
          <MinimizedDock />
        </WindowManagerProvider>
        {/* Spacer so the fixed Command Deck never covers page content.
            The deck itself now lives in the root layout (Squad Deck 2026-10-12)
            — mounted once, never unmounts, never scrolls away. */}
        <div className="h-32 shrink-0" aria-hidden="true" />
      </TenantProvider>
    </>
  );
}
