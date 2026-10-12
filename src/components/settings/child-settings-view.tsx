"use client";

// ChildSettingsView — the scoped settings panel for role='child' (ages 13–17).
//
// Scope decisions (Mehedi 2026-10-12, documented in BUILD-LOG):
//   INCLUDED — the child's own controls:
//     • My profile: nickname (own record, real PATCH API), avatar display,
//       school/grade read-only
//     • Check-in reminders: notification prefs (probed; honest pending state
//       if the backend hasn't built them)
//     • Pookie AI: personality/tone picker (localStorage-backed, labeled
//       "on this device" — real local control today)
//     • Session: sign out (real)
//   EXCLUDED — parent-only, never rendered here:
//     • Children add/edit/remove (family management)
//     • DangerZone (account/child data deletion)
//     • School Logins (credentials), Sync console, Worker health
//     • Family invites, sharing grants, other children's data
//   Age tiers: under-13 has no child login by design (N/A); 13–17 get this
//   panel; 18+ graduates via the independence flow → parent role → full panel.

import { useEffect, useState } from "react";
import { signOut } from "@/lib/tenant/actions";
import {
  updateChild,
  getNotificationPrefs,
  ManagementApiError,
  type NotificationPrefs,
} from "@/lib/management-api";
import {
  SettingsCard,
  Field,
  inputClass,
  PrimaryButton,
  DangerButton,
} from "./settings-ui";

type AiTone = "pookie" | "balanced" | "muse";

const AI_TONES: { id: AiTone; name: string; blurb: string }[] = [
  { id: "pookie", name: "Pookie", blurb: "Warm and encouraging — like a friend cheering you on." },
  { id: "balanced", name: "Balanced", blurb: "Friendly but to the point." },
  { id: "muse", name: "Muse", blurb: "Direct and no-fluff — straight answers, fast." },
];

const TONE_STORAGE_KEY = "pookie-ai-tone";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-nova-500 shadow-glow-sm" : "bg-nebula-700"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

function NotWiredYet({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center">
      <p className="text-sm font-medium text-white/70">{feature} isn&apos;t wired up yet</p>
      <p className="mt-1 text-xs text-white/45">
        The backend workstream is still building this service — your data stays put until then.
      </p>
    </div>
  );
}

/** Shimmer skeleton shown while a card's API probe is still in flight. */
function CardSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading settings">
      <div className="h-4 w-1/3 animate-pulse rounded bg-white/10" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-white/[0.06]" />
    </div>
  );
}

/**
 * Tri-state for probed cards: null = probe in flight (show skeleton),
 * true = API live (show fields), false = API absent (show NotWiredYet).
 */
type WiredState = boolean | null;

export function ChildSettingsView({
  childId,
  firstName,
  initialNickname,
  schoolName,
  gradeLevel,
}: {
  childId: string;
  firstName: string;
  initialNickname: string | null;
  schoolName: string | null;
  gradeLevel: string | null;
}) {
  const [nickname, setNickname] = useState(initialNickname ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefsWired, setPrefsWired] = useState<WiredState>(null);

  const [tone, setTone] = useState<AiTone>("pookie");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TONE_STORAGE_KEY);
      if (saved === "pookie" || saved === "balanced" || saved === "muse") setTone(saved);
    } catch {
      /* storage unavailable — default stands */
    }
  }, []);
  function chooseTone(t: AiTone) {
    setTone(t);
    try {
      window.localStorage.setItem(TONE_STORAGE_KEY, t);
    } catch {
      /* best-effort */
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n = await getNotificationPrefs();
        if (!cancelled) {
          setPrefs(n);
          setPrefsWired(true);
        }
      } catch {
        if (!cancelled) setPrefsWired(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveNickname() {
    setSaving(true);
    setNotice(null);
    try {
      await updateChild(childId, { nickname: nickname.trim() || null });
      setNotice("Nickname saved.");
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't save the nickname.");
    } finally {
      setSaving(false);
    }
  }

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    if (!confirm("Sign out of Pookie?")) return;
    setSigningOut(true);
    // Dead-man's switch: if the server action hasn't resolved in 15s,
    // force the login page. Sign-out must never strand the user.
    const fallback = setTimeout(() => {
      window.location.href = "/login";
    }, 15000);
    try {
      await signOut();
    } finally {
      clearTimeout(fallback);
    }
  }

  const displayName = initialNickname ?? firstName;
  const initial = (displayName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-4">
      {/* My profile — own record only */}
      <SettingsCard title="My profile" description="How you show up in your Pookie.">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 items-center justify-center rounded-full border border-nova-400/30 bg-nebula-700 text-2xl font-semibold text-nova-300 shadow-glow-sm"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-star-100">{displayName}</p>
            <p className="text-xs text-stardust-400">
              {[gradeLevel ? `Grade ${gradeLevel}` : null, schoolName].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-1 text-[11px] text-stardust-500">Photo avatars aren&apos;t available yet.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3.5">
          <Field label="Nickname">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputClass}
              placeholder={firstName}
              maxLength={40}
            />
          </Field>
          <PrimaryButton onClick={saveNickname} disabled={saving}>
            {saving ? "Saving…" : "Save nickname"}
          </PrimaryButton>
          {notice && <p className="text-xs text-white/60">{notice}</p>}
        </div>
      </SettingsCard>

      {/* Check-in reminders — probed; skeleton while the probe is in flight */}
      <SettingsCard title="Check-in reminders" description="Nudges for your daily check-in.">
        {prefsWired === null ? (
          <CardSkeleton />
        ) : prefsWired && prefs ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-white/85">Daily check-in reminder</span>
              <Toggle
                checked={Boolean((prefs as unknown as Record<string, unknown>)["checkin_reminder"])}
                onChange={() => setNotice("Reminder preferences are read-only for now.")}
                label="Daily check-in reminder"
              />
            </div>
            <p className="text-xs text-stardust-500">
              Full reminder controls are coming — timing, quiet hours, and per-class nudges.
            </p>
          </div>
        ) : (
          <NotWiredYet feature="Reminder preferences" />
        )}
      </SettingsCard>

      {/* Pookie AI tone — local control, honestly labeled */}
      <SettingsCard
        title="Pookie AI"
        description="How Pookie talks to you. Saved on this device."
      >
        <div className="space-y-2.5" role="radiogroup" aria-label="Pookie AI personality">
          {AI_TONES.map((t) => {
            const selected = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseTone(t.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-nova-400/50 bg-nova-500/10 shadow-glow-sm"
                    : "border-white/10 hover:border-white/25"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${selected ? "bg-nova-400 shadow-glow-sm" : "bg-white/20"}`}
                  />
                  <span className="text-sm font-semibold text-star-100">{t.name}</span>
                </span>
                <span className="mt-0.5 block pl-4 text-xs text-stardust-400">{t.blurb}</span>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Session */}
      <SettingsCard title="Session">
        <DangerButton onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </DangerButton>
      </SettingsCard>

      <p className="px-1 text-center text-xs text-stardust-500">
        Family, billing, and data controls live with your parent — ask them if you need a change there.
      </p>
    </div>
  );
}
