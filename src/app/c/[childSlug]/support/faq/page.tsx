import Link from "next/link";
import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { FaqSearch } from "@/components/support/faq-search";
import { FaqTree } from "@/components/support/faq-tree";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support/faq — S1 Help Center & FAQ (search-first). */
export default async function FaqPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-3xl">📖</span>
        <div>
          <h1 className="text-xl font-semibold text-star-100">Help Center</h1>
          <p className="text-sm text-stardust-300">answers, in plain language</p>
        </div>
      </div>

      <div className="mt-4">
        <FaqSearch childSlug={childSlug} />
      </div>

      <div className="mt-2">
        <FaqTree childSlug={childSlug} />
      </div>

      <p className="mt-6 text-center text-[13px] text-stardust-400">
        Can&apos;t find it?{" "}
        <Link href={`/c/${childSlug}/support/chat`} className="text-nova-300 underline">
          Ask Pookie (AI chat)
        </Link>{" "}
        ·{" "}
        <Link href={`/c/${childSlug}/support/tickets/new`} className="text-nova-300 underline">
          Open a ticket
        </Link>
      </p>
    </main>
  );
}
