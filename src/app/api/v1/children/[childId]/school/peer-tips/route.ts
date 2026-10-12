// GET /api/v1/children/[childId]/school/peer-tips?slug=apcsp — the "98%
// playbook" rotating weekly peer tips. Graceful when the peer_tips table
// doesn't exist yet: returns tips:[] with available:false.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { createClient } from "@/lib/supabase/server";

export interface PeerTipRow {
  tipText: string;
  tipAuthor: string;
  topic: string | null;
}

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").toLowerCase().trim();

  let tips: PeerTipRow[] = [];
  let available = true;

  if (slug) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("peer_tips")
        .select("tip_text, tip_author, topic, week_start")
        .eq("class_slug", slug)
        .eq("is_active", true)
        .order("week_start", { ascending: false })
        .limit(20);
      if (error) throw error;
      tips = ((data ?? []) as Array<{ tip_text: string; tip_author: string | null; topic: string | null }>)
        .filter((r) => r.tip_text && r.tip_text.trim().length > 0)
        .map((r) => ({
          tipText: r.tip_text,
          tipAuthor: r.tip_author ?? "Senior who aced this class",
          topic: r.topic,
        }));
    } catch {
      available = false;
    }
  }

  await auditEvent(tenant.childId, "school.peer_tips.read", { slug });
  return { slug, available, tips };
});
