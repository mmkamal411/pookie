import { MentorOverview } from "@/components/village/mentor-overview";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The crew · Pookie",
};

export default async function VillageChildPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  return <MentorOverview childId={childId} />;
}
