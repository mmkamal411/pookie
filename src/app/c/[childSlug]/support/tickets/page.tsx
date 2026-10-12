import Link from "next/link";
import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { TicketList } from "@/components/support/ticket-list";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support/tickets — S3 ticket list. */
export default async function TicketsPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <Link
        href={`/c/${childSlug}/support`}
        className="text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Support
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">🎫</span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">Support Tickets</h1>
          <p className="text-sm text-stardust-300">open a ticket, track it, talk to a human</p>
        </div>
      </div>
      <div className="mt-5">
        <TicketList childSlug={childSlug} />
      </div>
    </main>
  );
}
