import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_COOKIE } from "@/lib/demo";
import { ACTIVE_CHILD_COOKIE } from "@/lib/tenant/types";

/**
 * Exit demo mode — clears the demo cookie and active-child cookie,
 * then sends the visitor to /login. Use this to switch from demo
 * to a real account without manually clearing browser cookies.
 */
export async function GET() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  store.delete(ACTIVE_CHILD_COOKIE);
  redirect("/login");
}
