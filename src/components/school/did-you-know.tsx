"use client";

import { useState } from "react";
import { PookieOrb } from "@/components/pookie-orb";
import { TRIVIA_FACTS, triviaForDate, type TriviaFact } from "@/lib/school/trivia";

/** "Did You Know?" — deterministic daily fact, shuffleable for another one. */
export function DidYouKnow({ fact }: { fact?: TriviaFact }) {
  const [current, setCurrent] = useState<TriviaFact>(() => fact ?? triviaForDate(new Date()));

  function shuffle() {
    setCurrent((prev) => {
      const pool = TRIVIA_FACTS.filter((f) => f.text !== prev.text);
      return pool[Math.floor(Math.random() * pool.length)] ?? prev;
    });
  }

  return (
    <section
      aria-label="Did you know"
      className="card-living animate-bloom overflow-hidden rounded-2xl border border-aurum-400/25"
      style={{ boxShadow: "0 0 18px rgb(251 191 36 / 0.10)" }}
    >
      <div className="flex items-start gap-3 px-5 py-4">
        <PookieOrb size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold tracking-[0.18em] text-aurum-300 capitalize">
              Did You Know?
            </p>
            <button
              type="button"
              onClick={shuffle}
              aria-label="Show another fact"
              className="rounded-full border border-aurum-400/30 px-3 py-1 text-xs font-medium text-aurum-300 transition hover:bg-aurum-400/10"
            >
              New Fact
            </button>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-star-100">{current.text}</p>
          <p className="mt-1.5 text-[11px] text-stardust-400">
            Source:{" "}
            {current.sourceUrl ? (
              <a
                href={current.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-nova-300 hover:underline"
              >
                {current.source} ↗
              </a>
            ) : (
              <span className="font-medium">{current.source}</span>
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
