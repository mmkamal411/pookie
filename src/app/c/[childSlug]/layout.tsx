import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { TenantProvider } from "@/components/tenant-provider";
import { CommandCenterButton } from "@/components/command-center";
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
 * Header identity model (Mehedi 2026-10-12): NO top toolbar — it takes
 * too much space. The only top chrome is the floating Command Center
 * button (top-right, pulsing neon ring + beacon): it opens the
 * mission-critical menu with the pilot readout (the LOGGED-IN USER, never
 * the child), the crew roster for switching children, the bridge theme
 * switcher, and the settings / sign-out parameters.
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

  // Pilot readout for the Command Center menu. profiles (017) may not be
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
        {/* The only top chrome: the Command Center button floats top-right.
            No toolbar — it opens the mission-critical menu on tap. */}
        <CommandCenterButton
          parentName={parentName}
          role={membership.role}
          childSlug={childSlug}
        />
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
