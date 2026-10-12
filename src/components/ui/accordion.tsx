// Accordion — collapsed-by-default expandable rows, Nebula style.
// Built for the Support FAQ legal expandables (FR-SUPPORT-001): every
// legally-relevant item carries a plain-language explanation plus a badge
// naming the law AND why Pookie's policy aligns — honest about
// law-required vs Pookie's-choice.
//
// Props:
//   items      — { id, title, body, badges? }[]; body may be React nodes
//   defaultOpen — id of the row open on mount (default: none)
//   allowMultiple — allow several rows open at once (default false)
// Badge tones: "law" ("Required by law", with lawName) or "choice"
// ("Pookie's choice").

"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

export interface AccordionBadge {
  tone: "law" | "choice";
  /** e.g. "COPPA · 15 U.S.C. §§ 6501–6506" for law badges. */
  lawName?: string;
}

export interface AccordionItem {
  id: string;
  title: string;
  body: ReactNode;
  badges?: AccordionBadge[];
}

function badgeLabel(b: AccordionBadge): string {
  return b.tone === "law" ? "Required by law" : "Pookie's choice";
}

export function Accordion({
  items,
  defaultOpen,
  allowMultiple = false,
}: {
  items: AccordionItem[];
  defaultOpen?: string;
  allowMultiple?: boolean;
}) {
  const [openIds, setOpenIds] = useState<string[]>(defaultOpen ? [defaultOpen] : []);

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (isOpen) return prev.filter((o) => o !== id);
      return allowMultiple ? [...prev, id] : [id];
    });
  };

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        return (
          <div
            key={item.id}
            className="card-living overflow-hidden rounded-2xl"
          >
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-${item.id}`}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-sm font-medium text-star-100">{item.title}</span>
              <span
                aria-hidden="true"
                className={`shrink-0 text-nova-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>
            {isOpen && (
              <div id={`accordion-${item.id}`} className="animate-rise border-t border-nova-400/10 px-4 pt-3 pb-4">
                {item.badges && item.badges.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {item.badges.map((b, i) => (
                      <Badge key={i} tone={b.tone} title={b.lawName}>
                        {badgeLabel(b)}
                        {b.lawName ? ` · ${b.lawName}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="text-sm leading-relaxed text-stardust-300">{item.body}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
