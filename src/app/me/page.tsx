import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMemberships, signOut } from "@/lib/tenant/actions";
import { NebulaBackground } from "@/components/nebula-background";
import { PookieOrb } from "@/components/pookie-orb";
import PageGlide from "@/components/page-glide";

// Session-dependent — always block, never prerender.
export const dynamic = "force-dynamic";

const HOUSEHOLD_LINKS = [
  { href: "/household/mail", title: "Mail", sub: "Bills, letters, and action items" },
  { href: "/household/shopping", title: "Shopping", sub: "Lists the whole house shares" },
  { href: "/household/spending", title: "Spending", sub: "Where the money goes" },
  { href: "/household/vault", title: "Vault", sub: "Documents that matter" },
];

/**
 * /me — the "just me" home. Landed here by the root router when a signed-in,
 * onboarded user holds zero child memberships. Previously these users were
 * bounced to /login?error=no-invite: a signed-in person staring at the login
 * form with no dashboard and no path to add a child. This page is their
 * Pookie instead — their own household surfaces, plus the door to add a
 * first child later (via provision_onboarding_child, the zero-membership
 * RPC — create_child() would reject them).
 */
export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/me");

  // Anyone with a family belongs on the tenant router, not here.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect("/");

  // profiles (017) may not be applied yet — degrade to the email handle.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  const name = profile?.display_name?.trim() || user.email?.split("@")[0] || "there";

  return (
    <>
    <main className="relative flex min-h-screen w-full overflow-hidden bg-nebula-950">
      <NebulaBackground />
      <PageGlide>
      <div className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        <div className="flex items-center gap-4">
          <PookieOrb size={56} />
          <div>
            <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
              Your Pookie
            </p>
            <h1 className="text-sunlit mt-1 text-2xl font-semibold">
              Welcome, {name}
            </h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-stardust-300">
          Your Pookie is all yours — your household, watched over. If a child
          joins your life later, you can add them anytime.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {HOUSEHOLD_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="neon-pipe rounded-2xl bg-nebula-900/60 p-5 transition hover:bg-nebula-900"
            >
              <span className="block text-sm font-semibold text-star-100">
                {link.title}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
                {link.sub}
              </span>
            </Link>
          ))}
        </div>

        <Link
          href="/add-child"
          className="mt-3 block rounded-2xl border border-dashed border-nova-400/40 bg-nova-500/5 p-5 transition hover:border-nova-400/70 hover:bg-nova-500/10"
        >
          <span className="block text-sm font-semibold text-star-100">
            + Add a child
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
            Set up grades, school, and daily rhythm for your kid — whenever
            you&apos;re ready.
          </span>
        </Link>

        <form action={signOut} className="mt-8">
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
    </>
  );
}
