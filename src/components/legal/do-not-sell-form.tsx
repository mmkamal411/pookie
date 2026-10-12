"use client";

/**
 * Squad Gavel 2026-10-12 — Do Not Sell / Share request form.
 *
 * Detects navigator.globalPrivacyControl and treats an active GPC signal as
 * an automatic opt-out (no form submission needed). The form POSTs to
 * /api/v1/privacy/do-not-sell, which validates and logs the request and
 * returns a confirmation reference number.
 */
import { useEffect, useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function DoNotSellForm() {
  const [gpc, setGpc] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState("do-not-sell");
  const [status, setStatus] = useState<Status>("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const nav = window.navigator as Navigator & {
        globalPrivacyControl?: boolean;
      };
      setGpc(nav.globalPrivacyControl === true);
    } catch {
      setGpc(false);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/v1/privacy/do-not-sell", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, requestType }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Request failed.");
      setReference(json.data.reference as string);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit.");
      setStatus("error");
    }
  };

  if (gpc === true) {
    return (
      <section className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
        <h2 className="!mb-2 text-lg font-semibold text-emerald-200">
          Global Privacy Control Detected
        </h2>
        <p className="text-sm text-white/70">
          Your browser is sending a Global Privacy Control signal. We honor it
          automatically — your do-not-sell preference is already active. No
          form needed.
        </p>
      </section>
    );
  }

  if (status === "done" && reference) {
    return (
      <section className="rounded-2xl border border-emerald-400/25 bg-emerald-500/5 p-5">
        <h2 className="!mb-2 text-lg font-semibold text-emerald-200">
          Request Recorded
        </h2>
        <p className="text-sm text-white/70">
          Your preference has been recorded and will be applied going forward.
          Your confirmation reference is{" "}
          <strong className="text-white">{reference}</strong>. Keep it for your
          records.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="!mb-4 text-lg font-semibold text-white">
        Submit An Opt-Out Request
      </h2>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label
            htmlFor="dns-name"
            className="mb-1 block text-sm font-medium text-white/80"
          >
            Full Name
          </label>
          <input
            id="dns-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="neon-focus w-full rounded-xl border border-white/10 bg-nebula-900/70 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            placeholder="Your name"
          />
        </div>
        <div>
          <label
            htmlFor="dns-email"
            className="mb-1 block text-sm font-medium text-white/80"
          >
            Email Address
          </label>
          <input
            id="dns-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="neon-focus w-full rounded-xl border border-white/10 bg-nebula-900/70 px-4 py-2.5 text-sm text-white placeholder:text-white/30"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="dns-type"
            className="mb-1 block text-sm font-medium text-white/80"
          >
            Request Type
          </label>
          <select
            id="dns-type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            className="neon-focus w-full rounded-xl border border-white/10 bg-nebula-900/70 px-4 py-2.5 text-sm text-white"
          >
            <option value="do-not-sell">
              Do not sell or share my personal information
            </option>
            <option value="limit-sensitive">
              Limit the use of my sensitive personal information
            </option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={status === "sending"}
          className="rounded-xl bg-teal-400/90 px-5 py-2.5 text-sm font-semibold text-nebula-950 transition hover:bg-teal-300 disabled:opacity-50"
        >
          {status === "sending" ? "Submitting…" : "Submit Request"}
        </button>
        <p className="text-xs text-white/40">
          We will verify your identity by email before applying this request to
          an account.
        </p>
      </form>
    </section>
  );
}
