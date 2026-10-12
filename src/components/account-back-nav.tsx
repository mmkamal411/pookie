import Link from "next/link";

/**
 * AccountBackNav — Prism E5 (2026-10-12).
 * Account-level pages (/village/*, /family/*) sit outside the tenant scope,
 * so the Command Deck shows only the tab-less standby console. Without this,
 * the only way back to the app was the browser back button — worst on
 * PWA/mobile where browser chrome is hidden. "/" routes every signed-in
 * user to their correct home (tenant dashboard or /me).
 */
export function AccountBackNav({ label = "Back to Ship" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-4">
      <Link
        href="/"
        className="inline-block text-sm font-medium text-nova-300 transition-all hover:text-nova-200"
        style={{ textShadow: "0 0 10px rgb(0 229 255 / 0.35)" }}
      >
        ← {label}
      </Link>
    </div>
  );
}
