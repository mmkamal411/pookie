// useViewerProfile — who is looking at the menu right now.
//
// Reads the viewer's role from the tenant membership (parent vs the child
// themselves) and their age from a client override. Phase 0: the backend has
// not yet shipped an age endpoint, so age comes from localStorage
// (`pookie.viewer.age`, set when known); when absent it resolves null and
// menu-access.ts applies its documented defaults (parent = adult,
// child-of-unknown-age = assumed 15).
//
// The API layer enforces real access server-side — this hook only drives
// menu presentation.

"use client";

import { useMemo } from "react";
import { useTenant } from "@/components/tenant-provider";
import type { ViewerProfile } from "@/lib/menu-access";

const AGE_KEY = "pookie.viewer.age";

function readViewerAge(): number | null {
  try {
    const raw = window.localStorage.getItem(AGE_KEY);
    if (!raw) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 && n < 120 ? n : null;
  } catch {
    return null;
  }
}

export function useViewerProfile(): ViewerProfile {
  const { memberships, activeChildId } = useTenant();

  return useMemo<ViewerProfile>(() => {
    const membership = memberships.find((m) => m.child_id === activeChildId);
    const role = membership?.role ?? "parent"; // safe default: most restrictive for parents
    const age = typeof window === "undefined" ? null : readViewerAge();
    return { role, age };
  }, [memberships, activeChildId]);
}
