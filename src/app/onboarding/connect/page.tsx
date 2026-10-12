import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClaimFlow } from "./claim-flow";

export const dynamic = "force-dynamic";

/**
 * /onboarding/connect — "Connect to my family" (FR-AUTH-011, D5 open signup).
 *
 * Verified sign-in gate: no session → /login with return. The claim form is
 * fully functional in v1 — no "ask Parent A" dead end.
 */
export default async function ConnectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding/connect");

  return <ClaimFlow userEmail={user.email ?? ""} />;
}
