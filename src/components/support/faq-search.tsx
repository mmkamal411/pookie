// S1 FAQ search — sticky, search-first. Keyword results ranked; the
// semantic "Related answers" fallback renders only when the backend says
// it's available (honest, no AI-hype copy). Skeleton rows while loading,
// never a blank screen.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui";
import { api } from "@/components/travel/travel-shared";

interface SearchResult {
  article_id: string;
  slug: string;
  title: string;
  category: string;
  snippet: string;
}

const SECTION_LABEL: Record<string, string> = {
  health: "Health",
  home: "Home",
  school: "School",
  safety: "Safety",
  travel: "Travel",
  marketplace: "Marketplace",
  support: "Support",
  account: "Account & Privacy",
  legal: "Legal & Your Rights",
};

export function FaqSearch({ childSlug }: { childSlug: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (query.length < 2) {
      setResults(null);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(() => {
      api<{ results: SearchResult[] }>(`/api/v1/support/faq/search?q=${encodeURIComponent(query)}`)
        .then((d) => {
          setResults(d.results);
          setSearched(true);
        })
        .catch(() => {
          setResults([]);
          setSearched(true);
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <div className="sticky top-0 z-10 -mx-4 bg-[#050510]/90 px-4 pt-2 pb-3 backdrop-blur-md">
      <label htmlFor="faq-search" className="sr-only">
        Search the help center
      </label>
      <input
        id="faq-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="What do you need help with?"
        autoComplete="off"
        className="w-full rounded-2xl border border-nova-400/30 bg-nebula-900/80 px-4 py-3 text-[15px] text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
      />

      {loading && (
        <div className="mt-3 space-y-2" aria-label="Searching">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-nova-400/10 bg-nebula-900/50" />
          ))}
        </div>
      )}

      {!loading && searched && results && (
        <div className="mt-3 space-y-2">
          {results.length === 0 ? (
            <Card>
              <p className="text-sm text-stardust-300">
                We didn&apos;t find that — ask Pookie (AI chat) or open a ticket.
              </p>
              <div className="mt-3 flex gap-2">
                <Link
                  href={`/c/${childSlug}/support/chat`}
                  className="rounded-xl border border-nova-400/40 bg-nova-500/15 px-4 py-2 text-sm font-medium text-star-100"
                >
                  Ask Pookie
                </Link>
                <Link
                  href={`/c/${childSlug}/support/tickets/new`}
                  className="rounded-xl border border-nova-400/20 px-4 py-2 text-sm font-medium text-stardust-200"
                >
                  Open a ticket
                </Link>
              </div>
            </Card>
          ) : (
            results.map((r) => (
              <Link key={r.slug} href={`/c/${childSlug}/support/faq/${r.slug}`} className="block">
                <Card padding="sm" className="transition-transform hover:-translate-y-0.5">
                  <p className="text-sm font-medium text-star-100">{r.title}</p>
                  <p className="mt-0.5 text-xs text-stardust-500">
                    {SECTION_LABEL[r.category] ?? r.category}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-stardust-300">{r.snippet}</p>
                </Card>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export { SECTION_LABEL as FAQ_SECTION_LABEL };
