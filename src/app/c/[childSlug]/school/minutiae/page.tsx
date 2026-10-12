import { notFound } from "next/navigation";
import Link from "next/link";
import { getMemberships } from "@/lib/tenant/actions";
import { getMinutiaeCalendar } from "@/server/services/minutiae";
import { MinutiaeCalendar } from "@/components/school/minutiae-calendar";

// Tenant-scoped route — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /c/[childSlug]/school/minutiae — W16 school minutiae calendar.
 * The [childSlug] layout already runs the tenant firewall.
 */
export default async function MinutiaePage({
  params,
}: {
  params: Promise<{ childSlug: string }>;
}) {
  const { childSlug } = await params;

  const memberships = await getMemberships();
  const membership = memberships.find((m) => m.child.slug === childSlug);
  if (!membership) notFound();

  const events = await getMinutiaeCalendar(membership.child_id);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-4 pb-8">
      {/* Prism E5 2026-10-12: consistent back behavior — logical parent, not
          browser-back. */}
      <Link
        href={`/c/${childSlug}/school`}
        className="mb-4 inline-block text-sm font-medium text-nova-300 transition-all hover:text-nova-200"
        style={{ textShadow: "0 0 10px rgb(0 229 255 / 0.35)" }}
      >
        ← School Overview
      </Link>
      <MinutiaeCalendar
        events={events}
        childName={membership.child.nickname ?? membership.child.first_name}
        childId={membership.child_id}
        role={membership.role}
      />
    </main>
  );
}
