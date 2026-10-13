import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/tenant/actions";
import { getPilotLayoutPlan } from "@/lib/pilot-layout";
import { getNudges } from "@/lib/nudges";
import PageGlide from "@/components/page-glide";
import { WindowManagerProvider } from "@/components/window-manager";
import { AppletHost } from "@/components/applet-host";
import { HeroVista } from "@/components/pilot/hero-vista";
import { AdaptiveDashboard } from "@/components/pilot/adaptive-dashboard";
import { NudgeFeed } from "@/components/nudge-feed";

// Session-dependent — always block, never prerender.
export const dynamic = "force-dynamic";

/**
 * /me — the pilot's own bridge, and the default landing for EVERY
 * signed-in, onboarded user (Meheldi 2026-10-12, final brief ~22:28).
 *
 * Final composition — calm and exact:
 *   1. Live planetary video vista behind it all (vista-sources.ts is the
 *      integration point; cosmic loop until the designer delivers planets).
 *   2. ONE glass pane: local weather + calendar visible, expanding for
 *      to-do details. The pane's sections render from the AI's layout plan
 *      (adaptive-zone architecture); the pilot can arrange/lock sections.
 *   3. The proactive AI speaks through the nudge banner + section
 *      highlights — ambient, never a chatbot home.
 *
 * Everything else is a station: the Stations button in the standby console
 * opens the module directory (pilot stations + the Crew hub) as applets.
 * Child consoles open from the Crew hub as applets — the child cockpit is
 * an opt-in module, never the front door.
 */
export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me");

  // profiles (017) may not be applied yet — degrade to the email handle.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const name = profile?.display_name?.trim() || user.email?.split("@")[0] || "there";

  // Adaptive-zone seams: the AI automation architect drives these.
  const [plan, nudges] = await Promise.all([getPilotLayoutPlan(), getNudges()]);

  return (
    <WindowManagerProvider>
      <main className="relative flex min-h-screen min-h-dvh w-full overflow-hidden">
        <PageGlide>
          <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 pt-6 pb-12">
            <HeroVista pilotName={name} />
            <AdaptiveDashboard initialPlan={plan} nudges={nudges} />
            {/* "Overnight by Pookie" — what the background AI noticed,
                drafted, or handled while the pilot was away. */}
            <NudgeFeed />
            <form action={signOut} className="mt-8 text-center">
              <button
                type="submit"
                className="text-xs font-medium text-stardust-400 underline-offset-4 transition hover:text-stardust-200 hover:underline"
              >
                Sign out
              </button>
            </form>
          </div>
        </PageGlide>
        {/* Spacer for the root Command Deck (Squad Deck 2026-10-12). */}
        <div className="h-32 shrink-0" aria-hidden="true" />
      </main>
      {/* Module applets (Crew hub, stations) open over the bridge —
          same minimize/close chrome as everywhere else. */}
      <AppletHost />
    </WindowManagerProvider>
  );
}
