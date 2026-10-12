"use client";

// Settings home — profile, children, notifications, sign out.
// Backend contract (services/children.ts):
// GET /api/v1/children → { data: ChildSummary[] } (camelCase)
// POST /api/v1/children { firstName*, lastName*, ... } → { data: { id } }
// PATCH /api/v1/children/[childId] (camelCase fields) · DELETE → soft archive.
// Profile (/me) + notifications are NOT BUILT yet — those cards render honest
// per-card pending states; the children section works against the real API.

import { useEffect, useState } from "react";
import { signOut } from "@/lib/tenant/actions";
import {
  listChildren,
  getChild,
  createChild,
  updateChild,
  deleteChild,
  getProfile,
  updateProfile,
  getNotificationPrefs,
  updateNotificationPrefs,
  ManagementApiError,
  type Profile,
  type ChildSummary,
  type NotificationPrefs,
} from "@/lib/management-api";
import {
  SettingsCard,
  Field,
  inputClass,
  PrimaryButton,
  DangerButton,
} from "./settings-ui";
import { DangerZone } from "@/components/account/danger-zone";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? "bg-nova-500" : "bg-nebula-700"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-6" : "left-1"}`}
      />
    </button>
  );
}

/** Inline "not wired yet" state for cards whose API doesn't exist. */
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

/** Shimmer skeleton shown while a card's API probe is still in flight.
 *  Never show "not wired up yet" before the probe resolves — that's the
 *  flash-of-wrong-content the tri-state below eliminates. */
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
 * A plain boolean defaults to false and flashes the wrong state.
 */
type WiredState = boolean | null;

export function SettingsView() {
  // Children — real API.
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [childrenPending, setChildrenPending] = useState(true);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  // Profile + notifications — probed; tri-state so the UI never flashes
  // "not wired up yet" while the probe is still in flight.
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [profileWired, setProfileWired] = useState<WiredState>(null);
  const [prefsWired, setPrefsWired] = useState<WiredState>(null);

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Child form state
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", nickname: "", schoolName: "", gradeLevel: "", dateOfBirth: "" });
  const [nameDraft, setNameDraft] = useState("");

  const reloadChildren = async () => {
    const fresh = await listChildren();
    setChildren(fresh);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Children: real. Profile/notifications: probe — the backend hasn't
      // built them yet; a "not_built" failure flips the per-card state.
      try {
        const fresh = await listChildren();
        if (!cancelled) setChildren(fresh);
      } catch (e) {
        if (!cancelled)
          setChildrenError(e instanceof ManagementApiError ? e.message : "Couldn't load children.");
      } finally {
        if (!cancelled) setChildrenPending(false);
      }
      try {
        const p = await getProfile();
        if (!cancelled) {
          setProfile(p);
          setProfileWired(true);
          setNameDraft(p.name ?? "");
        }
      } catch {
        if (!cancelled) setProfileWired(false);
      }
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

  async function saveProfile() {
    if (!profileWired) return;
    setSaving(true);
    setNotice(null);
    try {
      const updated = await updateProfile({ name: nameDraft });
      setProfile(updated);
      setNotice("Profile saved.");
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't save the profile.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePref(key: keyof NotificationPrefs, value: boolean) {
    if (!prefs || !prefsWired) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value });
    try {
      await updateNotificationPrefs({ [key]: value });
    } catch {
      setPrefs(prev);
      setNotice("Couldn't save that preference — try again.");
    }
  }

  async function setQuietHours(key: "quiet_hours_start" | "quiet_hours_end", value: string) {
    if (!prefs || !prefsWired) return;
    const prev = prefs;
    setPrefs({ ...prefs, [key]: value || null });
    try {
      await updateNotificationPrefs({ [key]: value || null });
    } catch {
      setPrefs(prev);
      setNotice("Couldn't save quiet hours — try again.");
    }
  }

  function openAdd() {
    setForm({ firstName: "", lastName: "", nickname: "", schoolName: "", gradeLevel: "", dateOfBirth: "" });
    setEditingId(null);
    setShowAdd(true);
  }

  async function openEdit(child: ChildSummary) {
    setNotice(null);
    try {
      // Fetch full detail — ChildSummary lacks lastName.
      const detail = await getChild(child.id);
      setForm({
        firstName: detail?.firstName ?? child.firstName,
        lastName: detail?.lastName ?? "",
        nickname: child.nickname ?? "",
        schoolName: child.schoolName ?? "",
        gradeLevel: child.gradeLevel ?? "",
        dateOfBirth: "",
      });
    } catch {
      // Fall back to summary fields if the detail fetch fails.
      setForm({
        firstName: child.firstName,
        lastName: "",
        nickname: child.nickname ?? "",
        schoolName: child.schoolName ?? "",
        gradeLevel: child.gradeLevel ?? "",
        dateOfBirth: "",
      });
    }
    setEditingId(child.id);
    setShowAdd(true);
  }

  async function saveChild() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setNotice("First and last name are required.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (editingId) {
        await updateChild(editingId, {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          nickname: form.nickname.trim() || null,
          schoolName: form.schoolName.trim() || null,
          gradeLevel: form.gradeLevel.trim() || null,
        });
        await reloadChildren();
      } else {
        await createChild({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          nickname: form.nickname.trim() || null,
          schoolName: form.schoolName.trim() || null,
          gradeLevel: form.gradeLevel.trim() || null,
          dateOfBirth: form.dateOfBirth || null,
        });
        await reloadChildren();
      }
      setShowAdd(false);
      setEditingId(null);
      setNotice(editingId ? "Child updated." : "Child added.");
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't save the child.");
    } finally {
      setSaving(false);
    }
  }

  async function removeChild(child: ChildSummary) {
    const name = child.nickname ?? child.firstName;
    if (!confirm(`Remove ${name}? This archives the child — history is preserved and it can be restored.`)) return;
    setNotice(null);
    try {
      await deleteChild(child.id);
      await reloadChildren();
      setNotice(`${name} archived.`);
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't remove the child.");
    }
  }

  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    if (!confirm("Sign out of Pookie?")) return;
    setSigningOut(true);
    // Dead-man's switch: if the server action hasn't resolved in 15s
    // (it shouldn't — it has its own 8s timeout), force the login page.
    // Sign-out must never leave the user on a dead screen.
    const fallback = setTimeout(() => {
      window.location.href = "/login";
    }, 15000);
    try {
      await signOut();
    } finally {
      clearTimeout(fallback);
    }
  }

  return (
    <div className="space-y-4">
      {/* Profile — probed; skeleton while the probe is in flight */}
      <SettingsCard title="Profile">
        {profileWired === null ? (
          <CardSkeleton />
        ) : profileWired && profile ? (
          <div className="space-y-3.5">
            <Field label="Email">
              <input type="email" value={profile.email} disabled className={`${inputClass} opacity-60`} />
            </Field>
            <Field label="Name">
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className={inputClass}
              />
            </Field>
            <PrimaryButton onClick={saveProfile} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </PrimaryButton>
          </div>
        ) : (
          <NotWiredYet feature="Profile editing" />
        )}
      </SettingsCard>

      {/* Children — real API */}
      <SettingsCard
        title="Children"
        description="Everyone in your family workspace."
        action={
          <button
            type="button"
            onClick={openAdd}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/85 transition hover:border-white/30"
          >
            + Add child
          </button>
        }
      >
        {childrenPending ? (
          <div className="space-y-2.5" aria-label="Loading children">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : childrenError ? (
          <p className="text-sm text-rose-200/80">{childrenError}</p>
        ) : children.length === 0 ? (
          <p className="text-sm text-white/60">No children yet — add your first below.</p>
        ) : (
          <ul className="divide-y divide-white/8">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {c.nickname ?? c.firstName}
                  </p>
                  <p className="text-xs text-white/50">
                    {[c.schoolName, c.gradeLevel ? `Grade ${c.gradeLevel}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeChild(c)}
                    className="rounded-xl border border-rose-300/25 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-300/50"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {showAdd && (
          <div className="mt-4 space-y-3.5 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="First name *">
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className={inputClass}
                  placeholder="Dawson"
                />
              </Field>
              <Field label="Last name *">
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className={inputClass}
                  placeholder="Kamal"
                />
              </Field>
            </div>
            <Field label="Nickname">
              <input
                type="text"
                value={form.nickname}
                onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3.5">
              <Field label="School">
                <input
                  type="text"
                  value={form.schoolName}
                  onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                  className={inputClass}
                  placeholder="Walton High School"
                />
              </Field>
              <Field label="Grade level">
                <input
                  type="text"
                  value={form.gradeLevel}
                  onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
                  className={inputClass}
                  placeholder="10"
                />
              </Field>
            </div>
            {!editingId && (
              <Field label="Birthdate">
                <input
                  type="date"
                  value={form.dateOfBirth}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className={inputClass}
                />
                <p className="mt-1 text-xs text-white/45">
                  Sets the right age protections — under 13, teen, or adult.
                </p>
              </Field>
            )}
            <div className="flex gap-2.5">
              <PrimaryButton onClick={saveChild} disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Add child"}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditingId(null);
                }}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/30"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {notice && <p className="mt-3 text-xs text-white/60">{notice}</p>}
      </SettingsCard>

      {/* Notifications — probed; skeleton while the probe is in flight */}
      <SettingsCard title="Notifications" description="What Pookie tells you about, and when.">
        {prefsWired === null ? (
          <CardSkeleton />
        ) : prefsWired && prefs ? (
          <div className="space-y-3">
            {(
              [
                ["sync_complete", "Sync finished"],
                ["grade_drop", "Grade dropped below 90"],
                ["due_soon", "Assignment due soon"],
                ["weekly_digest", "Weekly digest"],
              ] as [keyof NotificationPrefs, string][]
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-white/85">{label}</span>
                <Toggle
                  checked={Boolean(prefs[key])}
                  onChange={(v) => togglePref(key, v)}
                  label={label}
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <Field label="Quiet hours start">
                <input
                  type="time"
                  value={prefs.quiet_hours_start ?? ""}
                  onChange={(e) => setQuietHours("quiet_hours_start", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Quiet hours end">
                <input
                  type="time"
                  value={prefs.quiet_hours_end ?? ""}
                  onChange={(e) => setQuietHours("quiet_hours_end", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        ) : (
          <NotWiredYet feature="Notification preferences" />
        )}
      </SettingsCard>

      {/* Sign out */}
      <SettingsCard title="Session">
        <DangerButton onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </DangerButton>
      </SettingsCard>

      {/* Self-service account deletion */}
      <DangerZone childCount={children.length} />
    </div>
  );
}
