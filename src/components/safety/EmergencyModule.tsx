"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  errorMessage,
  missingActions,
  type ActionPlan,
  type ActionPlanKind,
  type BreakGlassGrant,
  type EmergencyMedical,
  type EmergencyResource,
  type LabClass,
  type SafetyActions,
  type TrustedAdult,
} from "./types";
import {
  Field,
  FormError,
  FullPageFlow,
  LoadingState,
  PrimaryButton,
  QuietButton,
  inputClass,
} from "./ui";

/* W19 Emergency — storage-only, never a response service.
   Break-glass card uses high-contrast boring-system styling (readable to a
   stranger, not Nebula-pretty). D7: location shown is the general area
   (city/ZIP) only — never precise. */

const BREAK_GLASS_FIELDS = [
  { id: "name", label: "Name" },
  { id: "contact", label: "Emergency contact (trusted adult)" },
  { id: "blood", label: "Blood type" },
  { id: "allergies", label: "Top 3 allergies" },
  { id: "area", label: "General area (city only)" },
] as const;

export function EmergencyModule({
  childProfileId,
  teenName,
  regionCode,
  actions,
}: {
  childProfileId: string;
  teenName: string;
  regionCode: string;
  actions?: SafetyActions;
}) {
  return (
    <FullPageFlow wide>
      <p className="text-sm font-medium text-nova-300">Emergency</p>
      <h1 className="mt-2 text-2xl font-semibold text-star-100">
        Pookie is not an emergency service. In an emergency, call 911 first, then use this page.
      </h1>
      <p className="mt-2 text-sm text-stardust-300">
        Your info, ready when you need it. Not a replacement for 911.
      </p>
      <div className="mt-6 space-y-8">
        <ResourceList regionCode={regionCode} actions={actions} />
        <MedicalCard
          childProfileId={childProfileId}
          teenName={teenName}
          actions={actions}
        />
        <LabQuickCards childProfileId={childProfileId} actions={actions} />
        <ActionPlans childProfileId={childProfileId} actions={actions} />
      </div>
    </FullPageFlow>
  );
}

function ResourceList({
  regionCode,
  actions,
}: {
  regionCode: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [resources, setResources] = useState<EmergencyResource[] | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.getEmergencyResources(regionCode);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setResources(res.data.resources);
        setVerifiedAt(res.data.verifiedAt);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionCode, reloadKey]);

  function retryResources() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <section aria-label="Emergency numbers">
      <h2 className="text-lg font-semibold text-star-100">Numbers that help</h2>
      {error ? (
        <div className="mt-3 space-y-3">
          <FormError message={error} onRetry={retryResources} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <a
              href="tel:911"
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-white text-lg font-bold text-slate-900"
            >
              Call 911
            </a>
            <a
              href="tel:988"
              className="flex min-h-[56px] items-center justify-center rounded-2xl bg-white text-lg font-bold text-slate-900"
            >
              Call or text 988
            </a>
          </div>
        </div>
      ) : resources === null ? (
        <div className="mt-3">
          <LoadingState label="Loading emergency numbers…" />
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {resources.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 text-slate-900"
            >
              <div className="min-w-0">
                <p className="text-[15px] font-bold">{r.name}</p>
                <p className="text-sm text-slate-600">{r.detail}</p>
                {r.note ? <p className="text-xs text-slate-500">{r.note}</p> : null}
              </div>
              <div className="flex shrink-0 gap-2">
                {r.tel ? (
                  <a
                    href={`tel:${r.tel}`}
                    className="flex min-h-[48px] min-w-[88px] items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white"
                  >
                    Call
                  </a>
                ) : null}
                {r.sms ? (
                  <a
                    href={`sms:${r.sms}${r.smsBody ? `?body=${encodeURIComponent(r.smsBody)}` : ""}`}
                    className="flex min-h-[48px] min-w-[88px] items-center justify-center rounded-xl border-2 border-slate-900 px-4 text-sm font-bold text-slate-900"
                  >
                    Text
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      {verifiedAt ? (
        <p className="mt-2 text-xs text-stardust-500">
          Numbers verified{" "}
          {new Date(verifiedAt).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          . If one doesn&apos;t work, call 911.
        </p>
      ) : null}
    </section>
  );
}

function MedicalCard({
  childProfileId,
  teenName,
  actions,
}: {
  childProfileId: string;
  teenName: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [medical, setMedical] = useState<EmergencyMedical | null | undefined>(undefined);
  const [adults, setAdults] = useState<TrustedAdult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [m, t] = await Promise.all([
          a.getEmergencyMedical(childProfileId),
          a.listTrustedAdults(childProfileId),
        ]);
        if (cancelled) return;
        if (!m.ok) {
          setError(errorMessage(m.error));
          return;
        }
        setMedical(m.data);
        if (t.ok) setAdults(t.data.filter((x) => x.verificationStatus === "verified"));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshMedical() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <section aria-label="Emergency medical info">
      <h2 className="text-lg font-semibold text-star-100">Emergency Info</h2>
      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={refreshMedical} />
        </div>
      ) : medical === undefined ? (
        <div className="mt-3">
          <LoadingState label="Loading emergency info…" />
        </div>
      ) : (
        <div className="mt-3 space-y-4">
          <MedicalForm
            initial={medical}
            teenName={teenName}
            childProfileId={childProfileId}
            actions={a}
            onSaved={refreshMedical}
          />
          <BreakGlassGenerator
            childProfileId={childProfileId}
            teenName={teenName}
            medical={medical}
            adults={adults}
            actions={a}
          />
        </div>
      )}
    </section>
  );
}

function listToText(list: string[]): string {
  return list.join(", ");
}

function textToList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function MedicalForm({
  initial,
  teenName,
  childProfileId,
  actions,
  onSaved,
}: {
  initial: EmergencyMedical | null;
  teenName: string;
  childProfileId: string;
  actions: SafetyActions;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!initial);
  const [bloodType, setBloodType] = useState(initial?.bloodType ?? "");
  const [allergies, setAllergies] = useState(listToText(initial?.allergies ?? []));
  const [conditions, setConditions] = useState(listToText(initial?.conditions ?? []));
  const [medications, setMedications] = useState(listToText(initial?.medications ?? []));
  const [doctorName, setDoctorName] = useState(initial?.doctorName ?? "");
  const [doctorPhone, setDoctorPhone] = useState(initial?.doctorPhone ?? "");
  const [homeArea, setHomeArea] = useState(initial?.homeArea ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.saveEmergencyMedical(childProfileId, {
        bloodType: bloodType.trim() || null,
        allergies: textToList(allergies),
        conditions: textToList(conditions),
        medications: textToList(medications),
        doctorName: doctorName.trim() || null,
        doctorPhone: doctorPhone.trim() || null,
        insuranceNote: initial?.insuranceNote ?? null,
        homeArea: homeArea.trim() || null,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("save_failed"));
    }
    setBusy(false);
  }

  if (!editing && initial) {
    return (
      <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-star-100">{teenName}&apos;s emergency info</h3>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-[44px] rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100"
          >
            Edit
          </button>
        </div>
        <dl className="mt-3 space-y-1.5 text-[15px] text-stardust-200">
          {initial.bloodType ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">Blood type</dt>
              <dd className="font-medium text-star-100">{initial.bloodType}</dd>
            </div>
          ) : null}
          {initial.allergies.length > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">Allergies</dt>
              <dd className="text-right font-medium text-star-100">{listToText(initial.allergies)}</dd>
            </div>
          ) : null}
          {initial.conditions.length > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">Conditions</dt>
              <dd className="text-right font-medium text-star-100">{listToText(initial.conditions)}</dd>
            </div>
          ) : null}
          {initial.medications.length > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">Medications</dt>
              <dd className="text-right font-medium text-star-100">{listToText(initial.medications)}</dd>
            </div>
          ) : null}
          {initial.doctorName ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">Doctor</dt>
              <dd className="text-right font-medium text-star-100">
                {initial.doctorName}
                {initial.doctorPhone ? ` · ${initial.doctorPhone}` : ""}
              </dd>
            </div>
          ) : null}
          {initial.homeArea ? (
            <div className="flex justify-between gap-4">
              <dt className="text-stardust-300">General area</dt>
              <dd className="text-right font-medium text-star-100">{initial.homeArea}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-stardust-500">
          Only you can see and change this. The break-glass card below shares only what you pick.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-5">
      <h3 className="text-base font-semibold text-star-100">
        {initial ? "Edit emergency info" : "Set up your emergency info"}
      </h3>
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Blood type">
            <input
              className={inputClass}
              placeholder="O+, A-, …"
              value={bloodType}
              onChange={(e) => setBloodType(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="General area (city or ZIP only)">
            <input
              className={inputClass}
              placeholder="Marietta, 30067"
              value={homeArea}
              onChange={(e) => setHomeArea(e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
        <Field label="Allergies (comma separated)">
          <input
            className={inputClass}
            placeholder="Peanuts, penicillin"
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Conditions (comma separated)">
          <input
            className={inputClass}
            placeholder="Asthma"
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Field label="Medications (comma separated)">
          <input
            className={inputClass}
            placeholder="Albuterol inhaler"
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Doctor name">
            <input
              className={inputClass}
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Doctor phone">
            <input
              className={inputClass}
              value={doctorPhone}
              onChange={(e) => setDoctorPhone(e.target.value)}
              inputMode="tel"
              autoComplete="off"
            />
          </Field>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-stardust-500">
        Pookie never stores your exact location, only your general area.
      </p>
      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={() => void save()} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        <PrimaryButton onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save emergency info"}
        </PrimaryButton>
        {initial ? <QuietButton onClick={() => setEditing(false)}>Cancel</QuietButton> : null}
      </div>
    </div>
  );
}

function BreakGlassGenerator({
  childProfileId,
  teenName,
  medical,
  adults,
  actions,
}: {
  childProfileId: string;
  teenName: string;
  medical: EmergencyMedical | null;
  adults: TrustedAdult[];
  actions: SafetyActions;
}) {
  const [fields, setFields] = useState<string[]>(["name", "contact", "blood", "allergies"]);
  const [grant, setGrant] = useState<BreakGlassGrant | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contactAdult = adults.find((x) => x.roles.includes("crisis_alert")) ?? adults[0] ?? null;

  async function generate() {
    if (busy || fields.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.createBreakGlassGrant(childProfileId, fields);
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      setGrant(res.data);
      const url = await QRCode.toDataURL(res.data.url, {
        width: 256,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setQrUrl(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("generate_failed"));
    }
    setBusy(false);
  }

  function toggleField(id: string) {
    setFields((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  return (
    <div className="rounded-2xl bg-white p-5 text-slate-900 sm:p-6">
      <a
        href="tel:911"
        className="flex min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-red-600 text-lg font-bold text-white"
      >
        <span aria-hidden="true">🚨</span> Call 911
      </a>
      <h3 className="mt-4 text-lg font-bold">Emergency card anyone can read</h3>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">
        Make an emergency card anyone can read, no Pookie login needed. You pick what goes on it.
      </p>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold">Put on the card:</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {BREAK_GLASS_FIELDS.map((f) => (
            <label
              key={f.id}
              className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-4 py-2"
            >
              <input
                type="checkbox"
                checked={fields.includes(f.id)}
                onChange={() => toggleField(f.id)}
                className="h-5 w-5 accent-slate-900"
              />
              <span className="text-sm font-medium">{f.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={() => void generate()} />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy || fields.length === 0}
        className="mt-4 min-h-[52px] w-full rounded-2xl bg-slate-900 text-base font-bold text-white disabled:opacity-50"
      >
        {busy ? "Making the card…" : "Generate 24-hour QR code"}
      </button>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        Anyone who scans this sees your emergency info. Only print it for places you trust.
      </p>

      {grant && qrUrl ? (
        <div className="mt-5 rounded-2xl border-2 border-slate-900 p-5">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Emergency Info QR code" width={192} height={192} className="rounded-xl border border-slate-200" />
            <div className="text-center sm:text-left">
              <p className="text-sm text-slate-600">Code (works without a camera):</p>
              <p className="mt-1 text-4xl font-bold tracking-widest">{grant.code}</p>
              <p className="mt-2 text-xs text-slate-500">
                Valid until{" "}
                {new Date(grant.expiresAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                . One viewer. Every view is logged for you to see.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-100 p-4">
            <p className="text-sm font-bold">Lock-screen preview</p>
            <dl className="mt-2 space-y-1 text-sm">
              {fields.includes("name") ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Name</dt>
                  <dd className="font-semibold">{teenName}</dd>
                </div>
              ) : null}
              {fields.includes("contact") && contactAdult ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Emergency contact</dt>
                  <dd className="font-semibold">
                    {contactAdult.displayName} · {contactAdult.contactMasked}
                  </dd>
                </div>
              ) : null}
              {fields.includes("blood") && medical?.bloodType ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Blood type</dt>
                  <dd className="font-semibold">{medical.bloodType}</dd>
                </div>
              ) : null}
              {fields.includes("allergies") && medical && medical.allergies.length > 0 ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Allergies</dt>
                  <dd className="text-right font-semibold">
                    {listToText(medical.allergies.slice(0, 3))}
                  </dd>
                </div>
              ) : null}
              {fields.includes("area") && medical?.homeArea ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">General area</dt>
                  <dd className="font-semibold">{medical.homeArea}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              Full info: scan the QR code. Location shown is your general area only.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LabQuickCards({
  childProfileId,
  actions,
}: {
  childProfileId: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [classes, setClasses] = useState<LabClass[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.listLabClasses(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setClasses(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function retryClasses() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  if (error) {
    return (
      <section aria-label="Lab safety">
        <h2 className="text-lg font-semibold text-star-100">Lab safety</h2>
        <div className="mt-3">
          <FormError message={error} onRetry={retryClasses} />
        </div>
      </section>
    );
  }
  if (classes === null) {
    return (
      <section aria-label="Lab safety">
        <h2 className="text-lg font-semibold text-star-100">Lab safety</h2>
        <div className="mt-3">
          <LoadingState label="Loading lab classes…" />
        </div>
      </section>
    );
  }
  if (classes.length === 0) return null;

  return (
    <section aria-label="Lab safety">
      <h2 className="text-lg font-semibold text-star-100">Lab safety</h2>
      <ul className="mt-3 space-y-3">
        {classes.map((c) => (
          <li key={c.id} className="rounded-2xl bg-white p-5 text-slate-900">
            <p className="text-base font-bold">{c.className}</p>
            <p className="mt-1 text-sm text-slate-600">
              {c.teacherName ?? "Teacher"}{c.room ? ` · Room ${c.room}` : ""}
            </p>
            {c.nursePhone ? (
              <a
                href={`tel:${c.nursePhone}`}
                className="mt-3 flex min-h-[48px] items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white"
              >
                Call school nurse: {c.nursePhone}
              </a>
            ) : null}
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Goggles on, always.</li>
              <li>Spill? Tell your teacher right away.</li>
              <li>Eyewash location: ask your teacher on day one.</li>
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PLAN_KINDS: { kind: ActionPlanKind; label: string }[] = [
  { kind: "allergy", label: "Severe allergy" },
  { kind: "asthma", label: "Asthma" },
  { kind: "seizure", label: "Seizure response" },
];

function ActionPlans({
  childProfileId,
  actions,
}: {
  childProfileId: string;
  actions?: SafetyActions;
}) {
  const a = actions ?? missingActions;
  const [plans, setPlans] = useState<ActionPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<ActionPlanKind | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.listActionPlans(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        setPlans(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function refreshPlans() {
    setError(null);
    setEditingKind(null);
    setReloadKey((k) => k + 1);
  }

  return (
    <section aria-label="Action plans">
      <h2 className="text-lg font-semibold text-star-100">My Action Plans</h2>
      <p className="mt-1 text-sm leading-relaxed text-stardust-300">
        Fill in what to do for your own conditions. These are reminders, not medical advice.
      </p>
      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={refreshPlans} />
        </div>
      ) : plans === null ? (
        <div className="mt-3">
          <LoadingState label="Loading action plans…" />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {PLAN_KINDS.map(({ kind, label }) => {
            const plan = plans.find((p) => p.kind === kind);
            if (editingKind === kind) {
              return (
                <ActionPlanEditor
                  key={kind}
                  kind={kind}
                  label={label}
                  existing={plan ?? null}
                  childProfileId={childProfileId}
                  actions={a}
                  onDone={refreshPlans}
                  onCancel={() => setEditingKind(null)}
                />
              );
            }
            return (
              <div
                key={kind}
                className="flex items-center justify-between gap-3 rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4"
              >
                <div>
                  <p className="text-[15px] font-semibold text-star-100">{label}</p>
                  {plan ? (
                    <p className="mt-0.5 text-xs text-stardust-300">
                      Updated{" "}
                      {new Date(plan.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-stardust-500">Not filled in yet</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setEditingKind(kind)}
                  className="min-h-[44px] shrink-0 rounded-xl border border-nova-400/25 px-4 py-2 text-sm font-medium text-stardust-300 hover:text-star-100"
                >
                  {plan ? "Edit" : "Fill in"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActionPlanEditor({
  kind,
  label,
  existing,
  childProfileId,
  actions,
  onDone,
  onCancel,
}: {
  kind: ActionPlanKind;
  label: string;
  existing: ActionPlan | null;
  childProfileId: string;
  actions: SafetyActions;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [signs, setSigns] = useState(existing?.signs ?? "");
  const [meds, setMeds] = useState(existing?.meds ?? "");
  const [whoToCall, setWhoToCall] = useState(existing?.whoToCall ?? "");
  const [tell911, setTell911] = useState(existing?.tell911 ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.saveActionPlan(childProfileId, {
        id: existing?.id,
        kind,
        signs: signs.trim(),
        meds: meds.trim(),
        whoToCall: whoToCall.trim(),
        tell911: tell911.trim(),
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("save_failed"));
      setBusy(false);
    }
  }

  async function remove() {
    if (busy || !existing) return;
    setBusy(true);
    try {
      await actions.deleteActionPlan(existing.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("delete_failed"));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-nova-400/20 bg-nebula-900/80 p-5">
      <h3 className="text-base font-semibold text-star-100">{label} plan</h3>
      <div className="mt-4 space-y-4">
        <Field label="My signs">
          <textarea
            className={inputClass}
            rows={2}
            value={signs}
            onChange={(e) => setSigns(e.target.value.slice(0, 1000))}
            placeholder="What it looks like when it starts"
          />
        </Field>
        <Field label="My meds">
          <textarea
            className={inputClass}
            rows={2}
            value={meds}
            onChange={(e) => setMeds(e.target.value.slice(0, 1000))}
            placeholder="What I take, and where it is"
          />
        </Field>
        <Field label="Who to call">
          <input
            className={inputClass}
            value={whoToCall}
            onChange={(e) => setWhoToCall(e.target.value.slice(0, 200))}
            placeholder="Name and number"
            autoComplete="off"
          />
        </Field>
        <Field label="What to tell 911">
          <textarea
            className={inputClass}
            rows={2}
            value={tell911}
            onChange={(e) => setTell911(e.target.value.slice(0, 1000))}
            placeholder="The short version a stranger can read out"
          />
        </Field>
      </div>
      {error ? (
        <div className="mt-3">
          <FormError message={error} onRetry={() => void save()} />
        </div>
      ) : null}
      <div className="mt-4 space-y-3">
        <PrimaryButton onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save plan"}
        </PrimaryButton>
        <div className="flex gap-3">
          <QuietButton onClick={onCancel}>Cancel</QuietButton>
          {existing ? (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="min-h-[48px] flex-1 rounded-2xl px-5 py-3 text-sm font-medium text-red-300 hover:text-red-200 disabled:opacity-50"
            >
              Delete plan
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
