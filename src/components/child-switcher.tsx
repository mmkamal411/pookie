"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/components/tenant-provider";
import { setActiveChild } from "@/lib/tenant/actions";
import { useTheme } from "@/components/use-theme";
import type { TenantMembership } from "@/lib/tenant/types";

function initials(name: string): string {
  return (name.trim().slice(0, 1) || "?").toUpperCase();
}

function ChildAvatar({
  child,
  size = 32,
  dark,
}: {
  child: TenantMembership["child"];
  size?: number;
  dark: boolean;
}) {
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
      className="flex items-center justify-center rounded-full border font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        borderColor: dark ? "rgb(0 229 255 / 0.35)" : "rgb(0 184 212 / 0.4)",
        background: dark ? "rgb(17 24 50 / 0.9)" : "rgb(234 242 246)",
        color: dark ? "rgb(232 240 254)" : "rgb(14 27 36)",
      }}
    >
      {initials(child.nickname ?? child.first_name ?? "?")}
    </span>
  );
}

/**
 * ChildRosterPanel — the crew-roster menu content: pick which child to
 * view, plus Add Child for parents. Rendered inside the Command Center
 * menu. Theme-aware (space black / bright bridge).
 *
 * Identity model (Mehedi 2026-10-12): the menu shows the LOGGED-IN USER
 * (the parent) in the pilot readout; this roster picks which child is
 * viewed. The child name never sits in top chrome.
 */
export function ChildRosterPanel({
  role = "parent",
  onDone,
}: {
  /** Tenant role of the logged-in user — children never see "Add Child". */
  role?: "parent" | "child";
  /** Called after a selection so the hosting menu can close. */
  onDone?: () => void;
}) {
  const { theme } = useTheme();
  const dark = theme !== "bright-bridge";
  const { memberships, activeChildId } = useTenant();
  const router = useRouter();
  const [switching, setSwitching] = useState(false);

  const active = memberships.find((m) => m.child_id === activeChildId) ?? memberships[0];

  async function select(m: TenantMembership) {
    if (m.child_id === activeChildId || switching) {
      onDone?.();
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
      onDone?.();
      router.push(`/c/${m.child.slug}`);
    } finally {
      setSwitching(false);
    }
  }

  function goToAddChild() {
    onDone?.();
    if (active) router.push(`/c/${active.child.slug}/settings`);
  }

  const line = dark ? "rgb(0 229 255 / 0.14)" : "rgb(0 184 212 / 0.2)";
  const label = dark ? "rgb(138 155 184)" : "rgb(74 96 112)";
  const text = dark ? "rgb(232 240 254)" : "rgb(14 27 36)";
  const sub = dark ? "rgb(138 155 184)" : "rgb(74 96 112)";
  const hover = dark ? "rgb(0 229 255 / 0.07)" : "rgb(0 184 212 / 0.07)";

  return (
    <section aria-label="Crew roster">
      <div className="px-4 pt-3 pb-1">
        <p
          className="font-mono text-[10px] font-semibold tracking-[0.22em] uppercase"
          style={{ color: dark ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212)" }}
        >
          Crew Roster
        </p>
        <p className="mt-1 text-xs" style={{ color: label }}>
          Select whose dashboard to view.
        </p>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">
        {memberships.map((m) => {
          const name = m.child.nickname ?? m.child.first_name;
          const detail = [m.child.grade_level ? `Grade ${m.child.grade_level}` : null, m.child.school_name]
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
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors disabled:opacity-60"
              style={{ color: text }}
              onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <ChildAvatar child={m.child} size={34} dark={dark} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{name}</span>
                {detail && (
                  <span className="block truncate text-xs" style={{ color: sub }}>
                    {detail}
                  </span>
                )}
              </span>
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="text-sm font-bold"
                  style={{ color: "#00FF88", textShadow: "0 0 10px rgb(0 255 136 / 0.6)" }}
                >
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="font-mono text-[10px] font-medium tracking-[0.18em] uppercase"
                  style={{ color: label }}
                >
                  View
                </span>
              )}
            </button>
          );
        })}
      </div>
      {role === "parent" && (
        <div style={{ borderTop: `1px solid ${line}` }}>
          <button
            type="button"
            onClick={goToAddChild}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors"
            style={{ color: text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed text-base"
              style={{
                borderColor: dark ? "rgb(0 229 255 / 0.4)" : "rgb(0 184 212 / 0.45)",
                color: dark ? "rgb(0 229 255)" : "rgb(0 184 212)",
              }}
            >
              +
            </span>
            <span className="text-sm font-medium">Add Child</span>
          </button>
        </div>
      )}
    </section>
  );
}
