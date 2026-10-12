"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/use-theme";

/** Sub-navigation for the settings area. */
export function SettingsTabs({ childSlug, role }: { childSlug: string; role?: "parent" | "child" }) {
  const pathname = usePathname();
  const base = `/c/${childSlug}/settings`;
  const tabs = [
    { label: "Profile", href: base, roles: ["parent", "child"] as const },
    { label: "Family", href: `${base}/family`, roles: ["parent", "child"] as const },
    { label: "Sharing", href: `${base}/sharing`, roles: ["parent", "child"] as const },
    { label: "Sync", href: `${base}/sync`, roles: ["parent"] as const },
    { label: "Workers", href: `${base}/health`, roles: ["parent"] as const },
    { label: "School Logins", href: `${base}/credentials`, roles: ["parent"] as const },
  ].filter((t) => !role || (t.roles as readonly string[]).includes(role));
  return (
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-nova-400/50 bg-nebula-800 text-nova-300 shadow-glow-sm"
                : "border-nova-400/15 bg-nebula-900/60 text-stardust-300 hover:border-nova-400/30 hover:text-star-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Shown when a child-role session reaches a parent-only page. */
export function ParentOnlyNotice() {
  return (
    <main className="mx-auto max-w-2xl px-4 pt-16 pb-8 text-center">
      <p className="text-4xl" aria-hidden="true">🔒</p>
      <h1 className="text-sunlit mt-4 text-2xl font-semibold">Parents Only</h1>
      <p className="mt-2 text-sm leading-relaxed text-stardust-300">
        This area is for the parent account — sync, workers, and school logins live here.
      </p>
    </main>
  );
}

/** Graceful state while the backend workstream is still building an endpoint. */
export function BackendPending({ feature }: { feature: string }) {
  return (
    <div className="card-living rounded-2xl px-5 py-6 text-center">
      <p className="text-sm font-medium text-star-100">{feature} is coming online</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stardust-300">
        The data service for this screen is still being built — check back soon. Nothing is broken.
      </p>
    </div>
  );
}

/** Section shell for settings cards. */
export function SettingsCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card-living animate-bloom rounded-3xl p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-star-100">{title}</h2>
          {description && <p className="mt-1 text-sm text-stardust-300">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Bridge Theme selector — Space Black (default) or Bright Bridge.
 *  Shared by Settings → Profile and child settings. Instant switch,
 *  persists to localStorage via useTheme(). */
export function BridgeThemeSelector() {
  const { theme, setTheme } = useTheme();
  return (
    <SettingsCard
      title="Bridge Theme"
      description="Space Black is the signature look. Bright Bridge lights the whole ship."
    >
      <div className="flex gap-2.5" role="group" aria-label="Bridge theme">
        {(
          [
            { id: "space-black", label: "Space Black", hint: "Deep space black, neon glows" },
            { id: "bright-bridge", label: "Bright Bridge", hint: "Bright, icy, well-lit" },
          ] as const
        ).map((t) => {
          const selected = theme === t.id;
          const darkSwatch = t.id === "space-black";
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              aria-pressed={selected}
              className={`flex flex-1 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition ${
                selected
                  ? "border-cyan-400/60 bg-cyan-400/10 shadow-glow-sm"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-10 w-10 shrink-0 rounded-lg border"
                style={{
                  background: darkSwatch ? "#050510" : "#F4F8FA",
                  borderColor: darkSwatch ? "rgb(0 229 255 / 0.55)" : "rgb(0 184 212 / 0.5)",
                  boxShadow: selected
                    ? darkSwatch
                      ? "0 0 14px rgb(0 229 255 / 0.5)"
                      : "0 0 14px rgb(0 184 212 / 0.45)"
                    : "none",
                }}
              >
                <span
                  className="mx-auto mt-2 block h-1 w-6 rounded-full"
                  style={{ background: darkSwatch ? "rgb(0 229 255 / 0.9)" : "rgb(0 184 212 / 0.85)" }}
                />
                <span
                  className="mx-auto mt-1.5 block h-1 w-4 rounded-full"
                  style={{ background: darkSwatch ? "rgb(0 255 136 / 0.7)" : "rgb(0 200 83 / 0.7)" }}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{t.label}</span>
                <span className="block truncate text-xs text-white/55">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </SettingsCard>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium tracking-wide text-stardust-300 capitalize">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "input-rooted w-full rounded-xl px-3.5 py-2.5 text-sm text-star-100";

export function PrimaryButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl bg-nova-500 px-4 py-2.5 text-sm font-semibold text-nebula-950 shadow-glow-sm transition-all hover:scale-[1.02] hover:shadow-glow-md active:scale-[0.98] disabled:opacity-50 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={`rounded-xl border border-red-400/40 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-50 ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}
