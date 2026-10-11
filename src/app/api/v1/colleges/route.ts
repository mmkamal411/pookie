// GET /api/v1/colleges — the public college directory (explorer).
// Class-P reference data: anon/authenticated read at the RLS layer; this
// route needs no tenant. Stats arrive with as_of + source (never undated).
import { handleRoute } from "@/server/rest";
import { createClient } from "@/lib/supabase/server";
import { explorerQuerySchema, listColleges } from "@/server/services/college";

export const GET = handleRoute(async (_ctx, req) => {
  const supabase = await createClient();
  const sp = new URL(req.url).searchParams;
  const query = explorerQuerySchema.parse({
    region: sp.get("region") ?? undefined,
    control: sp.get("control") ?? undefined,
    search: sp.get("search") ?? undefined,
  });
  return listColleges(supabase, query);
});
