import PageGlide from "@/components/page-glide";

/**
 * Family namespace layout — Prism E5 (2026-10-12).
 * Gives /family/* the same subtle page-glide transition as the rest of the
 * app (course-change feel). Pages keep their own Command Deck spacers.
 */
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <PageGlide>{children}</PageGlide>;
}
