// GET /api/v1/support/faq/tree — S1 section tree (S5-001 AC1: the 9-section
// tree renders from the DB, no hardcoded article bodies in the client).
// Server-side age-band filtering; hidden counts never disclosed.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SECTIONS = [
  { key: "health", title: "Health" },
  { key: "home", title: "Home" },
  { key: "school", title: "School" },
  { key: "safety", title: "Safety" },
  { key: "travel", title: "Travel" },
  { key: "marketplace", title: "Marketplace" },
  { key: "support", title: "Support" },
  { key: "account", title: "Account & Privacy" },
  { key: "legal", title: "Legal & Your Rights" },
];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdult = false;
  let isTeen = false;
  if (user) {
    try {
      const { data } = await supabase.rpc("support_user_age_band", { p_user_id: user.id });
      isAdult = data === "adult";
      isTeen = data === "teen";
    } catch {
      // fail closed: 'all' only
    }
  }

  const { data, error } = await supabase
    .from("faq_articles")
    .select("slug, title, category, age_band, legal_basis")
    .eq("status", "live")
    .order("title");

  if (error) {
    return NextResponse.json({ sections: SECTIONS.map((s) => ({ ...s, articles: [] })) });
  }

  const rows = (data ?? []) as {
    slug: string;
    title: string;
    category: string;
    age_band: string;
    legal_basis: string | null;
  }[];
  // Server-side band filter (hidden counts never disclosed).
  const visible = rows.filter((r) => {
    if (r.age_band === "all") return true;
    if (isAdult) return true;
    if (isTeen) return r.age_band === "teen";
    return false;
  });

  const sections = SECTIONS.map((s) => ({
    ...s,
    articles: visible
      .filter((r) => r.category === s.key)
      .map((r) => ({ slug: r.slug, title: r.title, has_legal: r.legal_basis != null })),
  }));

  return NextResponse.json({ sections });
}
