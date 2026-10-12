import { MailBoard } from "@/components/home-money/mail-board";

// Household namespace — OUTSIDE /c/[childSlug]: mail is per-household
// (owner_user_id-anchored), parent-only (Class S). force-dynamic:
// session-dependent.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mail · Pookie",
};

export default async function MailPage() {
  return <MailBoard />;
}
