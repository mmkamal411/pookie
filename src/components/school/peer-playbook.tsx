"use client";

import { useEffect, useState } from "react";

interface Tip {
  tipText: string;
  tipAuthor: string;
  topic: string | null;
}

/**
 * 98% Playbook — rotating weekly peer tips for the class. Peer-voiced,
 * brutally practical. Graceful: renders nothing while loading; an
 * awaiting-tips state when the library is empty.
 */
export function PeerPlaybook({
  childId,
  slug,
  weakTopics = [],
}: {
  childId: string;
  slug: string | null;
  weakTopics?: string[];
}) {
  const [tip, setTip] = useState<Tip | null>(null);
  const [index, setIndex] = useState(0);
  const [tips, setTips] = useState<Tip[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setLoaded(true);
        return;
      }
      try {
        const res = await fetch(`/api/v1/children/${childId}/school/peer-tips?slug=${slug}`);
        if (!res.ok) throw new Error("tips_failed");
        const json = (await res.json()) as { data: { tips: Tip[] } };
        if (cancelled) return;
        const all = json.data.tips ?? [];
        // Prefer a tip matching a weak topic (the student's actual leaks).
        const weak = weakTopics.map((w) => w.toLowerCase().trim()).filter(Boolean);
        const matched = weak.length > 0
          ? all.filter((t) => t.topic && weak.some((w) => t.topic!.toLowerCase().includes(w) || w.includes(t.topic!.toLowerCase())))
          : [];
        const ordered = [...matched, ...all.filter((t) => !matched.includes(t))];
        setTips(ordered);
        setTip(ordered[0] ?? null);
      } catch {
        // tips are a bonus, never a blocker
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, slug, weakTopics]);

  if (!loaded) {
    return <div className="h-24 animate-pulse rounded-2xl border border-nova-400/10 bg-nebula-900/60" aria-label="Loading peer tips" />;
  }
  if (!tip) {
    return (
      <div className="rounded-2xl border border-nova-400/10 bg-nebula-900/60 px-5 py-4">
        <p className="text-sm font-semibold text-star-100">98% Playbook</p>
        <p className="mt-1 text-xs leading-relaxed text-stardust-300">
          Peer tips for this class are being written — the seniors who aced it are sharing their playbook soon.
        </p>
      </div>
    );
  }

  function next() {
    if (tips.length <= 1) return;
    const n = (index + 1) % tips.length;
    setIndex(n);
    setTip(tips[n]);
  }

  return (
    <div
      className="card-living rounded-2xl border border-aurum-400/25 px-5 py-4"
      style={{ boxShadow: "0 0 16px rgb(251 191 36 / 0.08)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-star-100">
          <span aria-hidden="true">💡</span> 98% Playbook
          {tip.topic && (
            <span className="rounded-full bg-aurum-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-aurum-300 capitalize">
              {tip.topic}
            </span>
          )}
        </h3>
        {tips.length > 1 && (
          <button
            type="button"
            onClick={next}
            className="rounded-full border border-aurum-400/30 px-3 py-1 text-xs font-medium text-aurum-300 transition hover:bg-aurum-400/10"
          >
            Next Tip
          </button>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-star-100">{tip.tipText}</p>
      <p className="mt-2 text-xs text-stardust-400">— {tip.tipAuthor}, senior who aced this class</p>
    </div>
  );
}
