"use client";

// School Logins tab — portal credential management in command-center dress.
// ParentVUE, StudentVUE, CTLS Learn, Microsoft 365 school login: connection
// status per portal, test-connection buttons, secure credential entry.
// Passwords are write-only inputs — NEVER displayed, never returned by the API.

import { useCallback, useEffect, useState } from "react";
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
import { CommandShell, ConsoleError } from "./command-shell";
import { StatusLight } from "./gear";

type PortalHealth = "connected" | "attention" | "missing";

function portalHealth(p: PortalMeta | undefined): PortalHealth {
  if (!p || !p.has_credential) return "missing";
  if (p.consecutive_failures > 0) return "attention";
  return "connected";
}

const HEALTH_META: Record<PortalHealth, { color: "emerald" | "amber" | "slate"; label: string }> = {
  connected: { color: "emerald", label: "Connected" },
  attention: { color: "amber", label: "Needs Attention" },
  missing: { color: "slate", label: "Not Configured" },
};

function fmtTime(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function PortalCard({
  portalKey,
  portal,
  onChanged,
}: {
  portalKey: PortalKey;
  portal: PortalMeta | undefined;
  onChanged: () => void;
}) {
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const health = portalHealth(portal);
  const meta = HEALTH_META[health];

  async function testSaved() {
    setTesting(true);
    setResult(null);
    try {
      const { ok, message } = await testPortal(portal!.child_id, { portal_key: portalKey });
      setResult(ok ? `Check passed — ${message}` : `Check failed — ${message}`);
    } catch (e) {
      setResult(e instanceof ManagementApiError ? e.message : "Couldn't test the credential.");
    } finally {
      setTesting(false);
    }
  }

  async function remove() {
    if (!confirm(`Remove the saved login for ${PORTAL_LABEL[portalKey]}? This deletes the stored credential.`)) return;
    setRemoving(true);
    try {
      await deletePortal(portal!.child_id, portalKey);
      onChanged();
    } catch (e) {
      setResult(e instanceof ManagementApiError ? e.message : "Couldn't remove the credential.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <article className="rounded-2xl border border-white/10 bg-black/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">{PORTAL_LABEL[portalKey]}</h3>
          <p className="mt-1 font-mono text-xs text-white/50">
            {portal?.username_masked ?? "no username saved"} · stored ••••••••
          </p>
          <p className="mt-0.5 text-xs text-white/40">
            Last verified {fmtTime(portal?.last_verified_at ?? null)}
            {portal && portal.consecutive_failures > 0 && (
              <span className="text-amber-300"> · {portal.consecutive_failures} recent failures</span>
            )}
          </p>
        </div>
        <StatusLight color={meta.color} pulse={health === "connected"} label={meta.label} />
      </div>
      {result && <p className="mt-2 font-mono text-[11px] text-white/65">▸ {result}</p>}
      <div className="mt-3 flex gap-2">
        {portal?.has_credential ? (
          <>
            <button
              type="button"
              onClick={() => void testSaved()}
              disabled={testing}
              className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-medium text-cyan-200 transition hover:border-cyan-300/60 disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test Connection"}
            </button>
            <button
              type="button"
              onClick={() => void remove()}
              disabled={removing}
              className="rounded-xl border border-rose-300/25 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-300/50 disabled:opacity-50"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </>
        ) : (
          <p className="text-xs text-white/40">Add it below to bring this portal online.</p>
        )}
      </div>
    </article>
  );
}

const inputCls =
  "w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 font-mono text-sm text-white placeholder:text-white/30 focus:border-cyan-300/60 focus:outline-none";

export function LoginsView({ childId, childName }: { childId: string; childName: string }) {
  const [portals, setPortals] = useState<PortalMeta[]>([]);
  const [pending, setPending] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [portalKey, setPortalKey] = useState<PortalKey>("studentvue");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const { portals: fresh } = await listPortals(childId);
      setPortals(fresh);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setPending(false);
    }
  }, [childId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!password) {
      setNotice("Enter the password to save this portal login.");
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      await savePortal(childId, {
        portal_key: portalKey,
        label: PORTAL_LABEL[portalKey],
        username: username || undefined,
        password,
      });
      setPassword("");
      await load();
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
      const { ok, message } = await testPortal(childId, {
        portal_key: portalKey,
        username: username || undefined,
        password,
      });
      setNotice(
        ok
          ? `Pre-save check passed — ${message} (nothing stored yet; this is not a live portal login).`
          : `Pre-save check failed — ${message}`,
      );
    } catch (e) {
      setNotice(e instanceof ManagementApiError ? e.message : "Couldn't test the credential.");
    } finally {
      setTesting(false);
    }
  }

  const byKey = new Map(portals.map((p) => [p.portal_key, p]));

  return (
    <CommandShell
      eyebrow="Ship Systems // Credential Vault"
      title="School Logins"
      subtitle="Portal credentials for the sync workers. Passwords are write-only — never displayed."
    >
      {pending ? (
        <div className="grid gap-3 sm:grid-cols-2" aria-label="Loading portals">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
          ))}
        </div>
      ) : loadError ? (
        <ConsoleError
          title="Couldn't reach the credential vault"
          message={loadError}
          onRetry={() => {
            setPending(true);
            void load();
          }}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {PORTAL_KEYS.map((k) => (
              <PortalCard key={k} portalKey={k} portal={byKey.get(k)} onChanged={() => void load()} />
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-300/15 bg-black/40 p-4">
            <p className="font-mono text-[11px] tracking-widest text-cyan-300/70">Add / Update Login</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Portal</span>
                <select
                  value={portalKey}
                  onChange={(e) => setPortalKey(e.target.value as PortalKey)}
                  className={inputCls}
                >
                  {PORTAL_KEYS.map((k) => (
                    <option key={k} value={k} className="bg-black">
                      {PORTAL_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="optional"
                  autoComplete="off"
                  className={inputCls}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-white/50">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="write-only, never shown"
                  autoComplete="new-password"
                  className={inputCls}
                />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-xl bg-cyan-400/90 px-4 py-2 text-xs font-semibold text-black transition hover:bg-cyan-300 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Login"}
              </button>
              <button
                type="button"
                onClick={() => void handleTestBeforeSave()}
                disabled={testing}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-medium text-white/75 transition hover:border-white/30 disabled:opacity-50"
              >
                {testing ? "Checking…" : "Test Before Saving"}
              </button>
            </div>
            {notice && <p className="mt-2.5 font-mono text-[11px] leading-relaxed text-white/65">▸ {notice}</p>}
          </div>
        </>
      )}
    </CommandShell>
  );
}
