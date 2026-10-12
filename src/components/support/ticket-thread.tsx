// S3 ticket thread (§6.2) — status pill + SLA, teen-privacy banner,
// after-hours banner, message thread (user/agent/system rows, collapsed AI
// transcript), resolved-confirm card, composer / reopen, "notes for the
// agent" scratchpad, and the in-thread grant-consent card (sol-support C2).

"use client";

import { useEffect, useState } from "react";
import { Button, Card, CollapseRow, InfoLine, Sheet, StatusPill, ticketPill } from "@/components/ui";
import { ErrorCard, LoadingRows, api } from "@/components/travel/travel-shared";
import { createClient } from "@/lib/supabase/client";
import { SlaDisplay } from "./sla-display";

interface Ticket {
  id: string;
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  sla_due_at: string | null;
  sla_breached: boolean;
  teen_privacy: boolean;
  assigned_agent_id: string | null;
  created_at: string;
  closed_at: string | null;
  reopened_count: number | null;
  resolved_at: string | null;
}
interface ThreadEvent {
  id: string;
  author_type: string;
  kind: string;
  body: string;
  created_at: string;
}
interface Grant {
  id: string;
  scope: string;
  purpose: string;
  expires_at: string;
}

const SCOPE_LABEL: Record<string, string> = {
  "school.grades.read": "Your grades",
  "billing.read": "Billing info",
  "sync.status.read": "Sync status",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function isAfterHoursET(iso: string): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(
      new Date(iso),
    ),
  );
  return hour < 9 || hour >= 17;
}

export function TicketThread({ ticketId, childSlug }: { ticketId: string; childSlug: string }) {
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [events, setEvents] = useState<ThreadEvent[]>([]);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [scratchpad, setScratchpad] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const load = () => {
    setError("");
    api<{ ticket: Ticket; events: ThreadEvent[] }>(`/api/v1/support/tickets/${ticketId}`)
      .then((d) => {
        setTicket(d.ticket);
        setEvents(d.events);
        // Resolve the agent's display name for the "With [name]" pill (best-effort).
        const aid = (d.ticket as Ticket).assigned_agent_id;
        if (aid) {
          createClient()
            .from("support_agents")
            .select("display_name")
            .eq("id", aid)
            .maybeSingle()
            .then(({ data }: { data: unknown }) => {
              const name = (data as { display_name?: string } | null)?.display_name;
              if (name) setAgentName(name.split(" ")[0]);
            })
            .catch(() => {});
        }
        // Pending grant-consent cards for this ticket (data owner decides).
        createClient()
          .from("support_grants")
          .select("id, scope, purpose, expires_at")
          .eq("ticket_id", d.ticket.id)
          .eq("status", "pending")
          .then(({ data }: { data: unknown }) => {
            if (data) setGrants(data as Grant[]);
          })
          .catch(() => {});
      })
      .catch((e: Error) => setError(e.message));
  };

  useEffect(load, [ticketId]);

  const postMessage = async (body: string) => {
    setSending(true);
    try {
      const attachmentLine =
        file != null
          ? `\n\nAttachment: ${file.name} (${(file.size / 1048576).toFixed(1)} MB) — file bytes attach with the storage update.`
          : "";
      await api(`/api/v1/support/tickets/${ticketId}/events`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() + attachmentLine }),
      });
      setReply("");
      setFile(null);
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const confirmResolved = async () => {
    setBusy(true);
    try {
      await api(`/api/v1/support/tickets/${ticketId}/confirm`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      await api(`/api/v1/support/tickets/${ticketId}/reopen`, { method: "POST" });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const decideGrant = async (grantId: string, approve: boolean) => {
    setBusy(true);
    try {
      await api(`/api/v1/support/grants/${grantId}/decision`, {
        method: "POST",
        body: JSON.stringify({ approve }),
      });
      setGrants((g) => g.filter((x) => x.id !== grantId));
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !ticket) return <ErrorCard message={error} onRetry={load} />;
  if (!ticket) return <LoadingRows rows={5} />;

  const pill = ticketPill(ticket.status, agentName);
  const hasAgentReply = events.some((e) => e.kind === "agent_reply");
  const showScratchpad = ticket.status === "open" && !hasAgentReply;
  const showAfterHours = isAfterHoursET(ticket.created_at) && !hasAgentReply;
  const canReopen =
    ticket.status === "closed" &&
    ticket.closed_at &&
    Date.now() - new Date(ticket.closed_at).getTime() <= 30 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-star-100">{ticket.subject}</h1>
        <p className="font-mono text-xs text-stardust-500">{ticket.ticket_number}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
          <SlaDisplay slaDueAt={ticket.sla_due_at} slaBreached={ticket.sla_breached} />
          <button
            onClick={() => setHelpOpen(true)}
            className="text-xs text-nova-300 underline"
          >
            What can support see?
          </button>
        </div>
      </div>

      {ticket.teen_privacy && (
        <InfoLine tone="teal" icon="🔒">
          <strong>Private to you.</strong> Your parents aren&apos;t told about this ticket and
          can&apos;t see it. The only exception: if someone&apos;s safety is at risk right now.
          Agents must ask your permission <em>in this thread</em> before looking at your grades or
          health — and every look is logged where you can see it (Settings → Privacy →
          &ldquo;Who&apos;s looked at my stuff&rdquo;).
        </InfoLine>
      )}

      {showAfterHours && (
        <InfoLine icon="🌙">
          It&apos;s after hours — our team is back at 9 AM ET. Your ticket is saved and first in
          line. Leave <strong>notes for the agent</strong> below and they&apos;ll read them first
          thing.
        </InfoLine>
      )}

      {grants.map((g) => (
        <Card key={g.id} className="border-amber-400/30">
          <p className="text-sm font-semibold text-star-100">
            🔑 Support is asking to look at:
          </p>
          <ul className="mt-1.5 space-y-0.5 text-sm text-stardust-200">
            <li>· {SCOPE_LABEL[g.scope] ?? g.scope} ({g.scope})</li>
          </ul>
          {g.purpose && <p className="mt-1 text-[13px] text-stardust-300">Why: &ldquo;{g.purpose}&rdquo;</p>}
          <p className="mt-1.5 text-xs leading-relaxed text-stardust-400">
            Expires automatically in 24 hours. You can take it back anytime in Settings → Privacy.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => decideGrant(g.id, true)} loading={busy}>
              Approve once
            </Button>
            <Button size="sm" variant="ghost" onClick={() => decideGrant(g.id, false)}>
              Deny
            </Button>
          </div>
        </Card>
      ))}

      <div className="space-y-2.5">
        {events.map((e) => {
          if (e.kind === "ai_transcript") {
            return (
              <CollapseRow
                key={e.id}
                title="📎 Chat transcript attached"
                meta={<span className="text-[11px] text-stardust-500">{fmtTime(e.created_at)}</span>}
              >
                <p className="whitespace-pre-line text-[13px]">{e.body}</p>
              </CollapseRow>
            );
          }
          if (e.kind === "system_note" || e.kind === "status_change") {
            return (
              <p key={e.id} className="py-1 text-center text-[11px] tracking-wide text-stardust-500 capitalize">
                {e.body} · {fmtTime(e.created_at)}
              </p>
            );
          }
          const mine = e.author_type === "user";
          return (
            <div key={e.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  mine
                    ? "border border-nova-400/30 bg-nova-500/15"
                    : "border border-teal-400/20 bg-teal-950/40"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-line text-stardust-100">{e.body}</p>
                <p className="mt-1 text-[11px] text-stardust-500">
                  {mine ? "You" : e.author_type === "ai" ? "Pookie AI" : "Support"} · {fmtTime(e.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        {events.length === 0 && (
          <p className="py-6 text-center text-sm text-stardust-400">
            Ticket opened · {fmtTime(ticket.created_at)}
          </p>
        )}
      </div>

      {ticket.status === "resolved" && (
        <Card className="border-amber-400/30">
          <p className="text-sm font-semibold text-star-100">
            {agentName ? `${agentName} thinks` : "Our team thinks"} this is resolved. Is it fixed for you?
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={confirmResolved} loading={busy}>
              Yes, all good ✅
            </Button>
            <Button size="sm" variant="ghost" onClick={reopen} loading={busy}>
              No, still broken
            </Button>
          </div>
          <p className="mt-2 text-xs text-stardust-500">
            No reply in 5 business days? We&apos;ll close it automatically — you can reopen anytime
            within 30 days.
          </p>
        </Card>
      )}

      {showScratchpad && (
        <Card padding="sm">
          <label htmlFor="scratchpad" className="block text-sm font-medium text-star-100">
            Notes for the agent
          </label>
          <p className="mt-0.5 text-xs text-stardust-400">
            Anything the agent should know first? It&apos;ll be the first thing they read.
          </p>
          <textarea
            id="scratchpad"
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
          />
          <div className="mt-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={!scratchpad.trim() || sending}
              loading={sending}
              onClick={() => {
                const note = scratchpad;
                setScratchpad("");
                postMessage(note);
              }}
            >
              Save as a note
            </Button>
          </div>
        </Card>
      )}

      {(ticket.status === "open" || ticket.status === "in_progress") && (
        <div className="space-y-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder={agentName ? `Reply to ${agentName}…` : "Write a reply…"}
            className="w-full rounded-2xl border border-nova-400/25 bg-nebula-900/70 px-3.5 py-2.5 text-sm leading-relaxed text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="image/*,.pdf"
              aria-label="Attach a file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-stardust-400 file:mr-2 file:rounded-lg file:border file:border-nova-400/30 file:bg-nebula-900/70 file:px-2 file:py-1 file:text-xs file:text-star-100"
            />
            <span className="flex-1" />
            <Button size="sm" disabled={!reply.trim() || sending} loading={sending} onClick={() => postMessage(reply)}>
              Send
            </Button>
          </div>
          {error && <InfoLine tone="amber">{error}</InfoLine>}
        </div>
      )}

      {ticket.status === "closed" && (
        <div>
          {canReopen ? (
            <Button variant="ghost" onClick={reopen} loading={busy}>
              Reopen ticket
            </Button>
          ) : (
            <p className="text-xs text-stardust-500">
              Closed {ticket.closed_at ? fmtTime(ticket.closed_at) : ""} · reopen within 30 days if
              it&apos;s not fixed.
            </p>
          )}
        </div>
      )}

      <Sheet
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="What can support see?"
        subtitle="Almost nothing — by design."
      >
        <div className="space-y-2 text-sm leading-relaxed text-stardust-200">
          <p>Support works with almost nothing — your ticket and your words. Not your grades, not your health.</p>
          <p><strong className="text-star-100">Agents can see:</strong> this ticket&apos;s messages and your name.</p>
          <p><strong className="text-star-100">Agents can&apos;t see:</strong> grades, health, check-ins, or messages — unless you approve a one-time, 24-hour peek, right here in the ticket.</p>
          <p><strong className="text-star-100">Every look is logged.</strong> Settings → Privacy → &ldquo;Who&apos;s looked at my stuff.&rdquo;</p>
        </div>
      </Sheet>
    </div>
  );
}
