import { ShoppingBoard } from "@/components/shopping/shopping-board";
import { getDemoShoppingData } from "@/lib/shopping-demo";
import { shouldShowDemo } from "@/lib/demo";
import { createClient } from "@/lib/supabase/server";

// Household namespace — OUTSIDE /c/[childSlug]: the list is per-household
// (owner_user_id-anchored), not per-child. force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family shopping list · Pookie",
};

export default async function ShoppingPage() {
  // Real sessions always win over a stale demo cookie.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (await shouldShowDemo(user)) {
    return <ShoppingBoard demo={getDemoShoppingData()} />;
  }
  return <ShoppingBoard />;
}
