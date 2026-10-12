// S3 ticket list (§6.0) — real rows from GET /api/v1/support/tickets.
// Sorted by most-recent activity; empty state + persistent "Open a ticket".

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { StatusPill, ticketPill } from "@/components/ui";
import { ErrorCard, LoadingRows, api } from "@/components/travel/travel-shared";
import { SlaDisplay } from "./sla-display";

interface TicketRow {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  created_at: string;
  assigned_agent_id: string | null;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TicketList({ childSlug }: { childSlug: string }) {
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    api<TicketRow[]>("/api/v1/support/tickets")
      .then(setTickets)
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, []);

  if (error) return <ErrorCard message={error} onRetry={load} />;
  if (!tickets) return <LoadingRows rows={4} />;

  return (
    <div className="space-y-3">
      {tickets.length === 0 ? (
        <Card padding="lg" className="text-center">
          <p className="text-sm font-medium text-star-100">No tickets yet — that&apos;s a good sign.</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
            If something breaks, open one here and a human will pick it up.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Link
              href={`/c/${childSlug}/support/tickets/new`}
              className="rounded-2xl border border-nova-300/40 bg-nova-500/15 px-5 py-2.5 text-sm font-semibold text-star-100"
            >
              Open a ticket
            </Link>
            <Link
              href={`/c/${childSlug}/support/chat`}
              className="rounded-2xl border border-nova-400/20 px-5 py-2.5 text-sm font-medium text-stardust-200"
            >
              Ask Pookie first
            </Link>
          </div>
        </Card>
      ) : (
        tickets.map((t) => {
          const pill = ticketPill(t.status);
          return (
            <Link key={t.id} href={`/c/${childSlug}/support/tickets/${t.id}`} className="block">
              <Card padding="sm" className="transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-star-100">{t.subject}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-stardust-500">{t.ticket_number}</p>
                  </div>
                  <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <SlaDisplay slaDueAt={t.sla_due_at} slaBreached={t.sla_breached} />
                  <span className="shrink-0 text-xs text-stardust-500">{timeAgo(t.created_at)}</span>
                </div>
              </Card>
            </Link>
          );
        })
      )}

      {tickets.length > 0 && (
        <div className="sticky bottom-20 pt-2">
          <Link
            href={`/c/${childSlug}/support/tickets/new`}
            className="block rounded-2xl border border-nova-300/40 bg-nova-500/20 px-5 py-3 text-center text-sm font-semibold text-star-100 backdrop-blur-md"
          >
            Open a ticket
          </Link>
        </div>
      )}
    </div>
  );
}
