import { BabysittersBoard } from "@/components/home-money/babysitters-board";

// Marketplace namespace — the babysitter directory is per-household
// (owner_user_id-anchored); time-boxed grants ride on child access (D6).
// force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Babysitters · Pookie",
};

export default async function BabysittersPage() {
  return <BabysittersBoard />;
}
