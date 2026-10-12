// W12 Babysitters — real directory + time-boxed "Share for a bit" grants.
//
// Every profile carries the required micro-label: "parent-vetted, not
// background-checked by Pookie." Teens (13–17) see the directory read-only;
// "Add sitter" is parent-only. Grants POST to Squad 4's grant API (D6
// tiered caps + teen co-approval enforced server-side in
// request_sitter_grant()).

"use client";

import { useEffect, useState } from "react";
import { Button, Card, CollapseRow, InfoLine, Sheet } from "@/components/ui";
import { ErrorCard, LoadingRows, api } from "@/components/travel/travel-shared";

interface Sitter {
  id: string;
  name: string;
  contact: string | null;
  notes: string | null;
  vetting_disclaimer: string;
  created_at: string;
}
interface Grant {
  id: string;
  purpose: string;
  starts_at: string;
  expires_at: string;
  status: string;
  teen_coapproval_status: string;
}

const OCCASIONS = [
  { key: "evening", label: "Evening out", hours: 4 },
  { key: "day", label: "Full day", hours: 8 },
  { key: "weekend", label: "Weekend", hours: 48 },
];

export function BabysittersPanel({
  childId,
  role,
}: {
  childId: string;
  role: "parent" | "child";
}) {
  const isParent = role === "parent";
  const [sitters, setSitters] = useState<Sitter[]>([]);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [error, setError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [howKnown, setHowKnown] = useState("");
  const [saving, setSaving] = useState(false);
  const [grantFor, setGrantFor] = useState<Sitter | null>(null);
  const [grants, setGrants] = useState<Record<string, Grant[]>>({});
  const [occasion, setOccasion] = useState(OCCASIONS[0].key);
  const [granting, setGranting] = useState(false);
  const [grantMsg, setGrantMsg] = useState("");

  const load = () => {
    setState("loading");
    api<{ sitters: Sitter[] }>("/api/v1/household/babysitters")
      .then((d) => {
        setSitters(d.sitters);
        setState("loaded");
      })
      .catch((e: Error) => {
        setError(e.message);
        setState("error");
      });
  };

  useEffect(load, []);

  const loadGrants = (sitterId: string) => {
    api<{ grants: Grant[] }>(`/api/v1/household/babysitters/${sitterId}/grants`)
      .then((d) => setGrants((g) => ({ ...g, [sitterId]: d.grants })))
      .catch(() => {});
  };

  const addSitter = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api("/api/v1/household/babysitters", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          contact: contact.trim() || undefined,
          notes: [notes.trim(), howKnown.trim() ? `How we know them: ${howKnown.trim()}` : ""]
            .filter(Boolean)
            .join("\n"),
        }),
      });
      setAddOpen(false);
      setName("");
      setContact("");
      setNotes("");
      setHowKnown("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const shareForABit = async () => {
    if (!grantFor) return;
    const occ = OCCASIONS.find((o) => o.key === occasion) ?? OCCASIONS[0];
    setGranting(true);
    setGrantMsg("");
    try {
      const starts = new Date();
      const expires = new Date(starts.getTime() + occ.hours * 60 * 60 * 1000);
      const g = await api<{ grant: Grant }>(
        `/api/v1/household/babysitters/${grantFor.id}/grants`,
        {
          method: "POST",
          body: JSON.stringify({
            child_id: childId,
            purpose: occ.label,
            starts_at: starts.toISOString(),
            expires_at: expires.toISOString(),
          }),
        },
      );
      setGrantMsg(
        g.grant.teen_coapproval_status === "required"
          ? "Grant created — waiting on your teen's approval (they're 13–15, so new sitters need their OK)."
          : `Shared until ${expires.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}.`,
      );
      loadGrants(grantFor.id);
    } catch (e) {
      setGrantMsg((e as Error).message);
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-2xl">👶</span>
        <h2 className="text-lg font-semibold text-star-100">Babysitters</h2>
      </div>

      <InfoLine tone="amber" icon="👶">
        <strong>Parent-vetted, not background-checked by Pookie.</strong> Sitters here are added
        and vouched for by parents — Pookie doesn&apos;t run background checks. Always meet first
        and trust your gut.
      </InfoLine>

      {!isParent && (
        <InfoLine>Only a parent can add or change sitters. You can see who&apos;s booked when.</InfoLine>
      )}

      {state === "loading" && <LoadingRows rows={3} />}
      {state === "error" && <ErrorCard message={error} onRetry={load} />}

      {state === "loaded" && sitters.length === 0 && (
        <Card padding="lg" className="text-center">
          <p className="text-sm font-medium text-star-100">No sitters yet.</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-stardust-300">
            Add someone your family trusts — a neighbor, a cousin, a regular.
          </p>
          {isParent && (
            <div className="mt-4">
              <Button onClick={() => setAddOpen(true)}>Add your first sitter</Button>
            </div>
          )}
        </Card>
      )}

      {state === "loaded" && sitters.length > 0 && (
        <div className="space-y-2">
          {sitters.map((s) => (
            <Card key={s.id} padding="sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-star-100">{s.name}</p>
                  {s.contact && <p className="text-xs text-stardust-400">{s.contact}</p>}
                  {s.notes && (
                    <p className="mt-1 text-[13px] leading-relaxed text-stardust-300">{s.notes}</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-stardust-500">
                    Added by you · not background-checked
                  </p>
                </div>
                {isParent && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setGrantFor(s);
                      setGrantMsg("");
                      loadGrants(s.id);
                    }}
                  >
                    Share for a bit
                  </Button>
                )}
              </div>
              {(grants[s.id] ?? []).filter((g) => g.status === "active").length > 0 && (
                <div className="mt-2 border-t border-nova-400/10 pt-2">
                  {(grants[s.id] ?? [])
                    .filter((g) => g.status === "active")
                    .map((g) => (
                      <p key={g.id} className="text-xs text-teal-200">
                        Shared for &ldquo;{g.purpose}&rdquo; · until{" "}
                        {new Date(g.expires_at).toLocaleString("en-US", {
                          weekday: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    ))}
                </div>
              )}
            </Card>
          ))}
          {isParent && (
            <Button variant="ghost" onClick={() => setAddOpen(true)}>
              + Add a sitter
            </Button>
          )}
        </div>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a sitter" subtitle="Someone your family trusts.">
        <div className="space-y-3">
          <InfoLine icon="💡">
            Quick tip: meet a new sitter with your kids home the first time.
          </InfoLine>
          <div>
            <label htmlFor="sitter-name" className="block text-sm font-medium text-star-100">Name</label>
            <input
              id="sitter-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sitter-contact" className="block text-sm font-medium text-star-100">Contact (optional)</label>
            <input
              id="sitter-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Phone or email"
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sitter-known" className="block text-sm font-medium text-star-100">How do you know them? (optional)</label>
            <input
              id="sitter-known"
              value={howKnown}
              onChange={(e) => setHowKnown(e.target.value)}
              placeholder="e.g. Next-door neighbor for 3 years"
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="sitter-notes" className="block text-sm font-medium text-star-100">Notes (optional)</label>
            <textarea
              id="sitter-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Bedtime routine, allergies, house rules…"
              className="mt-1.5 w-full rounded-xl border border-nova-400/25 bg-nebula-950/70 px-3 py-2 text-sm text-star-100 placeholder:text-stardust-500 focus:border-nova-300/60 focus:outline-none"
            />
          </div>
          <Button onClick={addSitter} disabled={!name.trim()} loading={saving}>
            Add sitter
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={grantFor !== null}
        onClose={() => setGrantFor(null)}
        title={`Share ${grantFor?.name ?? ""} for a bit`}
        subtitle="Time-boxed access — expires on its own."
      >
        {grantFor && (
          <div className="space-y-3">
            <p className="text-xs text-stardust-400">
              Sitter basics scope: schedule and logistics, pickup authorization, emergency medical
              card. The emergency card stays available even after expiry.
            </p>
            <div className="flex gap-2" role="radiogroup" aria-label="Occasion">
              {OCCASIONS.map((o) => (
                <button
                  key={o.key}
                  role="radio"
                  aria-checked={occasion === o.key}
                  onClick={() => setOccasion(o.key)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    occasion === o.key
                      ? "border-nova-400/50 bg-nova-500/15 text-star-100"
                      : "border-nova-400/15 bg-nebula-900/50 text-stardust-300"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {grantMsg && <InfoLine>{grantMsg}</InfoLine>}
            <Button onClick={shareForABit} loading={granting}>
              Share for {OCCASIONS.find((o) => o.key === occasion)?.label.toLowerCase()}
            </Button>
            <CollapseRow title="Grant limits (MD D6)">
              <p className="text-xs leading-relaxed">
                Trusted sitters: up to 8 temporary grants per 30 days. First-time sitters: 2 per
                30 days. Teens 13–15 approve new sitters; renewals within the cap are
                notification-only. Grants expire on their own — no awkward &ldquo;take it
                back&rdquo; moment.
              </p>
            </CollapseRow>
          </div>
        )}
      </Sheet>
    </div>
  );
}
