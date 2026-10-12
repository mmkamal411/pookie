"use client";

import { useEffect, useState } from "react";
import type { LibraryResource, ResourceType } from "@/server/services/school-resources";

const TYPE_META: Record<ResourceType, { label: string; icon: string; color: string; glow: string }> = {
  khan_academy: { label: "Khan Academy", icon: "🎓", color: "#4ade80", glow: "rgb(74 222 128 / 0.25)" },
  youtube: { label: "YouTube", icon: "▶️", color: "#f87171", glow: "rgb(248 113 113 / 0.25)" },
  cheat_sheet: { label: "Cheat Sheet", icon: "📋", color: "#fbbf24", glow: "rgb(251 191 36 / 0.25)" },
  clever: { label: "Clever", icon: "🟠", color: "#fb923c", glow: "rgb(251 146 60 / 0.25)" },
  kahoot: { label: "Kahoot", icon: "🟣", color: "#c084fc", glow: "rgb(192 132 252 / 0.25)" },
  blooket: { label: "Blooket", icon: "💗", color: "#f472b6", glow: "rgb(244 114 182 / 0.25)" },
  quizlet: { label: "Quizlet", icon: "🔵", color: "#60a5fa", glow: "rgb(96 165 250 / 0.25)" },
  desmos: { label: "Desmos", icon: "📐", color: "#2dd4bf", glow: "rgb(45 212 191 / 0.25)" },
  deltamath: { label: "DeltaMath", icon: "∑", color: "#a3e635", glow: "rgb(163 230 53 / 0.25)" },
  ap_classroom: { label: "AP Classroom", icon: "🏛️", color: "#94a3b8", glow: "rgb(148 163 184 / 0.25)" },
  ebook: { label: "Ebook", icon: "📕", color: "#818cf8", glow: "rgb(129 140 248 / 0.25)" },
  game: { label: "Game", icon: "🎮", color: "#a78bfa", glow: "rgb(167 139 250 / 0.25)" },
  other: { label: "Link", icon: "🔗", color: "#9ca3af", glow: "rgb(156 163 175 / 0.25)" },
};

const TYPE_ORDER: ResourceType[] = [
  "khan_academy", "youtube", "quizlet", "kahoot", "blooket", "desmos",
  "deltamath", "ap_classroom", "clever", "cheat_sheet", "ebook", "game", "other",
];

function ResourceCard({
  r,
  onEdit,
  onDelete,
  index,
}: {
  r: LibraryResource;
  onEdit: (r: LibraryResource) => void;
  onDelete: (r: LibraryResource) => void;
  index: number;
}) {
  const meta = TYPE_META[r.type] ?? TYPE_META.other;
  const body = (
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-star-100">{r.title}</p>
      <p className="mt-0.5 flex items-center gap-2 text-[11px]">
        <span className="font-bold tracking-wide" style={{ color: meta.color }}>
          {meta.label}
        </span>
        {r.unitTag && <span className="truncate text-stardust-400">· {r.unitTag}</span>}
      </p>
      {r.description && <p className="mt-1 text-xs leading-relaxed text-stardust-300 line-clamp-2">{r.description}</p>}
      <div className="mt-1.5 flex items-center gap-2">
        {r.isSeeded && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: `${meta.color}22`, color: meta.color }}>
            Pookie Pick
          </span>
        )}
        {r.url ? (
          <span className="text-[11px] font-medium text-nova-300">Open ↗</span>
        ) : (
          <span className="text-[11px] text-stardust-400">Saved note</span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className="group relative animate-bloom overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 active:scale-[0.98]"
      style={{
        animationDelay: `${index * 0.04}s`,
        borderColor: `${meta.color}45`,
        background: `linear-gradient(135deg, ${meta.color}14, transparent 60%)`,
        boxShadow: `0 0 12px ${meta.glow}`,
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ background: `${meta.color}1e`, boxShadow: `inset 0 0 12px ${meta.glow}` }}
          aria-hidden="true"
        >
          {meta.icon}
        </span>
        {r.url ? (
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-left">
            {body}
          </a>
        ) : (
          body
        )}
        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(r)}
            aria-label={`Edit ${r.title}`}
            className="rounded-lg border border-nova-400/20 px-2 py-1 text-[11px] font-medium text-stardust-300 hover:text-star-100"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(r)}
            aria-label={`Remove ${r.title}`}
            className="rounded-lg border border-red-400/25 px-2 py-1 text-[11px] font-medium text-stardust-300 hover:text-red-300"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormState {
  id?: string;
  resource_type: ResourceType;
  title: string;
  url: string;
  description: string;
  unit_tag: string;
}

const EMPTY_FORM: FormState = {
  resource_type: "khan_academy",
  title: "",
  url: "",
  description: "",
  unit_tag: "",
};

/**
 * Resource library — the student owns it. Seeded recommendations on first
 * view (Pookie Picks), then add/edit/remove freely. Every resource type
 * has its own visual identity; cards lift on hover and respond to touch.
 */
export function ResourceLibrary({
  childId,
  classId,
  currentUnit,
}: {
  childId: string;
  classId: string;
  currentUnit: string | null;
}) {
  const [resources, setResources] = useState<LibraryResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/resource-library?class_id=${classId}`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: { resources: LibraryResource[] } };
      setResources(json.data.resources ?? []);
    } catch {
      setError("Couldn't load the library — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  function startAdd() {
    setForm({ ...EMPTY_FORM, unit_tag: currentUnit ?? "" });
    setFormOpen(true);
    setError(null);
  }

  function startEdit(r: LibraryResource) {
    setForm({
      id: r.id,
      resource_type: r.type,
      title: r.title,
      url: r.url ?? "",
      description: r.description ?? "",
      unit_tag: r.unitTag ?? "",
    });
    setFormOpen(true);
    setError(null);
  }

  async function save() {
    if (!form.title.trim()) {
      setError("Give it a title first.");
      return;
    }
    if (form.url.trim()) {
      try {
        new URL(form.url.trim());
      } catch {
        setError("That URL doesn't look right — check it and try again.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        class_id: classId,
        title: form.title.trim(),
        url: form.url.trim() || null,
        resource_type: form.resource_type,
        description: form.description.trim() || null,
        unit_tag: form.unit_tag.trim() || null,
      };
      const res = form.id
        ? await fetch(`/api/v1/children/${childId}/school/resource-library/${form.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/v1/children/${childId}/school/resource-library`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error("save_failed");
      setFormOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch {
      setError("Couldn't save that — try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/resource-library/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete_failed");
      setConfirmId(null);
      await load();
    } catch {
      setError("Couldn't remove that — try again in a moment.");
    }
  }

  async function restore() {
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/resource-library/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ class_id: classId }),
      });
      if (!res.ok) throw new Error("restore_failed");
      await load();
    } catch {
      setError("Couldn't restore recommendations — try again in a moment.");
    }
  }

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading resource library">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl border border-nova-400/10 bg-nebula-900/60" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-stardust-300">
          {resources.length > 0
            ? `${resources.length} resource${resources.length === 1 ? "" : "s"} — yours to keep, add, or remove.`
            : "Your library starts with Pookie's picks — make it yours."}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={restore}
            className="rounded-xl border border-nova-400/20 px-3 py-1.5 text-xs font-medium text-stardust-300 hover:text-star-100"
          >
            Restore Picks
          </button>
          <button
            type="button"
            onClick={startAdd}
            className="btn-dapple rounded-xl px-4 py-1.5 text-xs font-bold text-nebula-950"
          >
            + Add
          </button>
        </div>
      </div>

      {formOpen && (
        <div className="card-living mb-4 rounded-2xl border border-nova-400/25 p-4">
          <p className="text-sm font-bold text-star-100">{form.id ? "Edit Resource" : "Add a Resource"}</p>
          <p className="mt-1 text-xs text-stardust-300">Pick a type — each one gets its own look.</p>
          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
            {TYPE_ORDER.map((t) => {
              const m = TYPE_META[t];
              const active = form.resource_type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, resource_type: t }))}
                  aria-pressed={active}
                  className="flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-all hover:-translate-y-0.5 active:scale-95"
                  style={{
                    borderColor: active ? m.color : "rgb(96 165 250 / 0.12)",
                    background: active ? `${m.color}1a` : "transparent",
                    boxShadow: active ? `0 0 10px ${m.glow}` : "none",
                  }}
                >
                  <span className="text-lg" aria-hidden="true">{m.icon}</span>
                  <span className="text-[9px] font-semibold leading-tight text-stardust-200">{m.label}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 space-y-2.5">
            <input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={280}
              placeholder="Title — e.g. Quadratic Formula walkthrough"
              className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm"
              aria-label="Resource title"
            />
            <input
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              maxLength={2000}
              placeholder="Link (https://…) — optional for notes"
              inputMode="url"
              className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm"
              aria-label="Resource link"
            />
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              maxLength={1000}
              placeholder="Why is this good? (optional)"
              className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm"
              aria-label="Resource description"
            />
            <input
              value={form.unit_tag}
              onChange={(e) => setForm((f) => ({ ...f, unit_tag: e.target.value }))}
              maxLength={200}
              placeholder="Unit tag (optional)"
              className="input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm"
              aria-label="Unit tag"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-dapple flex-1 rounded-xl py-2.5 text-sm font-bold text-nebula-950 disabled:opacity-50"
            >
              {saving ? "Saving…" : form.id ? "Save Changes" : "Add to My Library"}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setForm(EMPTY_FORM);
              }}
              className="rounded-xl border border-nova-400/20 px-4 py-2.5 text-sm text-stardust-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-xs text-red-300">⚠️ {error}</p>}

      {resources.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {resources.map((r, i) =>
            confirmId === r.id ? (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/30 bg-nebula-900/60 p-4">
                <p className="text-xs text-stardust-200">
                  Remove <span className="font-semibold text-star-100">{r.title}</span> for good?
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="rounded-xl border border-red-400/40 px-3 py-1.5 text-xs font-bold text-red-300"
                  >
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="rounded-xl border border-nova-400/20 px-3 py-1.5 text-xs text-stardust-300"
                  >
                    Keep
                  </button>
                </div>
              </div>
            ) : (
              <ResourceCard
                key={r.id}
                r={r}
                index={i}
                onEdit={startEdit}
                onDelete={(x) => setConfirmId(x.id)}
              />
            )
          )}
        </div>
      ) : (
        !formOpen && (
          <div className="rounded-2xl border border-dashed border-nova-400/25 px-5 py-8 text-center">
            <p className="text-sm text-stardust-300">
              Nothing here yet — add your first resource and make this library yours.
            </p>
            <button
              type="button"
              onClick={startAdd}
              className="btn-dapple mt-3 rounded-xl px-5 py-2 text-sm font-bold text-nebula-950"
            >
              + Add a Resource
            </button>
          </div>
        )
      )}
    </div>
  );
}
