import type { ReactNode } from "react";
import Link from "next/link";

/**
 * Squad Cookie 2026-10-12 — Shared shell for legal/policy pages.
 * Clean, readable, cosmic. Title Case headings, generous line length.
 */
export function PolicyShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="relative mx-auto w-full max-w-3xl px-6 pb-24 pt-12">
      <Link
        href="/"
        className="neon-hover neon-focus inline-block rounded text-sm text-neon-teal"
      >
        &larr; Back To Home
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[0.25em] text-neon-teal/80">
        {eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-white/50">Last Updated: {updated}</p>
      <div className="policy-body mt-8 space-y-8">{children}</div>
      <p className="mt-12 border-t border-white/5 pt-6 text-xs italic text-white/40">
        This page describes our practices and is not legal advice.
      </p>
      <style>{`
        .policy-body h2 { font-size: 1.25rem; font-weight: 600; color: #fff; margin-bottom: 0.75rem; }
        .policy-body p { font-size: 0.95rem; line-height: 1.75; color: rgb(255 255 255 / 0.75); margin-bottom: 0.75rem; }
        .policy-body ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
        .policy-body li { font-size: 0.95rem; line-height: 1.75; color: rgb(255 255 255 / 0.7); margin-bottom: 0.375rem; }
        .policy-body strong { color: #fff; }
        .policy-body a { color: #2dd4bf; text-decoration: underline; text-underline-offset: 4px; }
      `}</style>
    </main>
  );
}
