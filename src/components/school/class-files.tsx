"use client";

import { useEffect, useState } from "react";
import type { ClassFile } from "@/lib/school/types";

/**
 * Class handout uploads — files land in the class-files bucket at
 * <uid>/<child-slug>/<class-slug>/<yyyy-mm-dd>/<file>; viewed via signed URLs.
 */
export function ClassFiles({
  childId,
  classId,
  className,
}: {
  childId: string;
  classId: string;
  className: string;
}) {
  const [files, setFiles] = useState<ClassFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/v1/children/${childId}/school/classes/${classId}/uploads`);
      if (!res.ok) throw new Error("load_failed");
      const json = (await res.json()) as { data: { files: ClassFile[] } };
      setFiles(json.data.files);
    } catch {
      setError("Couldn't load the class folder.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function upload(selected: FileList | null) {
    const file = selected?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10 MB — please pick a smaller one.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/v1/children/${childId}/school/classes/${classId}/uploads`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("upload_failed");
      await load();
    } catch {
      setError("Couldn't upload that file — try again in a moment.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card-living animate-rise rounded-3xl border border-nova-400/20 p-5">
      <h3 className="font-medium text-star-100">Files &amp; handouts</h3>
      <p className="text-xs text-stardust-300">
        Study guides, screenshots, and notes for {className} — kept in the private class folder.
      </p>

      {files.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li key={f.path}>
              <a
                href={f.signed_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl border border-nova-400/10 bg-nebula-800/60 px-4 py-2.5 text-sm text-star-100 transition-colors hover:border-nova-400/30"
              >
                <span className="truncate">📎 {f.name}</span>
                {f.created_at && (
                  <span className="ml-3 shrink-0 text-[11px] text-stardust-500">
                    {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-stardust-300">Nothing here yet — the folder is ready when you are.</p>
      )}

      <label className="btn-dapple mt-4 inline-block cursor-pointer rounded-2xl px-5 py-2 text-sm font-semibold text-nebula-950">
        {uploading ? "Uploading…" : "Upload a file"}
        <input
          type="file"
          className="hidden"
          disabled={uploading}
          onChange={(e) => upload(e.target.files)}
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
