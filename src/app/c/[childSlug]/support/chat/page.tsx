import Link from "next/link";
import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { AiChat } from "@/components/support/ai-chat";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support/chat — S2 AI Support Chat. */
export default async function SupportChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ childSlug: string }>;
  searchParams: Promise<{ article?: string }>;
}) {
  const { childSlug } = await params;
  const { article } = await searchParams;
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
      <div className="mt-2">
        <AiChat
          childSlug={childSlug}
          initialArticle={article}
          parentContextName={
            ctx.band === "child" && ctx.role === "parent" ? "a parent" : undefined
          }
        />
      </div>
    </main>
  );
}
