import { redirect } from "next/navigation";

// Reads the session — always renders at request time.
export const dynamic = "force-dynamic";

/**
 * /select-child — RETIRED as a page (user-first, Mehedi 2026-10-12).
 *
 * The old root router sent N-membership parents here to pick a child before
 * seeing anything of their own. Now every signed-in user lands on their own
 * bridge (/me) and the crew roster lives in the Crew section there. Any
 * lingering link to this path lands on /me instead of 404ing.
 */
export default async function SelectChildPage() {
  redirect("/me");
}
