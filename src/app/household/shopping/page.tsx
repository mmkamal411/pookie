import { ShoppingBoard } from "@/components/shopping/shopping-board";

// Household namespace — OUTSIDE /c/[childSlug]: the list is per-household
// (owner_user_id-anchored), not per-child. force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Family shopping list · Pookie",
};

export default async function ShoppingPage() {
  return <ShoppingBoard />;
}
