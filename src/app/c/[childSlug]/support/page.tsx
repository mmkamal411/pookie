import { notFound } from "next/navigation";
import { getSquad5Context } from "@/lib/squad5/context";
import { SupportHub } from "@/components/support/support-hub";

export const dynamic = "force-dynamic";

/** /c/[childSlug]/support — S1/S2/S3 Support hub (Squad 5). */
export default async function SupportPage({ params }: { params: Promise<{ childSlug: string }> }) {
  const { childSlug } = await params;
  const ctx = await getSquad5Context(childSlug);
  if (!ctx) notFound();
  return <SupportHub childSlug={childSlug} under13={ctx.band === "child"} />;
}
