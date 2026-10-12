import Link from "next/link";
import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TicketThread } from "@/components/support/ticket-thread";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support/tickets/[id] — S3 ticket thread. */
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ childSlug: string; id: string }>;
}) {
  const { childSlug, id } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <Link
        href={`/c/${childSlug}/support/tickets`}
        className="text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Tickets
      </Link>
      <div className="mt-3">
        <TicketThread ticketId={id} childSlug={childSlug} />
      </div>
    </main>
  );
}
