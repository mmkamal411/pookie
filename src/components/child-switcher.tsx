"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/tenant-provider";
import { setActiveChild } from "@/lib/tenant/actions";
import type { TenantMembership } from "@/lib/tenant/types";

function initials(name: string): string {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
}

function ChildAvatar({ child, size = 32, pulse = false }: { child: TenantMembership["child"]; size?: number; pulse?: boolean }) {
  if (child.avatar_url) {
    // User-provided external avatar — next/image would need remote config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={child.avatar_url}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover ${pulse ? "avatar-pulse" : ""}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center rounded-full border border-nova-400/30 bg-nebula-700 text-nova-300 ${pulse ? "avatar-pulse" : ""}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initials(child.nickname ?? child.first_name ?? "?")}
    </span>
  );
}

/**
 * Crew cluster trigger — the header's crew + ship-controls instrument.
 *
 * Identity model (Mehedi 2026-10-12): the header shows the LOGGED-IN USER
 * (the parent), never the child. The trigger is the parent's pilot readout;
 * tapping it docks the crew-roster module to pick which child to view.
 * Selecting a child persists via setActiveChild and navigates to /c/[slug].
 */
export function ChildSwitcher({
  parentName,
  role = "parent",
}: {
  parentName: string;
  /** Tenant role of the logged-in user on the active child — children never see "Add child". */
  role?: "parent" | "child";
}) {
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
  }, [open]);

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

  function goToAddChild() {
    setOpen(false);
    if (active) router.push(`/c/${active.child.slug}/settings`);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${parentName} — select child to view`}
        className="console-tab-btn flex min-h-[44px] items-center gap-2.5 rounded-full py-1.5 pr-2 pl-1.5"
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-nova-400/40 bg-nebula-700 text-sm font-semibold text-nova-200"
          style={{ boxShadow: "0 0 12px rgb(244 114 182 / 0.3), inset 0 0 8px rgb(244 114 182 / 0.12)" }}
        >
          {initials(parentName)}
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="callsign-name max-w-28 truncate text-sm font-semibold">{parentName}</span>
          <span className="mt-1 flex items-center gap-1.5 text-[9px] font-medium tracking-[0.2em] text-stardust-500 capitalize">
            <span
              aria-hidden="true"
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300"
              style={{ boxShadow: "0 0 6px rgb(110 231 183 / 0.9)" }}
            />
            Aboard
          </span>
        </span>
        {memberships.length > 1 && (
          <span
            aria-hidden="true"
            className={`text-xs text-nova-300 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Select child to view"
          className="module-dock-panel animate-rise absolute top-full right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl bg-nebula-900/95 backdrop-blur"
        >
          <div className="border-b border-nova-400/10 px-4 pt-3 pb-2.5">
            <p className="module-dock-eyebrow">
              <span className="module-dock-dot" aria-hidden="true" />
              Crew roster
            </p>
            <p className="mt-1 text-xs text-stardust-400">Select whose dashboard to view.</p>
          </div>
          <div className="max-h-72 overflow-y-auto py-1.5">
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
                  onClick={() => void select(m)}
                  disabled={switching}
                  aria-current={isActive || undefined}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nebula-800/60 disabled:opacity-60"
                >
                  <ChildAvatar child={m.child} size={36} pulse={isActive} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-star-100">{name}</span>
                    {sub && <span className="block truncate text-xs text-stardust-400">{sub}</span>}
                  </span>
                  {isActive ? (
                    <span
                      aria-hidden="true"
                      className="text-sm font-bold text-nova-400"
                      style={{ textShadow: "0 0 10px rgb(244 114 182 / 0.6)" }}
                    >
                      ✓
                    </span>
                  ) : (
                    <span aria-hidden="true" className="text-[10px] font-medium tracking-[0.18em] text-stardust-500 capitalize">
                      View
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {role === "parent" && (
            <div className="border-t border-nova-400/10">
              <button
                type="button"
                onClick={goToAddChild}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-nebula-800/60"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-dashed border-nova-400/40 text-lg text-nova-300"
                >
                  +
                </span>
                <span className="text-sm font-medium text-nova-300">Add child</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
