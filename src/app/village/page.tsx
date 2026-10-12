"use client";

/** Squad Village — the mentor's roster: every child they're helping. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "@/components/home-money/shared";

async function api<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" } });
  const json = await res.json();
  if (!json.ok)
    throw new ApiError(json.error?.code ?? "INTERNAL", json.error?.message ?? "Hold position.");
  return json.data as T;
}

interface Mentorship {
  child_id: string;
  first_name: string;
  nickname: string | null;
  relationship: string;
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  sibling: "Sibling",
  uncle: "Uncle",
  aunt: "Aunt",
  grandparent: "Grandparent",
  tutor: "Tutor",
  coach: "Coach",
  other: "Mentor",
};

export default function VillagePage() {
  const [roster, setRoster] = useState<Mentorship[] | null>(null);

  useEffect(() => {
    api<Mentorship[]>("/api/v1/village/mentorships")
      .then(setRoster)
      .catch(() => setRoster([]));
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-8">
      {/* Prism E5 2026-10-12: back-to-app — the standby console has no tabs. */}
      <Link
        href="/"
        className="mb-4 inline-block text-sm font-medium text-nova-300 transition-all hover:text-nova-200"
        style={{ textShadow: "0 0 10px rgb(0 229 255 / 0.35)" }}
      >
        ← Back to Ship
      </Link>
      <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
        The crew
      </p>
      <h1 className="text-sunlit mt-2 text-3xl font-semibold tracking-tight">
        Who you&apos;re helping win
      </h1>
      <p className="mt-1 max-w-xl text-sm text-stardust-300">
        The students who invited you onto their crew. Tap one to see where you
        can help most.
      </p>

      <div className="mt-6 space-y-3">
        {roster === null && (
          <p className="text-sm text-stardust-400">Checking the roster…</p>
        )}
        {roster !== null && roster.length === 0 && (
          <div className="card-living rounded-3xl p-6">
            <p className="text-sm text-stardust-300">
              No crew invitations yet. When a family adds you as a mentor,
              they&apos;ll appear here.
            </p>
          </div>
        )}
        {roster?.map((m) => (
          <Link
            key={m.child_id}
            href={`/village/${m.child_id}`}
            className="card-living block rounded-3xl p-5 transition hover:border-nova-400/40"
          >
            <p className="text-lg font-semibold text-star-100">
              {m.nickname ?? m.first_name}
            </p>
            <p className="mt-0.5 text-xs text-stardust-400">
              You&apos;re here as {RELATIONSHIP_LABEL[m.relationship] ?? "a mentor"}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
