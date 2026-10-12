// S1 FAQ section tree — 9 sections, collapsed by default, rendered from
// the DB (no hardcoded article bodies). Each row shows title + count; rows
// carry the ⚖️ marker when the article has a legal accordion.

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CollapseRow } from "@/components/ui";
import { ErrorCard, LoadingRows, api } from "@/components/travel/travel-shared";

interface TreeArticle {
  slug: string;
  title: string;
  has_legal: boolean;
}
interface TreeSection {
  key: string;
  title: string;
  articles: TreeArticle[];
}

export function FaqTree({ childSlug }: { childSlug: string }) {
  const [sections, setSections] = useState<TreeSection[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api<{ sections: TreeSection[] }>("/api/v1/support/faq/tree")
      .then((d) => setSections(d.sections))
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, []);

  if (error) {
    return (
      <ErrorCard
        message="The help center is having a moment — try searching above, or ask Pookie."
        onRetry={load}
      />
    );
  }
  if (!sections) return <LoadingRows rows={5} />;

  const total = sections.reduce((n, s) => n + s.articles.length, 0);

  return (
    <div className="space-y-2">
      {total === 0 && (
        <p className="rounded-xl border border-nova-400/15 bg-nebula-900/50 p-4 text-sm leading-relaxed text-stardust-300">
          The help center is being stocked with real answers right now. Meanwhile, ask Pookie
          (AI chat) or open a ticket — a human will help.
        </p>
      )}
      {sections.map((s) => (
        <CollapseRow
          key={s.key}
          title={s.title}
          meta={
            <span className="rounded-full bg-nebula-800 px-2 py-0.5 text-xs text-stardust-300">
              {s.articles.length}
            </span>
          }
        >
          {s.articles.length === 0 ? (
            <p className="text-[13px] text-stardust-400">No articles here yet — check back soon.</p>
          ) : (
            <ul className="space-y-1">
              {s.articles.map((a) => (
                <li key={a.slug}>
                  <Link
                    href={`/c/${childSlug}/support/faq/${a.slug}`}
                    className="neon-hover neon-teal flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-star-100 transition-colors hover:bg-nova-500/10"
                  >
                    <span>{a.title}</span>
                    {a.has_legal && (
                      <span aria-label="Has a legal explanation" title="Includes a plain-language legal explanation">
                        ⚖️
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CollapseRow>
      ))}
    </div>
  );
}
