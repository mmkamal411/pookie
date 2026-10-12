"use client";

import { useEffect, useState } from "react";
import type { StudyTopic } from "@/lib/school/study-resources";

function typeIcon(t: string): string {
  switch (t) {
    case "khan": return "🎓";
    case "youtube": return "▶️";
    case "ebook": return "📕";
    case "game": return "🎮";
    case "quiz": return "❓";
    case "cheatsheet": return "📋";
    case "clever": return "✨";
    case "article": return "📰";
    default: return "🔗";
  }
}

function typeLabel(t: string): string {
  switch (t) {
    case "khan": return "Khan Academy";
    case "youtube": return "YouTube";
    case "ebook": return "Ebook";
    case "game": return "Game";
    case "quiz": return "Quiz";
    case "cheatsheet": return "Cheat Sheet";
    case "clever": return "Clever";
    case "article": return "Article";
    default: return "Link";
  }
}

/**
 * Study Resources — curated per-topic hub: overview, ebook, Khan Academy,
 * YouTube, cheat sheet, games, and a practice-quiz button. All collapsible.
 */
export function StudyResources({
  childId,
  slug,
}: {
  childId: string;
  slug: string | null;
}) {
  const [topics, setTopics] = useState<StudyTopic[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`/api/v1/children/${childId}/school/study-resources?slug=${slug}`);
        if (!res.ok) throw new Error("resources_failed");
        const json = (await res.json()) as { data: { topics: StudyTopic[] } };
        if (!cancelled) setTopics(json.data.topics ?? []);
      } catch {
        // curated data missing — section renders the empty state
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, slug]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (!loaded) {
    return <div className="h-24 animate-pulse rounded-2xl border border-nova-400/10 bg-nebula-900/60" aria-label="Loading study resources" />;
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-2xl border border-nova-400/10 bg-nebula-900/60 px-5 py-6 text-center">
        <p className="text-2xl" aria-hidden="true">🧭</p>
        <p className="mt-2 text-sm text-stardust-300">
          Curated study resources for this class are on the way — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {topics.map((topic, ti) => {
        const videos = topic.resources.filter((r) => r.type === "youtube");
        const khans = topic.resources.filter((r) => r.type === "khan");
        const others = topic.resources.filter((r) => r.type !== "youtube" && r.type !== "khan");
        const key = (suffix: string) => `${ti}-${suffix}`;
        return (
          <div key={ti} className="space-y-2.5">
            {/* Topic overview — always visible */}
            <div className="rounded-2xl border border-nova-400/15 bg-nebula-900/60 px-5 py-4">
              <h3 className="text-sm font-bold text-star-100">{topic.name}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stardust-200">{topic.overview}</p>
            </div>

            {topic.ebook && (
              <a
                href={topic.ebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-3 transition hover:border-nova-400/30"
              >
                <span aria-hidden="true">📕</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-star-100">Ebook</span>
                  <span className="block truncate text-xs text-stardust-300">{topic.ebook.title}</span>
                </span>
                <span className="shrink-0 text-nova-300" aria-hidden="true">↗</span>
              </a>
            )}

            {khans.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
                <button
                  type="button"
                  onClick={() => toggle(key("khan"))}
                  aria-expanded={!!open[key("khan")]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span aria-hidden="true">🎓</span>
                  <span className="flex-1 text-sm font-semibold text-star-100">Khan Academy ({khans.length})</span>
                  <span aria-hidden="true" className={`text-stardust-400 transition-transform ${open[key("khan")] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open[key("khan")] && (
                  <div className="space-y-1.5 border-t border-nova-400/10 p-3">
                    {khans.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5 transition hover:border-nova-400/30">
                        <span className="mt-0.5 shrink-0" aria-hidden="true">🎓</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-star-100">{r.title}</span>
                          {r.description && <span className="mt-0.5 block text-xs text-stardust-400 line-clamp-2">{r.description}</span>}
                        </span>
                        <span className="shrink-0 text-nova-300" aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {videos.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
                <button
                  type="button"
                  onClick={() => toggle(key("yt"))}
                  aria-expanded={!!open[key("yt")]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span aria-hidden="true">▶️</span>
                  <span className="flex-1 text-sm font-semibold text-star-100">YouTube Videos ({videos.length})</span>
                  <span aria-hidden="true" className={`text-stardust-400 transition-transform ${open[key("yt")] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open[key("yt")] && (
                  <div className="space-y-1.5 border-t border-nova-400/10 p-3">
                    {videos.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5 transition hover:border-nova-400/30">
                        <span className="mt-0.5 shrink-0" aria-hidden="true">▶️</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-star-100">{r.title}</span>
                          {r.description && <span className="mt-0.5 block text-xs text-stardust-400 line-clamp-2">{r.description}</span>}
                        </span>
                        <span className="shrink-0 text-nova-300" aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {others.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
                <button
                  type="button"
                  onClick={() => toggle(key("more"))}
                  aria-expanded={!!open[key("more")]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span aria-hidden="true">🔗</span>
                  <span className="flex-1 text-sm font-semibold text-star-100">More Resources ({others.length})</span>
                  <span aria-hidden="true" className={`text-stardust-400 transition-transform ${open[key("more")] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open[key("more")] && (
                  <div className="space-y-1.5 border-t border-nova-400/10 p-3">
                    {others.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5 transition hover:border-nova-400/30">
                        <span className="mt-0.5 shrink-0" aria-hidden="true">{typeIcon(r.type)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-star-100">{r.title}</span>
                          <span className="text-[11px] text-stardust-400">{typeLabel(r.type)}</span>
                          {r.description && <span className="mt-0.5 block text-xs text-stardust-400 line-clamp-2">{r.description}</span>}
                        </span>
                        <span className="shrink-0 text-nova-300" aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {topic.cheatsheet && (
              <div className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
                <button
                  type="button"
                  onClick={() => toggle(key("cheat"))}
                  aria-expanded={!!open[key("cheat")]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span aria-hidden="true">📋</span>
                  <span className="flex-1 text-sm font-semibold text-star-100">Cheat Sheet</span>
                  <span aria-hidden="true" className={`text-stardust-400 transition-transform ${open[key("cheat")] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open[key("cheat")] && (
                  <div className="border-t border-nova-400/10 p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stardust-200">{topic.cheatsheet}</pre>
                  </div>
                )}
              </div>
            )}

            {topic.games && topic.games.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
                <button
                  type="button"
                  onClick={() => toggle(key("games"))}
                  aria-expanded={!!open[key("games")]}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left"
                >
                  <span aria-hidden="true">🎮</span>
                  <span className="flex-1 text-sm font-semibold text-star-100">Games ({topic.games.length})</span>
                  <span aria-hidden="true" className={`text-stardust-400 transition-transform ${open[key("games")] ? "rotate-180" : ""}`}>▾</span>
                </button>
                {open[key("games")] && (
                  <div className="space-y-1.5 border-t border-nova-400/10 p-3">
                    {topic.games.map((g, i) => (
                      <a key={i} href={g.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5 transition hover:border-nova-400/30">
                        <span className="mt-0.5 shrink-0" aria-hidden="true">🎮</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-star-100">{g.name}</span>
                          <span className="mt-0.5 block text-xs text-stardust-400">{g.description}</span>
                        </span>
                        <span className="shrink-0 text-nova-300" aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {topic.quizUrl && (
              <a
                href={topic.quizUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-dapple flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-nebula-950 transition-transform hover:scale-[1.01]"
              >
                ❓ Take Practice Quiz
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
