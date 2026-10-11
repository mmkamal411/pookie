"use client";

// School portal credentials — Vault-backed metadata API.
// Backend contract (services/portals.ts):
// GET .../children/[childId]/portals → { data: { portals: PortalMeta[] } }
// POST .../portals { portal_key*, label*, username?, password* } → upsert
//   (no PATCH — save IS the upsert; status resets to "unverified")
// POST .../portals/test { portal_key, username?, password? } → { ok, scope, message }
//   Dual mode: password present = pre-save sanity checks (nothing persisted);
//   password absent = checks the SAVED credential. Neither is a live portal
//   login — the UI must not claim it is.
// DELETE .../portals/[portalKey] → { data: { removed } }
// Security: passwords are write-only inputs, never displayed; the API never
// returns credential values (username comes back masked).

import { useEffect, useState } from "react";
import {
  listPortals,
  savePortal,
  testPortal,
  deletePortal,
  PORTAL_LABEL,
  PORTAL_KEYS,
  ManagementApiError,
  type PortalMeta,
  type PortalKey,
} from "@/lib/management-api";
import { demoPortals } from "@/lib/management-demo";
import { SettingsCard, Field, inputClass, PrimaryButton, BackendPending } from "./settings-ui";

function fmtTime(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PortalRow({
  portal,
  onRemove,
}: {
  portal: PortalMeta;
  onRemove: (key: PortalKey) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  async function remove() {
    if (!confirm(`Remove the saved login for ${portal.label}? This deletes the stored credential.`)) return;
    setRemoving(true);
    try {
      await onRemove(portal.portal_key);
    } finally {
      setRemoving(false);
    }
  }

  async function testSaved() {
    setTesting(true);
    setTestResult(null);
    try {
      // Password absent → checks the SAVED credential (scope: vault_material).
      const { ok, message } = await testPortal(portal.child_id, { portal_key: portal.portal_key });
      setTestResult(ok ? `Saved credential looks good — ${message}` : `Check failed — ${message}`);
    } catch (e) {
      setTestResult(e instanceof ManagementApiError ? e.message : "Couldn't test the credential.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <li className="py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{portal.label}</p>
          <p className="mt-0.5 font-mono text-xs text-white/50">
            {portal.username_masked ?? "no username saved"} · stored ••••••••
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            Last verified {fmtTime(portal.last_verified_at)}
            {portal.consecutive_failures > 0 && (
              <span className="text-rose-300"> · {portal.consecutive_failures} recent failures</span>
            )}
          </p>
          {testResult && <p className="mt-1 text-xs text-white/70">{testResult}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={testSaved}
            disabled={testing}
            className="rounded-xl border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-white/30 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            className="rounded-xl border border-rose-300/25 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-300/50 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove"}
          </button>
        </div>
      </div>
    </li>
  );
}

export function PortalsView({
  childId,
  childName,
  demo,
}: {
  childId: string;
  childName: string;
  demo: boolean;
}) {
  const [portals, setPortals] = useState<PortalMeta[]>(demo ? demoPortals : []);
  const [pending, setPending] = useState(!demo);
  const [loadError, setLoadError] = useState(false);
  const [portalKey, setPortalKey] = useState<PortalKey>("studentvue");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    if (demo) return;
    try {
      const { portals: fresh } = await listPortals(childId);
      setPortals(fresh);
    } catch {
      setLoadError(true);
    } finally {
      setPending(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (demo) return;
      try {
        const { portals: fresh } = await listPortals(childId);
        if (!cancelled) setPortals(fresh);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, childId]);

  async function handleSave() {
    if (!password) {
      setNotice("Enter the password to save this portal login.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      if (demo) {
        setPortals((ps) => {
          const rest = ps.filter((p) => p.portal_key !== portalKey);
          return [
            ...rest,
            {
              id: `portal-demo-${portalKey}`,
              child_id: childId,
              portal_key: portalKey,
              label: PORTAL_LABEL[portalKey],
              username_masked: username ? `${username.slice(0, 1)}••••` : null,
              has_credential: true,
              status: "unverified",
              last_verified_at: null,
              consecutive_failures: 0,
              credentials_updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            },
          ];
        });
      } else {
        await savePortal(childId, {
          portal_key: portalKey,
          label: PORTAL_LABEL[portalKey],
          username: username || undefined,
          password,
        });
        await load();
      }
      setPassword("");
      setNotice(`Saved the ${PORTAL_LABEL[portalKey]} login for ${childName}.`);
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't save the credential.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestBeforeSave() {
    if (!password) {
      setNotice("Enter the password first — the pre-save check runs against what you typed.");
      return;
    }
    setTesting(true);
    setNotice(null);
    try {
      if (demo) {
        setNotice(`Pre-save check passed for ${PORTAL_LABEL[portalKey]} (demo). Nothing was stored.`);
      } else {
        // Password present → pre_save sanity checks only, nothing persisted.
        const { ok, message } = await testPortal(childId, {
          portal_key: portalKey,
          username: username || undefined,
          password,
        });
        setNotice(
          ok
            ? `Pre-save check passed — ${message} (nothing stored yet; this is not a live portal login).`
            : `Pre-save check failed — ${message}`
        );
      }
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't test the credential.");
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove(key: PortalKey) {
    if (demo) {
      setPortals((ps) => ps.filter((p) => p.portal_key !== key));
      return;
    }
    try {
      await deletePortal(childId, key);
      await load();
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't remove the credential.");
    }
  }

  if (pending) {
    return (
      <div className="space-y-4" aria-label="Loading credentials">
        {[0, 1].map((i) => (
          <div key={i} className="card-living h-44 animate-pulse rounded-3xl" />
        ))}
      </div>
    );
  }
  if (loadError) return <BackendPending feature="School credentials" />;

  const savedKeys = new Set(portals.map((p) => p.portal_key));

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Saved logins"
        description="Passwords are write-only — they're never shown, only replaced. Saving overwrites the previous credential."
      >
        {portals.length === 0 ? (
          <p className="text-sm text-white/60">No school logins saved for {childName} yet.</p>
        ) : (
          <ul className="divide-y divide-white/8">
            {portals.map((p) => (
              <PortalRow key={p.id} portal={p} onRemove={handleRemove} />
            ))}
          </ul>
        )}
      </SettingsCard>

      <SettingsCard title="Add or replace a login" description={`For ${childName}.`}>
        <div className="space-y-3.5">
          <Field label="Portal">
            <select
              value={portalKey}
              onChange={(e) => setPortalKey(e.target.value as PortalKey)}
              className={inputClass}
            >
              {PORTAL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PORTAL_LABEL[k]}
                  {savedKeys.has(k) ? " (saved — saving replaces it)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Username">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              placeholder="School username"
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass}
            />
          </Field>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleTestBeforeSave}
              disabled={testing}
              className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-white/30 disabled:opacity-50"
            >
              {testing ? "Checking…" : "Test before saving"}
            </button>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save login"}
            </PrimaryButton>
          </div>
          {notice && <p className="text-xs text-white/60">{notice}</p>}
          <p className="text-xs text-white/40">
            The pre-save check validates what you typed without storing anything — and it is not a
            live portal login.
          </p>
        </div>
      </SettingsCard>
    </div>
  );
}
