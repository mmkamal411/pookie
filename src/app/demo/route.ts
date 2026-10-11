import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { DEMO_COOKIE, isDemoDeploy } from "@/lib/demo";

/**
 * Demo entry point — sets the demo cookie and walks the visitor into
 * the app. Only works on deploys with NEXT_PUBLIC_DEMO_MODE=1;
 * everywhere else it bounces to /login.
 */
export async function GET() {
  if (!isDemoDeploy()) redirect("/login");
  const store = await cookies();
  store.set(DEMO_COOKIE, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
