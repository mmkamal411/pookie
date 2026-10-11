import Link from "next/link";
import { PookieOrb } from "@/components/pookie-orb";
import { MoreDirectory } from "@/components/more-directory";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/more — the More tab.
 * The full 31-module directory in 6 life groves, plus Settings.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function MorePage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;

  return (
    <main className="relative mx-auto max-w-5xl overflow-hidden px-4 pt-10 pb-8">
      <div className="firefly" style={{ width: 8, height: 8, top: "5%", left: "14%" }} />
      <div className="firefly" style={{ width: 6, height: 6, top: "24%", left: "84%", animationDelay: "2s" }} />

      <div className="animate-bloom flex items-center gap-4">
        <PookieOrb size={52} />
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 uppercase">
          More · everything else
        </p>
      </div>
      <h1 className="text-sunlit animate-bloom mt-3 text-3xl font-semibold tracking-tight" style={{ animationDelay: "0.08s" }}>
        The whole grove
      </h1>
      <p className="animate-bloom mt-2 max-w-xl text-sm leading-relaxed text-stardust-300" style={{ animationDelay: "0.12s" }}>
        Every module Pookie watches over — live ones open right up, seedlings show their first step.
      </p>

      <Link
        href={`/c/${childSlug}/settings`}
        className="card-living animate-bloom mt-6 flex items-center justify-between rounded-2xl px-5 py-4"
        style={{ animationDelay: "0.16s" }}
      >
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="text-xl">⚙</span>
          <div>
            <p className="text-sm font-medium text-star-100">Settings</p>
            <p className="text-xs text-stardust-300">Profile, sync, workers, school logins</p>
          </div>
        </div>
        <span aria-hidden="true" className="text-nova-300">→</span>
      </Link>

      <div className="mt-10">
        <MoreDirectory childSlug={childSlug} />
      </div>
    </main>
  );
}
