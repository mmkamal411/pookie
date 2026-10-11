import { ShoppingBoard } from "@/components/shopping/shopping-board";
import { getDemoShoppingData } from "@/lib/shopping-demo";
import { isDemoRequest } from "@/lib/demo";

// Household namespace — OUTSIDE /c/[childSlug]: the list is per-household
// (owner_user_id-anchored), not per-child. force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family shopping list · Pookie",
};

export default async function ShoppingPage() {
  if (await isDemoRequest()) {
    return <ShoppingBoard demo={getDemoShoppingData()} />;
  }
  return <ShoppingBoard />;
}
