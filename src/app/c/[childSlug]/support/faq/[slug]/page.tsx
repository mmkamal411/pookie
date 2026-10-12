import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSquad5Context } from "@/lib/squad5/context";
import { ArticleView, type Article } from "@/components/support/article-view";

export const dynamic = "force-dynamic";

function bandAllows(articleBand: string, viewer: string): boolean {
  if (articleBand === "all") return true;
  if (viewer === "adult") return true;
  return articleBand === viewer;
}

/** /c/[childSlug]/support/faq/[slug] — S1 article (§4.3 template). */
export default async function FaqArticlePage({
  params,
}: {
  params: Promise<{ childSlug: string; slug: string }>;
}) {
  const { childSlug, slug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();

  // Server-side read through the user-scoped client (RLS) with the same
  // band enforcement as the article API route.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faq_articles")
    .select(
      "id, slug, title, body_md, category, keywords, age_band, related_slugs, " +
        "legal_note_md, legal_citation, legal_basis, legal_reviewed_at, legal_review_due_at, legal_version",
    )
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  if (error || !data) notFound();
  const row = data as unknown as Record<string, unknown>;
  const viewerBand = ctx.band === "adult" ? "adult" : ctx.band === "teen" ? "teen" : "all";
  if (!bandAllows(row.age_band as string, viewerBand)) notFound();

  const due = row.legal_review_due_at as string | null;
  const legalStale = !!due && due < new Date().toISOString().slice(0, 10);

  let related: Article["related"] = [];
  const slugs = ((row.related_slugs as string[] | null) ?? []).slice(0, 4);
  if (slugs.length > 0) {
    const { data: rel } = await supabase
      .from("faq_articles")
      .select("slug, title, category, age_band")
      .in("slug", slugs)
      .eq("status", "live");
    related = ((rel ?? []) as Record<string, unknown>[])
      .filter((r) => bandAllows(r.age_band as string, viewerBand))
      .map((r) => ({ slug: r.slug as string, title: r.title as string, category: r.category as string }));
  }

  const article: Article = {
    article_id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    body_md: row.body_md as string,
    category: row.category as string,
    age_band: row.age_band as string,
    related,
    legal_note_md: row.legal_note_md as string | null,
    legal_citation: row.legal_citation as string | null,
    legal_basis: row.legal_basis as Article["legal_basis"],
    legal_reviewed_at: row.legal_reviewed_at as string | null,
    legal_review_due_at: row.legal_review_due_at as string | null,
    legal_version: (row.legal_version as number) ?? 1,
    legal_stale: legalStale,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 pt-6 pb-10">
      <Link
        href={`/c/${childSlug}/support/faq`}
        className="text-sm text-nova-300 transition-colors hover:text-nova-200"
      >
        ← Help Center
      </Link>
      <div className="mt-3">
        <ArticleView article={article} childSlug={childSlug} />
      </div>
    </main>
  );
}
