"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PookieOrb } from "@/components/pookie-orb";
import { getPookieColor, subscribePookieColor } from "@/components/pookie/pookie-color";

/** The center orb — takes on the pinball's color when Pookie eats it. */
function ToolbarOrb() {
  const [color, setColor] = useState<string | null>(() => getPookieColor());

  useEffect(() => subscribePookieColor(setColor), []);

  return (
    <span
      className="orb-breathe relative rounded-full"
      style={color ? { filter: `drop-shadow(0 0 14px ${color})` } : undefined}
    >
      <PookieOrb size={56} />
      {color && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle at 50% 45%, ${color}55, transparent 70%)` }}
        />
      )}
    </span>
  );
}

/**
 * Bottom toolbar — exactly: Home · Today · Pookie (center orb) · Progress · More.
 * Fixed on every /c/[childSlug]/ page. The center orb opens the Pookie tab.
 */
export function ChildToolbar({ childSlug }: { childSlug: string }) {
  const pathname = usePathname();
  const base = `/c/${childSlug}`;

  const tabs = [
    { id: "home", label: "Home", href: base, active: pathname === base },
    { id: "today", label: "Today", href: `${base}/today`, active: pathname.startsWith(`${base}/today`) },
    { id: "pookie", label: "Pookie", href: `${base}/pookie`, active: pathname.startsWith(`${base}/pookie`), orb: true },
    { id: "progress", label: "Progress", href: `${base}/school`, active: pathname.startsWith(`${base}/school`) },
    {
      id: "more",
      label: "More",
      href: `${base}/more`,
      active: pathname.startsWith(`${base}/more`) || pathname.startsWith(`${base}/settings`),
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-nova-400/20"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "linear-gradient(180deg, rgb(20 20 50 / 0.55), rgb(5 5 16 / 0.82))",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 -8px 32px rgb(5 5 16 / 0.5), 0 -1px 0 rgb(244 114 182 / 0.12)",
      }}
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-2 pt-1.5 pb-1.5">
        {tabs.map((tab) =>
          tab.orb ? (
            <Link
              key={tab.id}
              href={tab.href}
              id="toolbar-pookie-orb"
              aria-label="Pookie — AI tutor"
              aria-current={tab.active ? "page" : undefined}
              className="-mt-7 flex flex-col items-center gap-0.5"
            >
              <span
                className={`rounded-full transition-transform hover:scale-105 ${tab.active ? "tab-active-glow" : ""}`}
                style={tab.active ? { filter: "drop-shadow(0 0 12px rgb(244 114 182 / 0.5))" } : undefined}
              >
                <ToolbarOrb />
              </span>
              <span
                className={`text-[11px] font-medium ${tab.active ? "text-nova-300" : "text-stardust-500"}`}
              >
                {tab.label}
              </span>
            </Link>
          ) : (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-2 transition-transform hover:scale-105 ${tab.active ? "tab-active-glow" : ""}`}
            >
              <span
                className={`h-1 w-8 rounded-full transition-colors ${tab.active ? "bg-nova-400 shadow-glow-sm" : "bg-transparent"}`}
                aria-hidden="true"
              />
              <span
                className={`text-[11px] font-medium ${tab.active ? "text-nova-300" : "text-stardust-500"}`}
              >
                {tab.label}
              </span>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}
