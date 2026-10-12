// GET /api/v1/marketplace/driving/rules?state=GA — W6 GA DDS rules.
//
// Serves the REAL `driving_rules` table (PENDING Unit P3) when applied.
// Until the migration lands (frozen by MD), serves the verified snapshot in
// src/lib/marketplace/driving-rules-seed.ts — the exact verified seed rows
// from PENDING-MIGRATIONS (dds.georgia.gov / flhsmv.gov, verified
// 2026-10-12), marked `from_snapshot: true`. Per-state from day one (MD D3);
// the response names its source either way. Never invented, never stale
// without a date: every rule carries rules_verified_at (BACKLOG R-007).

import { handleRoute } from "@/server/rest";
import { ApiError, ErrorCodes, failWith } from "@/server/errors";
import { createClient } from "@/lib/supabase/server";
import { DRIVING_RULES_SNAPSHOT } from "@/lib/marketplace/driving-rules-seed";

const CATEGORY_ORDER = ["permit", "supervised_hours", "provisional", "full_license"];

export const GET = handleRoute(async (_ctx, req) => {
  const state = (new URL(req.url).searchParams.get("state") ?? "GA").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) failWith(ErrorCodes.VALIDATION_FAILED);

  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("driving_rules")
      .select("state_code, rule_code, category, title, summary_md, min_age_years, source_name, source_url, rules_verified_at")
      .eq("state_code", state)
      .order("category");
    if (error) throw error;
    interface DbRule {
      state_code: string;
      rule_code: string;
      category: string;
      title: string;
      summary_md: string;
      min_age_years: number | null;
      source_name: string;
      source_url: string;
      rules_verified_at: string;
    }
    const rows = ((data ?? []) as unknown as DbRule[]).map((r) => ({
      ...r,
      from_snapshot: false,
    }));
    if (rows.length === 0) throw new Error("no_rows");
    return {
      state,
      source: "database" as const,
      rules: rows.sort(
        (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
      ),
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Table missing or empty → verified snapshot (honest, dated, sourced).
    const rules = DRIVING_RULES_SNAPSHOT.filter((r) => r.state_code === state);
    if (rules.length === 0) throw new ApiError(ErrorCodes.NOT_FOUND);
    return { state, source: "verified_snapshot" as const, rules };
  }
});
