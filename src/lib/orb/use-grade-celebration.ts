"use client";

import { useEffect, useRef } from "react";
import { orbCelebrate } from "@/lib/orb/orb-events";
import type { ClassOverview } from "@/lib/school/types";

const SNAPSHOT_KEY = "pookie-grade-snapshot-v1";

/**
 * useGradeCelebration — the orb celebrates when a grade rises.
 *
 * Squad Oracle (2026-10-12): snapshots class grades in localStorage.
 * On each new overview render, compares: any class whose numeric grade
 * increased since the snapshot triggers orbCelebrate(). The snapshot
 * refreshes every time so a single rise celebrates exactly once.
 */
export function useGradeCelebration(classes: ClassOverview[]) {
  const celebrated = useRef(false);

  useEffect(() => {
    if (celebrated.current || classes.length === 0) return;
    celebrated.current = true;
    let prev: Record<string, number> = {};
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_KEY);
      if (raw) prev = JSON.parse(raw) as Record<string, number>;
    } catch {
      prev = {};
    }
    const next: Record<string, number> = {};
    const risers: string[] = [];
    for (const c of classes) {
      if (c.numeric == null) continue;
      next[c.class_id] = c.numeric;
      const old = prev[c.class_id];
      if (typeof old === "number" && c.numeric > old) {
        risers.push(c.display_name ?? c.name);
      }
    }
    try {
      window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(next));
    } catch {
      /* storage full — celebration is best-effort */
    }
    if (risers.length > 0) {
      const label =
        risers.length === 1
          ? risers[0]
          : `${risers.length} classes`;
      orbCelebrate(`${label} climbing — grade up`);
    }
  }, [classes]);
}
