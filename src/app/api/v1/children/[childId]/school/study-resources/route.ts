// GET /api/v1/children/[childId]/school/study-resources?slug=apcsp — curated
// study topics for a class (overview, ebook, Khan, YouTube, cheat sheet,
// games, practice quiz). Static curated data; tenant asserted for scoping.
import { handleRoute, auditEvent } from "@/server/rest";
import { assertTenant } from "@/server/tenant";
import { CLASS_TOPICS, classMetaFor } from "@/lib/school/study-resources";

export const GET = handleRoute<{ childId: string }>(async (ctx, req) => {
  const tenant = await assertTenant(ctx.params.childId);
  const slug = (req.nextUrl.searchParams.get("slug") ?? "").toLowerCase().trim();
  const meta = slug ? classMetaFor(slug) : null;
  const topics = slug && CLASS_TOPICS[slug] ? CLASS_TOPICS[slug].topics : [];
  await auditEvent(tenant.childId, "school.study_resources.read", { slug });
  return { slug, meta, topics };
});
