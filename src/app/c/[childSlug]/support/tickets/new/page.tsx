import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getSquad5Context } from "@/lib/squad5/context";
import { TicketForm } from "@/components/support/ticket-form";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support/tickets/new — S3 new-ticket form. */
export default async function NewTicketPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
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
      <div className="mt-3 flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">🎫</span>
        <h1 className="text-xl font-semibold text-star-100">Open a Ticket</h1>
      </div>
      <div className="mt-5">
        <Suspense>
          <TicketForm
            childSlug={childSlug}
            isTeen={ctx.band === "teen"}
            onBehalfOf={ctx.band === "child" && ctx.role === "parent" ? ctx.childName : undefined}
          />
        </Suspense>
      </div>
    </main>
  );
}
