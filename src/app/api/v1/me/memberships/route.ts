// GET /api/v1/me/memberships — the caller's child-access memberships.
// Powers the Crew hub applet (client component): crew list, per-child
// consoles, add-child door. Uses the same getMemberships() source of truth
// as the server pages — never throws, [] when signed out.
import { handleRoute } from "@/server/rest";
import { getMemberships } from "@/lib/tenant/actions";

export const GET = handleRoute(async () => {
  const memberships = await getMemberships();
  return memberships.map((m) => ({
    child_id: m.child_id,
    role: m.role,
    child: {
      id: m.child.id,
      slug: m.child.slug,
      first_name: m.child.first_name,
      nickname: m.child.nickname,
      avatar_url: m.child.avatar_url,
      school_name: m.child.school_name,
      grade_level: m.child.grade_level,
    },
  }));
});
