import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships } from "@/lib/tenant/actions";
import { NebulaBackground } from "@/components/nebula-background";
import { AddChildForm } from "./add-child-form";

// Session-dependent — always block, never prerender.
export const dynamic = "force-dynamic";

/**
 * /add-child — first-child-after-"just me". Only reachable for signed-in
 * users with zero memberships: anyone who already has a family adds
 * further children from Settings → Profile (create_child path).
 * The form reuses the onboarding server action, so the RPC's
 * first-child-only rule is enforced server-side regardless.
 */
export default async function AddChildPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/add-child");

  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/");

  return (
    <main className="relative flex min-h-screen min-h-dvh w-full overflow-hidden bg-nebula-950">
      <NebulaBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 items-center px-6 py-12">
        <AddChildForm />
      </div>
    </main>
  );
}
