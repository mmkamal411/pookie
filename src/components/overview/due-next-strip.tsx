"use client";

import Link from "next/link";
import type { DueNextItem } from "@/lib/school/types";
import { dueDateLabel } from "@/components/school/styles";
import { byUrgency, isUrgent, statusStyle } from "./due-helpers";

/**
 * Due-next strip — a horizontal snap-scroll rail of the most urgent items
 * (missing → late → due today/tomorrow). The morning glance: what's on
 * fire, one swipe away. Each chip links to its class page.
 */
export function DueNextStrip({
  items,
  childSlug,
}: {
  items: DueNextItem[];
  childSlug: string;
}) {
  const urgent = items.filter(isUrgent).sort(byUrgency).slice(0, 8);
  if (urgent.length === 0) return null;

  return (
    <div
      className="animate-bloom -mx-4 overflow-x-auto px-4 pb-2"
      style={{ animationDelay: "0.16s", scrollbarWidth: "none" }}
      role="list"
      aria-label="Most urgent upcoming items"
    >
      <div className="flex snap-x snap-mandatory gap-3">
        {urgent.map((item) => {
          const s = statusStyle(item.status, "white");
          return (
            <Link
              key={item.id}
              role="listitem"
              href={`/c/${childSlug}/school/${item.class_slug}`}
              className="card-white w-56 shrink-0 snap-start rounded-2xl p-4"
            >
              <p className="flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase">
                <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
                <span className={s.text}>{s.label}</span>
              </p>
              <p className="mt-2 line-clamp-2 text-sm font-medium text-[#1f1f4a]">
                {item.title}
              </p>
              <p className="mt-1 truncate text-xs text-[#55557e]">
                {item.class_name}
                {item.category ? ` · ${item.category}` : ""}
              </p>
              <p className={`mt-2 text-xs font-medium ${s.text}`}>
                {item.status === "missing" || item.status === "late"
                  ? `${s.label.split(" — ")[0]}${item.due_date ? ` · ${dueDateLabel(item.due_date)}` : ""}`
                  : dueDateLabel(item.due_date)}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
