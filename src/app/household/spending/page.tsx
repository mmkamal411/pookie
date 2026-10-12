import { SpendingBoard } from "@/components/home-money/spending-board";

// Household namespace — OUTSIDE /c/[childSlug]: spending is per-household
// (owner_user_id-anchored). Teen vs parent views are decided server-side by
// RLS (teen-private line items are zero-row for parents). force-dynamic:
// session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Spending · Pookie",
};

export default async function SpendingPage() {
  return <SpendingBoard />;
}
