import { isDemoRequest } from "@/lib/demo";

/**
 * Demo banner — shown on every page while in demo mode so mock data
 * is never mistaken for the real thing. Follows the design language:
 * sunlight warmth, soft glow, never harsh.
 */
export async function DemoBanner() {
  if (!(await isDemoRequest())) return null;
  return (
    <div
      role="note"
      className="animate-rise sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-aurum-400/30 bg-nebula-900/95 px-4 py-2 text-center shadow-sun-warm backdrop-blur"
    >
      <span aria-hidden="true">✨</span>
      <p className="text-xs font-medium tracking-wide text-aurum-200">
        Demo mode — you&apos;re seeing mock data, not real grades
      </p>
      <span aria-hidden="true">✨</span>
    </div>
  );
}
