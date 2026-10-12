import PageGlide from "@/components/page-glide";

/**
 * Village (mentor) namespace layout — Prism E5 (2026-10-12).
 * Gives /village/* the same subtle page-glide transition as the rest of the
 * app (course-change feel). Pages keep their own Command Deck spacers.
 */
export default function VillageLayout({ children }: { children: React.ReactNode }) {
  return <PageGlide>{children}</PageGlide>;
}
