// Applet server actions — thin wrappers so applet content (client
// components) can resolve the same server-side context the module pages
// used to resolve before rendering. "use server" files may only export
// async functions.

"use server";

import { getSquad5Context, type Squad5Context } from "@/lib/squad5/context";

/**
 * The Squad 5 viewer context for an applet: child id, role, server-side age
 * band, and the child's age. Null when the slug isn't in the viewer's
 * membership set (same contract as the module pages' notFound()).
 */
export async function getAppletSquad5(childSlug: string): Promise<Squad5Context | null> {
  return getSquad5Context(childSlug);
}
