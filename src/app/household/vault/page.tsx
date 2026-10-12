import { VaultBoard } from "@/components/home-money/vault-board";

// Household namespace — OUTSIDE /c/[childSlug]: the vault is per-household
// (owner_user_id-anchored), parent-only (Class S). force-dynamic:
// session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Money & Documents · Pookie",
};

export default async function VaultPage() {
  return <VaultBoard />;
}
