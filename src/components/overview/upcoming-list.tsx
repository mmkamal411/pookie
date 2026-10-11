"use client";

import Link from "next/link";
import type { DueNextItem } from "@/lib/school/types";
import { dueDateLabel } from "@/components/school/styles";
import { byDueDate, statusStyle } from "./due-helpers";

/**
 * Upcoming assignments — everything on the horizon, soonest first.
 * Lives inside a collapsed-by-default section; the due-next strip above
 * already surfaces the urgent few.
 */
export function UpcomingList({
  items,
  childSlug,
}: {
  items: DueNextItem[];
  childSlug: string;
}) {
  const sorted = [...items].sort(byDueDate);
  if (sorted.length === 0) {
    return (
      <p className="text-sm text-stardust-300">
        Nothing on the horizon — a clear, sunny stretch. 🌤️
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {sorted.map((item, i) => {
        const s = statusStyle(item.status, "white");
        return (
          <Link
            key={item.id}
            href={`/c/${childSlug}/school/${item.class_slug}`}
            className="card-white animate-bloom flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
            style={{ animationDelay: `${0.05 + i * 0.04}s` }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[#1f1f4a]">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-[#55557e]">
                {item.class_name}
                {item.category ? ` · ${item.category}` : ""}
              </p>
            </div>
            <p className={`shrink-0 text-xs font-medium ${s.text}`}>
              {item.status === "missing" || item.status === "late"
                ? s.label
                : dueDateLabel(item.due_date)}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
