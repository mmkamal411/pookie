"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { openApplet } from "@/lib/applet-bus";
import { AddChildForm } from "@/app/add-child/add-child-form";
import { AppletGate, AppletLoading, AppletError } from "@/components/applet-views-shared";

interface CrewMember {
  child_id: string;
  role: "parent" | "child";
  child: {
    id: string;
    slug: string;
    first_name: string;
    nickname: string | null;
    avatar_url: string | null;
    school_name: string | null;
    grade_level: string | null;
  };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold tracking-[0.22em] text-stardust-400 uppercase">
      {children}
    </h3>
  );
}

/**
 * CrewApplet — the Crew hub. ALL child functionality in one self-contained
 * place (Meheldi 2026-10-12): the crew roster, per-child consoles (opened
 * as applets, same as every other module), school logins, sync setups,
 * permissions, and the add-a-child door with its legal gates intact.
 *
 * Opt-in by design: pilots with no crew see the add-child door, never an
 * upsell and never an assumption.
 */
export function CrewApplet() {
  const [members, setMembers] = useState<CrewMember[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  async function loadMembers() {
    try {
      const res = await fetch("/api/v1/me/memberships");
      const j = await res.json();
      if (j.ok && Array.isArray(j.data)) {
        setMembers(j.data as CrewMember[]);
        setFailed(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  return (
    <AppletGate
      label="Crew"
      loading={members === null && !failed}
      failed={failed}
      onRetry={() => window.location.reload()}
    >
      <div className="space-y-7">
        <p className="-mt-1 text-sm leading-relaxed text-stardust-300">
          The people you fly with. Their consoles, school connections, and
          permissions — all here, all optional.
        </p>

        <section>
          <SectionTitle>Your crew</SectionTitle>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(members ?? []).map((m) => {
              const name = m.child.nickname ?? m.child.first_name;
              const meta = [m.child.grade_level, m.child.school_name].filter(Boolean).join(" · ");
              return (
                <div
                  key={m.child_id}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-nova-500/15 text-base font-semibold text-nova-300"
                    >
                      {name.charAt(0)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-star-100">{name}</p>
                      {meta && <p className="truncate text-xs text-stardust-400">{meta}</p>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openApplet("crew-console", {
                        childId: m.child_id,
                        slug: m.child.slug,
                        name,
                      })
                    }
                    className="mt-3 w-full rounded-xl border border-nova-400/40 bg-nova-500/15 px-4 py-2.5 text-sm font-medium text-star-100 transition hover:bg-nova-500/25"
                  >
                    Open {name}&apos;s console →
                  </button>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1">
                    <Link href={`/c/${m.child.slug}/settings/credentials`} className="text-[11px] text-stardust-400 hover:text-stardust-200">
                      School logins
                    </Link>
                    <Link href={`/c/${m.child.slug}/settings/sync`} className="text-[11px] text-stardust-400 hover:text-stardust-200">
                      Sync setup
                    </Link>
                    <Link href={`/c/${m.child.slug}/settings/family`} className="text-[11px] text-stardust-400 hover:text-stardust-200">
                      Permissions
                    </Link>
                  </div>
                </div>
              );
            })}
            {(members ?? []).length === 0 && (
              <p className="text-sm leading-relaxed text-stardust-400">
                No crew aboard yet — solo flight. If kids become part of your
                life, add them below. Nothing here assumes they will.
              </p>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>Add a child</SectionTitle>
          {!showAddForm ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="block w-full rounded-2xl border border-dashed border-nova-400/40 bg-nova-500/5 p-5 text-left transition hover:border-nova-400/70 hover:bg-nova-500/10"
              >
                <span className="block text-sm font-semibold text-star-100">
                  + Add a child <span className="font-normal text-stardust-400">(optional)</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-stardust-300">
                  School, grades, and daily rhythm for a child in your life —
                  with guardian attestation and age shields built in.
                </span>
              </button>
              <Link
                href="/onboarding/connect"
                className="mt-2 inline-block text-xs text-stardust-400 hover:text-stardust-200"
              >
                Or link a child who&apos;s already on Pookie →
              </Link>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              {justAdded ? (
                <div className="py-2 text-center">
                  <p className="text-sm font-semibold text-star-100">
                    {justAdded} is aboard 🧑‍🚀
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-stardust-300">
                    Their console is ready in your crew list above.
                  </p>
                  <button
                    type="button"
                    onClick={() => setJustAdded(null)}
                    className="mt-3 text-xs text-stardust-400 hover:text-stardust-200"
                  >
                    Add another →
                  </button>
                </div>
              ) : (
                <AddChildForm
                  onAdded={(firstName) => {
                    setJustAdded(firstName);
                    loadMembers();
                  }}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setJustAdded(null);
                }}
                className="mt-2 text-xs text-stardust-400 hover:text-stardust-200"
              >
                ← Back
              </button>
            </div>
          )}
        </section>
      </div>
    </AppletGate>
  );
}

interface SchoolClass {
  class_id: string;
  name: string;
  numeric: number | null;
  letter?: string | null;
}

interface DueItem {
  title: string;
  due_date?: string | null;
  class_name?: string | null;
}

/**
 * CrewConsoleApplet — a crew member's console as a module applet.
 * The glanceable console home (mission status, classes, due-next) renders
 * from the dashboard + overview APIs; deep sections (full school console,
 * health, travel…) stay full pages under /c/[slug], linked from here.
 */
export function CrewConsoleApplet({ params }: { params: Record<string, string> }) {
  const childId = params.childId ?? "";
  const slug = params.slug ?? "";
  const name = params.name ?? "Crew member";

  const [overview, setOverview] = useState<{ classes?: SchoolClass[]; due_next?: DueItem[] } | null>(null);
  const [dash, setDash] = useState<{ gpa?: { value?: number | null } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!childId) {
      setFailed(true);
      setLoading(false);
      return;
    }
    let live = true;
    (async () => {
      try {
        const [ov, db] = await Promise.all([
          fetch(`/api/v1/children/${childId}/school/overview`).then((r) => r.json()),
          fetch(`/api/v1/children/${childId}/school/dashboard`).then((r) => r.json()),
        ]);
        if (!live) return;
        if (ov.ok) setOverview(ov.data);
        if (db.ok) setDash(db.data);
        if (!ov.ok && !db.ok) setFailed(true);
      } catch {
        if (live) setFailed(true);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [childId]);

  if (loading) return <AppletLoading label={`${name}'s console`} />;
  if (failed) return <AppletError label={`${name}'s console`} onRetry={() => window.location.reload()} />;

  const classes = [...(overview?.classes ?? [])]
    .sort((a, b) => (b.numeric ?? -1) - (a.numeric ?? -1))
    .slice(0, 6);
  const dueNext = (overview?.due_next ?? []).slice(0, 4);
  const gpa = dash?.gpa?.value;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-stardust-400 uppercase">
            Crew console
          </p>
          <h3 className="text-sunlit mt-1 text-xl font-semibold">{name}</h3>
        </div>
        {gpa != null && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-center">
            <p className="text-[10px] tracking-widest text-stardust-400 uppercase">GPA</p>
            <p className="text-sunlit text-xl font-semibold">{Number(gpa).toFixed(2)}</p>
          </div>
        )}
      </div>

      {classes.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-stardust-400 uppercase">Classes</p>
          <ul className="mt-2 space-y-2">
            {classes.map((c) => (
              <li
                key={c.class_id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-2.5"
              >
                <span className="truncate text-sm text-star-100">{c.name}</span>
                <span className="shrink-0 text-sm font-semibold text-nova-300">
                  {c.numeric != null ? `${Math.round(c.numeric)}` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dueNext.length > 0 && (
        <section>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-stardust-400 uppercase">Due next</p>
          <ul className="mt-2 space-y-2">
            {dueNext.map((d, i) => (
              <li key={i} className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 text-sm">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                <span className="min-w-0 flex-1 truncate text-stardust-200">{d.title}</span>
                {d.due_date && <span className="shrink-0 text-xs text-stardust-500">{d.due_date}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {slug && (
        <Link
          href={`/c/${slug}`}
          className="block rounded-2xl border border-nova-400/40 bg-nova-500/15 px-4 py-3 text-center text-sm font-medium text-star-100 transition hover:bg-nova-500/25"
        >
          Open the full console →
        </Link>
      )}
      <p className="text-center text-[11px] text-stardust-500">
        Deep sections — full school console, health, travel — live in the full console.
      </p>
    </div>
  );
}
