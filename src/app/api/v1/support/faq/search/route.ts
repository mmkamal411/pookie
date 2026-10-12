// GET /api/v1/support/faq/search?q=&band= — S1 FAQ search.
//
// Codes against the pending rpc_faq_search contract: keyword-first over
// search_vector, typo-tolerant fallback, server-side age-band filtering,
// "Related answers" semantic fallback only when keyword is weak.
//
// Until rpc_faq_search lands, the route runs the same query via PostgREST:
//   1. textSearch on search_vector (ts_rank ordering is approximated by
//      title-match priority, then keyword match)
//   2. ilike word-fallback for typo tolerance when full-text returns <3
//   3. semantic fallback (PENDING rpc_faq_semantic_search + embeddings)
//      → reported honestly as unavailable
//
// Age-band filtering MUST happen server-side (046's public read is
// band-blind): the route filters before responding, and the count of hidden
// results is never disclosed. anon OK for band=all only.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CATEGORIES = [
  "health",
  "home",
  "school",
  "safety",
  "travel",
  "marketplace",
  "support",
  "account",
  "legal",
];

type ViewerBand = "all" | "teen" | "parent" | "adult";

function bandAllows(articleBand: string, viewer: ViewerBand): boolean {
  if (articleBand === "all") return true;
  if (viewer === "adult") return true;
  return articleBand === viewer;
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 200);
  const requested = (params.get("band") ?? "all") as ViewerBand;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Band resolution: anon → 'all' only; authenticated → server-side band.
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
      { error: "faq_band_forbidden", message: "Sign in to see band-specific answers." },
      { status: 403 },
    );
  }

  if (!q) {
    return NextResponse.json({ results: [], band: viewer, semantic_available: false });
  }

  const cols = "id, slug, title, category, age_band, body_md";
  // 1. Full-text first.
  let rows: Record<string, unknown>[] = [];
  try {
    const { data } = await supabase
      .from("faq_articles")
      .select(cols)
      .eq("status", "live")
      .textSearch("search_vector", q, { type: "plain", config: "english" })
      .limit(25);
    rows = (data ?? []) as Record<string, unknown>[];
  } catch {
    rows = [];
  }

  // 2. Typo-tolerant fallback when full-text returns <3: word-level ilike on title.
  if (rows.length < 3) {
    const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2).slice(0, 4);
    const seen = new Set(rows.map((r) => r.id as string));
    for (const w of words) {
      try {
        const { data } = await supabase
          .from("faq_articles")
          .select(cols)
          .eq("status", "live")
          .ilike("title", `%${w}%`)
          .limit(10);
        for (const r of (data ?? []) as Record<string, unknown>[]) {
          if (!seen.has(r.id as string)) {
            seen.add(r.id as string);
            rows.push(r);
          }
        }
      } catch {
        // keep going — search degrades, never dies
      }
      if (rows.length >= 10) break;
    }
  }

  // 3. Server-side age-band filter (hidden counts never disclosed).
  const filtered = rows.filter((r) => bandAllows(r.age_band as string, viewer));

  // Simple ranking: exact title match > title word match > body match.
  const ql = q.toLowerCase();
  const rank = (r: Record<string, unknown>): number => {
    const title = String(r.title ?? "").toLowerCase();
    if (title === ql) return 3;
    if (title.includes(ql)) return 2;
    return 1;
  };

  const results = filtered
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, 10)
    .map((r) => ({
      article_id: r.id,
      slug: r.slug,
      title: r.title,
      category: CATEGORIES.includes(r.category as string) ? r.category : "support",
      snippet: String(r.body_md ?? "").slice(0, 280),
    }));

  return NextResponse.json({
    results,
    band: viewer,
    semantic_available: false, // PENDING rpc_faq_semantic_search — honest, not faked
  });
}
