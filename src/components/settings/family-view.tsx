"use client";

// Settings → Family — parent-only child account management.
// Lists family members (child profiles + linked logins + roles), the
// "invite your child to log in" form, and pending invites with
// resend / revoke. Sending uses the backend's sendChildInvite server
// action (@/lib/tenant/actions); listing/resend/revoke live in
// @/lib/family/actions.

import { useCallback, useEffect, useState } from "react";
import { sendChildInvite } from "@/lib/tenant/actions";
import {
  getFamilyOverview,
  resendChildInvite,
  revokeChildInvite,
} from "@/lib/family/actions";
import type { FamilyMember, PendingInvite } from "@/lib/family/types";
import {
  SettingsCard,
  Field,
  inputClass,
  PrimaryButton,
} from "./settings-ui";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Backend error codes → plain English. */
function inviteErrorMessage(code: string): string {
  switch (code) {
    case "invalid_email":
      return "That email doesn't look right — check it and try again.";
    case "not_signed_in":
      return "You're not signed in — sign in and try again.";
    case "not_parent_of_child":
      return "Only a parent can send invites.";
    case "cannot_invite_self":
      return "Use your child's email — you can't invite your own login.";
    case "duplicate_pending_invite":
      return "There's already a pending invite for that email — see Pending invites below.";
    case "rate_limit_exceeded":
      return "You've sent a lot of invites today — try again tomorrow.";
    case "invite_lookup_failed":
      return "Couldn't check existing invites — try again.";
    case "invite_create_failed":
      return "Couldn't send the invite — check your connection and try again.";
    case "invite_not_available":
      return "That invite isn't available anymore.";
    case "resend_failed":
      return "Couldn't resend the invite — try again.";
    case "revoke_failed":
      return "Couldn't revoke the invite — try again.";
    case "load_failed":
      return "Couldn't load your family — check your connection and try again.";
    default:
      return "Something went wrong — try again.";
  }
}

function RoleBadge({ role }: { role: "parent" | "child" }) {
  const isParent = role === "parent";
  return (
    <span
      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
        isParent
          ? "border-nova-400/40 bg-nova-500/15 text-nova-300"
          : "border-star-100/25 bg-star-100/10 text-stardust-200"
      }`}
    >
      {isParent ? "Parent" : "Child"}
    </span>
  );
}

function Avatar({ member }: { member: FamilyMember }) {
  const name = member.nickname ?? member.firstName;
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={name}
        className="h-11 w-11 rounded-full object-cover shadow-glow-sm"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 items-center justify-center rounded-full bg-nova-500/20 text-lg font-semibold text-nova-200 shadow-glow-sm"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function MemberRow({
  member,
  pendingForChild,
  expanded,
  onToggle,
}: {
  member: FamilyMember;
  pendingForChild: PendingInvite[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const name = member.nickname ?? member.firstName;
  const detail = [member.schoolName, member.gradeLevel ? `Grade ${member.gradeLevel}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
      >
        <Avatar member={member} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-star-100">{name}</span>
          <span className="block truncate text-xs text-stardust-400">
            {detail || "—"} · {member.logins.length} login{member.logins.length === 1 ? "" : "s"}
            {pendingForChild.length > 0 && (
              <span className="text-nova-300"> · {pendingForChild.length} invite pending</span>
            )}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`text-stardust-400 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>
      {expanded && (
        <div className="animate-bloom border-t border-white/8 px-4 py-4">
          <p className="text-xs font-medium tracking-wide text-stardust-400 uppercase">
            Linked logins
          </p>
          {member.logins.length === 0 ? (
            <p className="mt-2 text-sm text-stardust-300">
              No one is linked yet — send an invite below so {name} can log in.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {member.logins.map((login) => (
                <li
                  key={`${login.email}-${login.role}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-star-100">
                      {login.displayName ?? login.email}
                    </span>
                    {login.displayName && (
                      <span className="block truncate text-xs text-stardust-400">{login.email}</span>
                    )}
                  </span>
                  <RoleBadge role={login.role} />
                </li>
              ))}
            </ul>
          )}
          {pendingForChild.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium tracking-wide text-stardust-400 uppercase">
                Waiting on
              </p>
              <ul className="mt-2 space-y-2">
                {pendingForChild.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-nova-400/20 bg-nova-500/8 px-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-star-100">{inv.email}</span>
                      <span className="block text-xs text-stardust-400">
                        Invite expires {formatDate(inv.expiresAt)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-nova-400/30 px-2.5 py-0.5 text-[11px] font-semibold text-nova-300">
                      Invited
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function FamilyView() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [pending, setPending] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Invite form
  const [email, setEmail] = useState("");
  const [childId, setChildId] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [lastVerifyUrl, setLastVerifyUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Per-invite busy + copy state
  const [busyInvite, setBusyInvite] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPending(true);
    setLoadError(null);
    try {
      const result = await getFamilyOverview();
      if (!result.ok) {
        setLoadError(inviteErrorMessage(result.error));
        return;
      }
      setMembers(result.data.members);
      setInvites(result.data.pendingInvites);
    } catch {
      setLoadError(inviteErrorMessage("load_failed"));
    } finally {
      setPending(false);
    }
  }, []);

  // Initial load — same inline-IIFE-with-cancelled pattern as settings-view.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getFamilyOverview();
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(inviteErrorMessage(result.error));
          return;
        }
        setMembers(result.data.members);
        setInvites(result.data.pendingInvites);
      } catch {
        if (!cancelled) setLoadError(inviteErrorMessage("load_failed"));
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inviteLink = (token: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/verify-invite?token=${token}`
      : `/verify-invite?token=${token}`;

  function copyText(text: string, onDone: () => void) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onDone).catch(onDone);
    } else {
      onDone();
    }
  }

  async function handleSend() {
    setNotice(null);
    setLastVerifyUrl(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !childId) {
      setNotice({ kind: "err", text: "Add an email and pick which child this invite is for." });
      return;
    }
    setSending(true);
    try {
      const result = await sendChildInvite(childId, cleanEmail);
      if (!result.ok) {
        setNotice({ kind: "err", text: inviteErrorMessage(result.error) });
        return;
      }
      setLastVerifyUrl(result.verifyUrl);
      setNotice({ kind: "ok", text: `Invitation sent to ${cleanEmail} — they'll need to verify it.` });
      await refresh();
      setEmail("");
    } catch {
      setNotice({ kind: "err", text: inviteErrorMessage("invite_create_failed") });
    } finally {
      setSending(false);
    }
  }

  async function handleResend(invite: PendingInvite) {
    setNotice(null);
    setBusyInvite(invite.id);
    try {
      const result = await resendChildInvite(invite.id);
      if (!result.ok) {
        setNotice({ kind: "err", text: inviteErrorMessage(result.error) });
        return;
      }
      await refresh();
      setNotice({ kind: "ok", text: `Invite re-sent to ${invite.email} — the old link no longer works.` });
    } catch {
      setNotice({ kind: "err", text: inviteErrorMessage("resend_failed") });
    } finally {
      setBusyInvite(null);
    }
  }

  async function handleRevoke(invite: PendingInvite) {
    if (!confirm(`Revoke the invite for ${invite.email}? They won't be able to use that link.`)) return;
    setNotice(null);
    setBusyInvite(invite.id);
    try {
      const result = await revokeChildInvite(invite.id);
      if (!result.ok) {
        setNotice({ kind: "err", text: inviteErrorMessage(result.error) });
        return;
      }
      await refresh();
      setNotice({ kind: "ok", text: `Invite for ${invite.email} revoked.` });
    } catch {
      setNotice({ kind: "err", text: inviteErrorMessage("revoke_failed") });
    } finally {
      setBusyInvite(null);
    }
  }

  if (pending) {
    return (
      <div className="space-y-4" aria-label="Loading family">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-3xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <SettingsCard title="Family">
        <p className="text-sm text-red-300">{loadError}</p>
        <div className="mt-4">
          <PrimaryButton onClick={() => void refresh()}>Try again</PrimaryButton>
        </div>
      </SettingsCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Family members — collapsed rows, expand for logins */}
      <SettingsCard
        title="Family members"
        description="Everyone with a login on each child's account."
      >
        {members.length === 0 ? (
          <p className="text-sm text-stardust-300">
            No children yet — add one from the Profile tab, then invite them to log in below.
          </p>
        ) : (
          <div className="space-y-2.5">
            {members.map((m) => (
              <MemberRow
                key={m.childId}
                member={m}
                pendingForChild={invites.filter((i) => i.childId === m.childId)}
                expanded={!!expanded[m.childId]}
                onToggle={() => setExpanded((e) => ({ ...e, [m.childId]: !e[m.childId] }))}
              />
            ))}
          </div>
        )}
      </SettingsCard>

      {/* Invite form */}
      <SettingsCard
        title="Invite your child to log in"
        description="They'll get a link to verify — once they accept, their login connects to the child you pick."
      >
        <div className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Field label="Their email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kid@example.com"
                className={inputClass}
                autoComplete="email"
              />
            </Field>
            <Field label="Connect to">
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className={`${inputClass} appearance-none`}
              >
                <option value="">Choose a child…</option>
                {members.map((m) => (
                  <option key={m.childId} value={m.childId}>
                    {m.nickname ?? m.firstName}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <PrimaryButton onClick={() => void handleSend()} disabled={sending || members.length === 0}>
            {sending ? "Sending…" : "Send invite"}
          </PrimaryButton>
          {members.length === 0 && (
            <p className="text-xs text-stardust-400">Add a child from the Profile tab first.</p>
          )}
          {lastVerifyUrl && notice?.kind === "ok" && (
            <div className="animate-bloom rounded-2xl border border-nova-400/25 bg-nova-500/8 p-4">
              <p className="text-xs font-medium tracking-wide text-stardust-300 uppercase">
                Share this link with them
              </p>
              <p className="mt-1.5 truncate font-mono text-xs text-nova-200">{lastVerifyUrl}</p>
              <button
                type="button"
                onClick={() =>
                  copyText(lastVerifyUrl, () => {
                    setLinkCopied(true);
                    window.setTimeout(() => setLinkCopied(false), 2000);
                  })
                }
                className="mt-2.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-white/30"
              >
                {linkCopied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
          )}
        </div>
      </SettingsCard>

      {/* Pending invites */}
      <SettingsCard
        title="Pending invites"
        description="Invites that haven't been accepted yet. Links expire after 7 days."
      >
        {invites.length === 0 ? (
          <p className="text-sm text-stardust-300">
            No pending invites — everyone who&apos;s been invited has joined. 🌱
          </p>
        ) : (
          <ul className="space-y-2.5">
            {invites.map((inv) => (
              <li key={inv.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-star-100">{inv.email}</p>
                    <p className="mt-0.5 text-xs text-stardust-400">
                      For {inv.childName} · sent {formatDate(inv.sentAt)} · expires{" "}
                      {formatDate(inv.expiresAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-nova-400/30 bg-nova-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-nova-300">
                    Pending
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      copyText(inviteLink(inv.token), () => {
                        setCopiedId(inv.id);
                        window.setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 2000);
                      })
                    }
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-white/30"
                  >
                    {copiedId === inv.id ? "Copied ✓" : "Copy invite link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResend(inv)}
                    disabled={busyInvite === inv.id}
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-white/30 disabled:opacity-50"
                  >
                    {busyInvite === inv.id ? "Working…" : "Resend"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRevoke(inv)}
                    disabled={busyInvite === inv.id}
                    className="rounded-xl border border-red-400/30 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/10 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      {notice && (
        <p
          role="status"
          className={`animate-bloom rounded-2xl border px-4 py-3 text-sm ${
            notice.kind === "ok"
              ? "border-nova-400/30 bg-nova-500/10 text-nova-200"
              : "border-red-400/30 bg-red-500/10 text-red-300"
          }`}
        >
          {notice.text}
        </p>
      )}
    </div>
  );
}
