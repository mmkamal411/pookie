import { InsuranceHub } from "@/components/insurance/insurance-hub";

// Household namespace — OUTSIDE /c/[childSlug]: insurance is per-household
// (owner_user_id-anchored). force-dynamic: session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Insurance · Pookie",
};

export default async function InsurancePage() {
  return <InsuranceHub />;
}
