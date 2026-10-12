"use client";

import { useState } from "react";
import type { StudySpark } from "@/lib/school/types";
import { ProvenanceLabel } from "./provenance-label";

const SKILL_LABELS: Record<string, string> = {
  "spaced-repetition": "Spaced repetition",
  "retrieval-practice": "Retrieval practice",
  interleaving: "Interleaving",
  elaboration: "Elaboration",
  "dual-coding": "Dual coding",
};

function sparkAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * Study Sparks — FR-SCHOOL-004.
 *
 * The renamed peer-tips surface. Load-bearing naming: "peer" on AI content is
 * fabricated social proof, so no spark ever claims a human peer wrote it.
 * Every card carries its provenance (AI-made label + origin + review status),
 * tappable for the full label. Sparks expire after 4 weeks.
 */
export function StudySparks({ sparks }: { sparks: StudySpark[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  // No live sparks → the section doesn't render at all (never a fake spark).
  if (sparks.length === 0) return null;

  return (
    <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-star-100">Study Sparks</h3>
        <ProvenanceLabel kind="app-generated" />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-stardust-300">
        Short study-skill ideas — made by Pookie AI, never by other students. Study
        techniques only: no grades, no gossip, no made-up social proof.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sparks.map((s) => {
          const open = openId === s.id;
          return (
            <div key={s.id} className="neon-pipe-violet rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-3">
              <p className="text-sm leading-relaxed text-star-100">{s.body}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-nova-400/30 px-2 py-0.5 text-[10px] font-medium text-nova-300">
                  {s.ai_label}
                </span>
                {s.study_skill_tags.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-stardust-500/25 px-2 py-0.5 text-[10px] text-stardust-300"
                  >
                    {SKILL_LABELS[t] ?? t}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : s.id)}
                  aria-expanded={open}
                  className="text-[10px] font-medium text-stardust-500 underline-offset-2 hover:text-nova-300 hover:underline"
                >
                  {open ? "Hide source ▴" : "Where's this from? ▾"}
                </button>
              </div>
              {open && (
                <div className="animate-rise mt-2 rounded-xl border border-nova-400/10 bg-nebula-900/60 px-3 py-2 text-[11px] leading-relaxed text-stardust-300">
                  <p>
                    Origin: {s.origin === "ai-synthesis" ? "AI synthesis (study-skill library)" : "Curriculum extraction"}
                  </p>
                  <p>
                    Sourcing: {s.deident_method === "aggregate-k5" ? "patterns across 5+ families, de-identified" : "curriculum documents only — never student data"}
                  </p>
                  <p>
                    Review: {s.review_status === "human-approved" ? "approved by a teacher" : s.review_status === "qa-sampled" ? "spot-checked in weekly QA" : "automatic checks"} ·{" "}
                    added {sparkAge(s.created_at)} · expires {new Date(s.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
