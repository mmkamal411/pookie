// GET /api/v1/support/faq/articles/[slug]?band= — S1 article fetch.
//
// Codes against the pending rpc_faq_get_article contract: full article
// including LegalAccordion fields (legal_note_md, legal_citation,
// legal_basis, reviewed/due dates, version), with legal_stale computed
// server-side. Band mismatch → faq_band_forbidden (never the article).
// anon OK for band=all only.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ViewerBand = "all" | "teen" | "parent" | "adult";

function bandAllows(articleBand: string, viewer: ViewerBand): boolean {
  if (articleBand === "all") return true;
  if (viewer === "adult") return true;
  return articleBand === viewer;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const requested = (new URL(req.url).searchParams.get("band") ?? "all") as ViewerBand;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let viewer: ViewerBand = "all";
  if (user) {
    try {
      const { data } = await supabase.rpc("support_user_age_band", { p_user_id: user.id });
      viewer = data === "teen" ? "teen" : data === "adult" ? "adult" : "all";
    } catch {
      viewer = "all";
    }
    if (requested !== "all") viewer = requested === "parent" && viewer === "adult" ? "parent" : requested;
  } else if (requested !== "all") {
    return NextResponse.json(
      { error: "faq_band_forbidden", message: "Sign in to read band-specific answers." },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("faq_articles")
    .select(
      "id, slug, title, body_md, category, keywords, age_band, related_slugs, " +
        "legal_note_md, legal_citation, legal_basis, legal_reviewed_at, legal_review_due_at, legal_version",
    )
    .eq("slug", slug)
    .eq("status", "live")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json(
      { error: "faq_not_found", message: "We couldn't find that article." },
      { status: 404 },
    );
  }
  const row = data as unknown as Record<string, unknown>;
  if (!bandAllows(row.age_band as string, viewer)) {
    return NextResponse.json(
      { error: "faq_band_forbidden", message: "That article isn't available for your age band." },
      { status: 403 },
    );
  }

  const due = row.legal_review_due_at as string | null;
  const legalStale = !!due && due < new Date().toISOString().slice(0, 10);

  // Related articles (same category, live, band-visible), editorial order.
  let related: { slug: string; title: string; category: string }[] = [];
  try {
    const slugs = (row.related_slugs as string[] | null) ?? [];
    if (slugs.length > 0) {
      const { data: rel } = await supabase
        .from("faq_articles")
        .select("slug, title, category, age_band")
        .in("slug", slugs.slice(0, 4))
        .eq("status", "live");
      related = ((rel ?? []) as Record<string, unknown>[])
        .filter((r) => bandAllows(r.age_band as string, viewer))
        .map((r) => ({ slug: r.slug as string, title: r.title as string, category: r.category as string }));
    }
  } catch {
    related = [];
  }

  return NextResponse.json({
    article: {
      article_id: row.id,
      slug: row.slug,
      title: row.title,
      body_md: row.body_md,
      category: row.category,
      keywords: row.keywords,
      age_band: row.age_band,
      related,
      legal_note_md: row.legal_note_md,
      legal_citation: row.legal_citation,
      legal_basis: row.legal_basis,
      legal_reviewed_at: row.legal_reviewed_at,
      legal_review_due_at: row.legal_review_due_at,
      legal_version: row.legal_version,
      legal_stale: legalStale,
    },
    band: viewer,
  });
}
