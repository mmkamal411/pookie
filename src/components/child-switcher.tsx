"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/tenant-provider";
import { setActiveChild } from "@/lib/tenant/actions";
import type { TenantMembership } from "@/lib/tenant/types";

function initials(child: TenantMembership["child"]): string {
  const name = child.nickname ?? child.first_name ?? "?";
  return name.slice(0, 1).toUpperCase();
}

function ChildAvatar({ child, size = 32 }: { child: TenantMembership["child"]; size?: number }) {
  if (child.avatar_url) {
    // User-provided external avatar — next/image would need remote config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={child.avatar_url}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-full border border-nova-400/30 bg-nebula-700 text-nova-300"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(child)}
    </span>
  );
}

/**
 * Child switcher — header control on every /c/[childSlug]/ page.
 * Shows the active child's avatar + name; tap opens the roster dropdown.
 * Hidden entirely when there is only one child (no useless control).
 * Selecting a child persists via setActiveChild and navigates to /c/[slug].
 */
export function ChildSwitcher() {
  const { memberships, activeChildId } = useTenant();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const active = memberships.find((m) => m.child_id === activeChildId) ?? memberships[0];

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  if (memberships.length <= 1 || !active) return null;

  async function select(m: TenantMembership) {
    if (m.child_id === activeChildId || switching) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await setActiveChild(m.child_id);
      try {
        window.localStorage.setItem("pookie-active-child", m.child_id);
      } catch {
        /* persistence is best-effort — the cookie is the source of truth */
      }
      setOpen(false);
      router.push(`/c/${m.child.slug}`);
    } finally {
      setSwitching(false);
    }
  }

  const activeName = active.child.nickname ?? active.child.first_name;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch child — currently ${activeName}`}
        className="flex items-center gap-2.5 rounded-full border border-nova-400/20 bg-nebula-900/70 py-1.5 pr-3 pl-1.5 backdrop-blur transition-colors hover:border-nova-400/40"
      >
        <ChildAvatar child={active.child} size={30} />
        <span className="max-w-28 truncate text-sm font-medium text-star-100">{activeName}</span>
        <span
          aria-hidden="true"
          className={`text-xs text-nova-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Children"
          className="animate-rise absolute top-full left-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-nova-400/20 bg-nebula-900/95 shadow-glow-md backdrop-blur"
        >
          {memberships.map((m) => {
            const name = m.child.nickname ?? m.child.first_name;
            const sub = [m.child.grade_level ? `Grade ${m.child.grade_level}` : null, m.child.school_name]
              .filter(Boolean)
              .join(" · ");
            const isActive = m.child_id === activeChildId;
            return (
              <button
                key={m.child_id}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => void select(m)}
                disabled={switching}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nebula-800/60 disabled:opacity-60"
              >
                <ChildAvatar child={m.child} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-star-100">{name}</span>
                  {sub && <span className="block truncate text-xs text-stardust-300">{sub}</span>}
                </span>
                {isActive && (
                  <span aria-hidden="true" className="text-sm font-bold text-nova-400">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
