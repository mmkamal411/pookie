"use client";

import { useEffect, useMemo, useState } from "react";

interface Unit {
  id: string;
  unit_number: number;
  unit_label: string;
  semester: string | null;
  is_current: boolean;
}

interface Material {
  id: string;
  title: string;
  file_type: string | null;
  section: string | null;
  unit_number: number | null;
  part_number: number | null;
  size_bytes: number | null;
  tags: string[];
  semester: string | null;
}

function fileIcon(type: string | null): string {
  const t = (type || "").toLowerCase();
  if (t === "pdf") return "📄";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(t)) return "🖼️";
  if (t === "mp4") return "🎬";
  if (["java", "txt", "py", "js", "md"].includes(t)) return "💻";
  if (t === "html") return "🌐";
  if (["doc", "docx"].includes(t)) return "📝";
  if (["xls", "xlsx", "csv"].includes(t)) return "📊";
  if (["ppt", "pptx"].includes(t)) return "📽️";
  return "📎";
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Study Materials — Drive-synced course materials, grouped by unit.
 * The current unit opens by default and carries the CURRENT badge.
 * Graceful: awaiting-sync state when the tables are empty/unmigrated.
 */
export function StudyMaterials({
  childId,
  slug,
}: {
  childId: string;
  slug: string | null;
}) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openUnits, setOpenUnits] = useState<Set<number>>(new Set());
  const [textbookOpen, setTextbookOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/v1/children/${childId}/school/materials?slug=${slug}`);
        if (!res.ok) throw new Error("materials_failed");
        const json = (await res.json()) as {
          data: { units: Unit[]; materials: Material[]; available: boolean };
        };
        if (cancelled) return;
        setUnits(json.data.units ?? []);
        setMaterials(json.data.materials ?? []);
        setAvailable(json.data.available !== false);
        const current = (json.data.units ?? []).find((u) => u.is_current);
        if (current) setOpenUnits(new Set([current.unit_number]));
      } catch {
        setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, slug]);

  const q = search.trim().toLowerCase();
  const unitMaterials = useMemo(() => materials.filter((m) => m.section === "units"), [materials]);
  const textbook = useMemo(() => materials.filter((m) => m.section === "textbook"), [materials]);
  const filtered = (list: Material[]) =>
    q ? list.filter((m) => m.title.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q))) : list;

  function toggleUnit(n: number) {
    setOpenUnits((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-label="Loading study materials">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-2xl border border-nova-400/10 bg-nebula-900/60" />
        ))}
      </div>
    );
  }

  if (!available || materials.length === 0) {
    return (
      <div className="rounded-2xl border border-nova-400/10 bg-nebula-900/60 px-5 py-6 text-center">
        <p className="text-2xl" aria-hidden="true">📚</p>
        <p className="mt-2 text-sm text-stardust-300">
          No study materials synced yet — they&apos;ll appear here automatically
          once the Drive sync lands.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search materials…"
          aria-label="Search study materials"
          className="input-rooted w-full rounded-xl py-2.5 pl-4 pr-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        {units.map((u) => {
          const items = filtered(unitMaterials.filter((m) => m.unit_number === u.unit_number));
          if (q && items.length === 0) return null;
          const open = openUnits.has(u.unit_number);
          return (
            <div key={u.id} className="overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
              <button
                type="button"
                onClick={() => toggleUnit(u.unit_number)}
                aria-expanded={open}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
              >
                <span className="shrink-0 text-nova-300" aria-hidden="true">📖</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-star-100">{u.unit_label}</span>
                {u.is_current && (
                  <span className="shrink-0 rounded-full bg-comet-400/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-comet-300 capitalize">
                    Current
                  </span>
                )}
                <span className="shrink-0 text-xs text-stardust-400 tabular-nums">{items.length} files</span>
                <span aria-hidden="true" className={`shrink-0 text-stardust-400 transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
              </button>
              <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <div className="space-y-1.5 border-t border-nova-400/10 p-3">
                    {items.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5"
                      >
                        <span className="shrink-0 text-base" aria-hidden="true">{fileIcon(m.file_type)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-star-100">{m.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-stardust-400">
                            {m.size_bytes ? <span>{formatSize(m.size_bytes)}</span> : null}
                            {m.tags.includes("study-guide") && (
                              <span className="rounded-full bg-comet-400/15 px-1.5 py-0.5 font-semibold text-comet-300">Study Guide</span>
                            )}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered(textbook).length > 0 && (
        <div className="mt-2 overflow-hidden rounded-2xl border border-nova-400/10 bg-nebula-900/60">
          <button
            type="button"
            onClick={() => setTextbookOpen(!textbookOpen)}
            aria-expanded={textbookOpen}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="shrink-0 text-nova-300" aria-hidden="true">📕</span>
            <span className="flex-1 text-sm font-semibold text-star-100">Textbook</span>
            <span className="text-xs text-stardust-400 tabular-nums">{filtered(textbook).length} files</span>
            <span aria-hidden="true" className={`text-stardust-400 transition-transform ${textbookOpen ? "rotate-180" : ""}`}>▾</span>
          </button>
          <div className="grid transition-[grid-template-rows] duration-200 ease-in-out" style={{ gridTemplateRows: textbookOpen ? "1fr" : "0fr" }}>
            <div className="overflow-hidden">
              <div className="max-h-96 space-y-1.5 overflow-y-auto border-t border-nova-400/10 p-3">
                {filtered(textbook).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl border border-nova-400/10 bg-nebula-800/60 px-3.5 py-2.5">
                    <span className="shrink-0 text-base" aria-hidden="true">{fileIcon(m.file_type)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-star-100">
                        {m.part_number != null ? `Part ${m.part_number}` : m.title}
                      </span>
                      {m.size_bytes ? <span className="text-[11px] text-stardust-400">{formatSize(m.size_bytes)}</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
