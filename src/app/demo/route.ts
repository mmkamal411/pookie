import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_CHILD_ID, DEMO_COOKIE, isDemoDeploy } from "@/lib/demo";
import { ACTIVE_CHILD_COOKIE } from "@/lib/tenant/types";

/**
 * Demo entry point — sets the demo cookie AND the active-child cookie,
 * then walks the visitor straight into the demo dashboard.
 * Only works on deploys with NEXT_PUBLIC_DEMO_MODE=1; everywhere else
 * it bounces to /login.
 *
 * Cookies are set here (a Route Handler) because cookies().set() throws
 * in Server Components in the edge runtime.
 */
export async function GET() {
  if (!isDemoDeploy()) redirect("/login");
  const store = await cookies();
  const opts = {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
  store.set(DEMO_COOKIE, "1", opts);
  store.set(ACTIVE_CHILD_COOKIE, DEMO_CHILD_ID, { ...opts, httpOnly: true });
  redirect("/c/dawson");
}
