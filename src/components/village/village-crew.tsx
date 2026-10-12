"use client";

/**
 * Squad Village — "The Crew": manage the trusted people around a child.
 *
 * Parents grant mentors (sibling, uncle, aunt, grandparent, tutor, coach).
 * Mentors VIEW school life and ENCOURAGE — never grades changes, never
 * teacher messages, never health data. Age-tiered consent enforced server-side.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/components/home-money/shared";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  const json = await res.json();
  if (!json.ok)
    throw new ApiError(
      json.error?.code ?? "INTERNAL",
      json.error?.message ?? "Hold position — request incomplete. Try again in a moment.",
    );
  return json.data as T;
}

const BASE = "/api/v1/village";

const RELATIONSHIPS = [
  { value: "sibling", label: "Older Sibling" },
  { value: "uncle", label: "Uncle" },
  { value: "aunt", label: "Aunt" },
  { value: "grandparent", label: "Grandparent" },
  { value: "tutor", label: "Tutor" },
  { value: "coach", label: "Coach" },
  { value: "other", label: "Someone Else" },
] as const;

interface Mentor {
  id: string;
  child_id: string;
  mentor_user_id: string;
  mentor_email: string | null;
  mentor_name: string | null;
  relationship: string;
  scope_class_ids: string[] | null;
  status: string;
  child_consent: string;
  created_at: string;
}

interface Kudos {
  id: string;
  message: string;
  created_at: string;
  from_name: string;
  relationship: string | null;
}

interface SchoolClass {
  id: string;
  name: string;
}

const STATUS_COPY: Record<string, string> = {
  pending: "Waiting on your teen's okay",
  active: "On the crew — can see school life",
  cooling_off: "Cooling off — full access in a few days",
};

export function VillageCrew({ childId, isParent }: { childId: string; isParent: boolean }) {
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [kudos, setKudos] = useState<Kudos[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [email, setEmail] = useState("");
  const [relationship, setRelationship] = useState<string>("uncle");
  const [scopeAll, setScopeAll] = useState(true);
  const [scopeIds, setScopeIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [m, k] = await Promise.all([
        api<Mentor[]>(`${BASE}/mentors?child_id=${childId}`),
        api<Kudos[]>(`${BASE}/kudos?child_id=${childId}`).catch(() => [] as Kudos[]),
      ]);
      setMentors(m);
      setKudos(k);
    } catch {
      // Honest empty state rather than an error wall.
    }
  }, [childId]);

  useEffect(() => {
    refresh();
    // Class list for scoped grants (best-effort).
    fetch(`/api/v1/village/overview?child_id=${childId}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setClasses(j.data.classes ?? []);
      })
      .catch(() => {});
  }, [refresh, childId]);

  const grant = async () => {
    const trimmed = email.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ status: string; child_consent: string }>(`${BASE}/mentors`, {
        method: "POST",
        body: JSON.stringify({
          child_id: childId,
          mentor_email: trimmed,
          relationship,
          scope_class_ids: scopeAll ? null : scopeIds,
        }),
      });
      setEmail("");
      setScopeIds([]);
      setScopeAll(true);
      setNotice(
        result.status === "active"
          ? "They're on the crew — welcome aboard."
          : result.child_consent === "pending"
            ? "Invite sent — they'll join once your teen gives the okay."
            : "Invite sent.",
      );
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not add them. Make sure they have a Pookie account.",
      );
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (mentor: Mentor) => {
    const name = mentor.mentor_name ?? mentor.mentor_email ?? "this mentor";
    if (!confirm(`Remove ${name} from the crew? Instant, no questions asked.`)) return;
    try {
      await api(`${BASE}/mentors?mentor_id=${mentor.id}`, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove them.");
    }
  };

  const toggleScope = (classId: string) => {
    setScopeIds((ids) =>
      ids.includes(classId) ? ids.filter((i) => i !== classId) : [...ids, classId],
    );
  };

  return (
    <section className="card-living rounded-3xl p-6">
      <h2 className="text-xl font-semibold text-star-100">The Crew</h2>
      <p className="mt-1 text-sm text-stardust-300">
        The trusted people helping your child win — siblings, uncles, aunts,
        grandparents, tutors, coaches. They can see classes, due dates, and
        missing work, and send encouragement. They can never change grades,
        message teachers, or see health data.
      </p>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}

      {mentors.length > 0 && (
        <ul className="mt-4 space-y-2">
          {mentors.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-2xl bg-nebula-950/60 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-star-100">
                  {m.mentor_name ?? m.mentor_email ?? "A mentor"}
                  <span className="ml-2 rounded-full border border-nova-400/30 px-2 py-0.5 text-xs text-nova-300">
                    {RELATIONSHIPS.find((r) => r.value === m.relationship)?.label ?? m.relationship}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-stardust-400">
                  {STATUS_COPY[m.status] ?? m.status}
                  {m.scope_class_ids && m.scope_class_ids.length > 0
                    ? ` · ${m.scope_class_ids.length} class${m.scope_class_ids.length === 1 ? "" : "es"}`
                    : " · all classes"}
                </p>
              </div>
              {isParent && (
                <button
                  type="button"
                  onClick={() => revoke(m)}
                  className="text-xs text-stardust-400 underline-offset-4 hover:text-red-300 hover:underline"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isParent && (
        <div className="mt-5 rounded-2xl border border-nova-400/20 bg-nebula-900/40 p-4">
          <p className="text-sm font-medium text-star-100">Add someone to the crew</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Their Pookie email…"
              className="input-rooted rounded-xl px-3 py-2 text-sm"
            />
            <select
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="input-rooted rounded-xl px-3 py-2 text-sm"
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-stardust-300">
              <input
                type="checkbox"
                checked={scopeAll}
                onChange={(e) => setScopeAll(e.target.checked)}
                className="h-4 w-4 accent-cyan-400"
              />
              All classes
            </label>
            {!scopeAll && classes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {classes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleScope(c.id)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      scopeIds.includes(c.id)
                        ? "border-nova-400 bg-nova-500/20 text-nova-200"
                        : "border-stardust-500/30 text-stardust-300 hover:border-nova-400/50"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            {!scopeAll && classes.length === 0 && (
              <p className="mt-2 text-xs text-stardust-400">
                Class list unavailable — they&apos;ll see all classes.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={grant}
            disabled={busy || !email.trim()}
            className="btn-dapple mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-nebula-950 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add to the Crew"}
          </button>
          <p className="mt-2 text-xs text-stardust-400">
            Under 13, you decide. Ages 13–15, your teen gets a say with a
            7-day cooling-off. 16+, your teen approves instantly. Anyone can be
            removed anytime, and every view is logged.
          </p>
        </div>
      )}

      {kudos.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-medium text-star-100">Encouragement from the crew</p>
          <ul className="mt-2 space-y-2">
            {kudos.slice(0, 5).map((k) => (
              <li
                key={k.id}
                className="rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3"
              >
                <p className="text-sm text-star-100">&ldquo;{k.message}&rdquo;</p>
                <p className="mt-1 text-xs text-stardust-400">
                  — {k.from_name}
                  {k.relationship ? ` · ${k.relationship}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
