// BackButton — the single consistent back affordance across Pookie.
// Sits at the top-left of every sub-page: a quiet pill with a soft neon
// arrow that brightens on hover, and a visible pressed state.
//
// Behavior: goes back through history when there is history to go back
// through; otherwise routes to `fallback` (default "/") so the button
// never dead-ends.
//
// Props:
//   label    — visible label (default "Back")
//   fallback — destination when history is too short (default "/")
//   className — extra classes

"use client";

import { useRouter } from "next/navigation";

export function BackButton({
  label = "Back",
  fallback = "/",
  className = "",
}: {
  label?: string;
  fallback?: string;
  className?: string;
}) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      className={`neon-hover neon-teal neon-focus neon-active group inline-flex items-center gap-1.5 rounded-full border border-nova-400/25 bg-nebula-900/60 px-3.5 py-1.5 text-xs font-semibold text-stardust-300 transition-all hover:border-nova-300/60 hover:text-nova-200 active:scale-95 ${className}`}
    >
      <span
        aria-hidden="true"
        className="text-sm leading-none text-nova-300 transition-transform group-hover:-translate-x-0.5 group-hover:drop-shadow-[0_0_6px_rgb(244_114_182/0.8)]"
      >
        ←
      </span>
      {label}
    </button>
  );
}
