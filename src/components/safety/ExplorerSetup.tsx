"use client";

import { useEffect, useState } from "react";
import {
  errorMessage,
  missingActions,
  type SafetyActions,
  type TrustedAdult,
  type TrustedAdultRelationship,
} from "./types";
import {
  Field,
  FormError,
  FullPageFlow,
  LoadingState,
  PrimaryButton,
  QuietButton,
  RelationshipChips,
  StaticProgressDots,
  inputClass,
} from "./ui";

// [DV] Safety Basics content flagged for DV-advocate review (Appendix C gate #1).
// D7: coarse location only, everywhere. Destination is a place name + city,
// never coordinates; no map pin-drop; no retained location history.

const CARD_IDS = ["share-plan", "public-daylight", "check-in", "if-wrong"] as const;

/**
 * Explorer Setup — the one-time Out & About gate (13–15 full; 16–17 lite).
 * Under-16: non-dismissable, all four Safety Basics cards must be
 * acknowledged. Card transitions are instant cuts (no slide animation);
 * progress is static dots.
 */
export function ExplorerSetup({
  childProfileId,
  teenAge,
  teenFirstName,
  actions,
  onComplete,
}: {
  childProfileId: string;
  teenAge: number;
  teenFirstName: string;
  actions?: SafetyActions;
  onComplete: () => void;
}) {
  const a = actions ?? missingActions;
  const lite = teenAge >= 16;
  const [screen, setScreen] = useState<"loading" | "contact" | "cards" | "defaults">("loading");
  const [adults, setAdults] = useState<TrustedAdult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [acked, setAcked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Initial load — inline-IIFE-with-cancelled pattern (repo standard).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await a.listTrustedAdults(childProfileId);
        if (cancelled) return;
        if (!res.ok) {
          setError(errorMessage(res.error));
          return;
        }
        const outing = res.data.filter((x) => x.roles.includes("outing_contact"));
        setAdults(outing.length > 0 ? outing : res.data);
        const verified = (outing.length > 0 ? outing : res.data).find(
          (x) => x.verificationStatus === "verified"
        );
        if (verified) setSelectedId(verified.id);
        setScreen("contact");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : errorMessage("load_failed"));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childProfileId, reloadKey]);

  function retryLoad() {
    setError(null);
    setReloadKey((k) => k + 1);
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await a.completeExplorerSetup({
        childProfileId,
        outingContactAdultId: selectedId ?? "",
        cardsAcknowledged: acked,
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("complete_failed"));
      setBusy(false);
    }
  }

  if (screen === "loading") {
    return (
      <FullPageFlow>
        <LoadingState label="Getting your safety setup ready…" />
      </FullPageFlow>
    );
  }

  if (screen === "contact") {
    return (
      <FullPageFlow>
        <StaticProgressDots total={3} current={1} />
        <h1 className="mt-4 text-2xl font-semibold text-star-100">
          Who should get your plans when you go out?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stardust-300">
          {lite
            ? "Pick someone, or skip this for now."
            : "Pick one person. You need this before you can explore."}
        </p>
        {error ? (
          <div className="mt-4">
            <FormError message={error} onRetry={retryLoad} />
          </div>
        ) : null}
        <div className="mt-5 space-y-2" role="radiogroup" aria-label="Outing contact">
          {adults.map((adult) => (
            <label
              key={adult.id}
              className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border p-4 ${
                selectedId === adult.id
                  ? "border-nova-400/60 bg-nova-400/10"
                  : "border-nova-400/15 bg-nebula-800/60"
              }`}
            >
              <input
                type="radio"
                name="outing-contact"
                checked={selectedId === adult.id}
                onChange={() => setSelectedId(adult.id)}
                className="h-5 w-5 accent-pink-400"
              />
              <span>
                <span className="block text-[15px] font-semibold text-star-100">
                  {adult.displayName}
                </span>
                <span className="block text-xs text-stardust-300">
                  {adult.relationshipLabel} · {adult.contactMasked}
                </span>
              </span>
            </label>
          ))}
        </div>
        <AddOutingContact
          childProfileId={childProfileId}
          actions={a}
          onAdded={(adult) => {
            setAdults((prev) => [...prev, adult]);
            setSelectedId(adult.id);
          }}
        />
        <div className="mt-6 space-y-3">
          <PrimaryButton
            onClick={() => setScreen("cards")}
            disabled={!lite && !selectedId}
          >
            Continue
          </PrimaryButton>
          {lite ? <QuietButton onClick={() => setScreen("cards")}>Skip for now</QuietButton> : null}
        </div>
        {!lite && !selectedId ? (
          <p className="mt-3 text-sm text-stardust-300">
            Choose or add one person to continue.
          </p>
        ) : null}
      </FullPageFlow>
    );
  }

  if (screen === "cards") {
    return (
      <SafetyBasicsCards
        lite={lite}
        teenFirstName={teenFirstName}
        onAck={(id) => setAcked((prev) => (prev.includes(id) ? prev : [...prev, id]))}
        onDone={() => setScreen("defaults")}
      />
    );
  }

  return (
    <FullPageFlow>
      <StaticProgressDots total={3} current={3} />
      <h1 className="mt-4 text-2xl font-semibold text-star-100">Your safety defaults</h1>
      <p className="mt-2 text-sm leading-relaxed text-stardust-300">
        These stay on until you turn 16. You can loosen them then.
      </p>
      <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-stardust-200">
        <li className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4">
          <strong className="text-star-100">Share my plan</strong> is drafted for every outing. You
          tap send. It is never sent on its own.
        </li>
        <li className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4">
          <strong className="text-star-100">Events</strong> show Family and Teen picks by default.
        </li>
        <li className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4">
          <strong className="text-star-100">Coarse location only.</strong> Pookie never stores your
          exact location, only your general area. No location history is kept.
        </li>
        <li className="rounded-2xl border border-nova-400/15 bg-nebula-800/60 p-4">
          <strong className="text-star-100">Dusk guard</strong> is on. You get a warning 90 minutes
          before sunset.
        </li>
      </ul>
      {error ? (
        <div className="mt-4">
          <FormError message={error} onRetry={finish} />
        </div>
      ) : null}
      <div className="mt-6">
        <PrimaryButton onClick={() => void finish()} disabled={busy}>
          {busy ? "Saving…" : "Start exploring"}
        </PrimaryButton>
      </div>
    </FullPageFlow>
  );
}

function AddOutingContact({
  childProfileId,
  actions,
  onAdded,
}: {
  childProfileId: string;
  actions: SafetyActions;
  onAdded: (adult: TrustedAdult) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<TrustedAdultRelationship | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 0 && (phone.trim().length > 0 || email.trim().length > 0);

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await actions.nominateTrustedAdult({
        childProfileId,
        displayName: name.trim(),
        relationship: relationship ?? "other",
        contactChannel: phone.trim() ? "sms" : "email",
        contactValue: phone.trim() || email.trim(),
        roles: ["outing_contact", "crisis_alert"],
      });
      if (!res.ok) {
        setError(errorMessage(res.error));
        setBusy(false);
        return;
      }
      const list = await actions.listTrustedAdults(childProfileId);
      if (list.ok) {
        const added = list.data.find((x) => x.id === res.data.trustedAdultId);
        if (added) onAdded(added);
      }
      setOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      setRelationship(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : errorMessage("submit_failed"));
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 min-h-[48px] w-full rounded-2xl border border-dashed border-nova-400/30 px-4 py-3 text-sm font-medium text-stardust-300 hover:text-star-100"
      >
        + Add someone new
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-nova-400/20 bg-nebula-800/60 p-4">
      <Field label="Their name">
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="off"
        />
      </Field>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-star-200">How do you know them</span>
        <RelationshipChips
          value={relationship}
          onChange={(v) => setRelationship(v as TrustedAdultRelationship)}
          options={[
            { value: "parent", label: "Parent" },
            { value: "relative", label: "Relative" },
            { value: "neighbor", label: "Neighbor" },
            { value: "other", label: "Other" },
          ]}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Phone">
          <input
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="off"
          />
        </Field>
        <Field label="Email">
          <input
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            autoComplete="off"
          />
        </Field>
      </div>
      {error ? <FormError message={error} /> : null}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[48px] flex-1 rounded-2xl border border-nova-400/25 px-4 py-3 text-sm font-medium text-stardust-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!valid || busy}
          className="btn-dapple min-h-[48px] flex-1 rounded-2xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Adding…" : "Add them"}
        </button>
      </div>
    </div>
  );
}

function SafetyBasicsCards({
  lite,
  teenFirstName,
  onAck,
  onDone,
}: {
  lite: boolean;
  teenFirstName: string;
  onAck: (id: string) => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const id = CARD_IDS[index];

  function ackAndNext() {
    onAck(id);
    if (index < CARD_IDS.length - 1) {
      setIndex(index + 1);
    } else {
      onDone();
    }
  }

  return (
    <FullPageFlow>
      <StaticProgressDots total={4} current={index + 1} />
      <p className="mt-3 text-center text-sm text-stardust-300">
        Safety Basics · {index + 1} of 4
      </p>

      <div className="mt-4 rounded-3xl border border-nova-400/20 bg-nebula-800/60 p-6">
        {id === "share-plan" ? <SharePlanCard /> : null}
        {id === "public-daylight" ? <PublicDaylightCard /> : null}
        {id === "check-in" ? <CheckInCard /> : null}
        {id === "if-wrong" ? <IfWrongCard /> : null}
      </div>

      <div className="mt-5 space-y-3">
        <PrimaryButton
          onClick={ackAndNext}
        >
          {id === "share-plan" ? "Got it, I'll share my plan" : null}
          {id === "public-daylight" ? "Got it, public places, home before dark" : null}
          {id === "check-in" ? "Got it, I'll set check-in timers" : null}
          {id === "if-wrong" ? "Got it, 911 first" : null}
        </PrimaryButton>
        {lite ? (
          <QuietButton onClick={onDone}>Skip the rest</QuietButton>
        ) : (
          <p className="text-center text-xs text-stardust-500">
            {teenFirstName}, work through all 4 to unlock exploring.
          </p>
        )}
      </div>
    </FullPageFlow>
  );
}

/** D7: destination is a place name + city. Never coordinates, never a map pin. */
function SharePlanCard() {
  const [place, setPlace] = useState("");
  const [city, setCity] = useState("");
  const [with_, setWith] = useState("");
  const [back, setBack] = useState("");
  const [preview, setPreview] = useState(false);
  return (
    <div>
      <h2 className="text-xl font-semibold text-star-100">Share your plan</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-stardust-200">
        Before you go: where, with whom, when you&apos;ll be back. Pookie can text it to your
        trusted adult in one tap.
      </p>
      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Place">
            <input
              className={inputClass}
              placeholder="Park name, mall, friend's street"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="City or ZIP">
            <input
              className={inputClass}
              placeholder="Marietta, 30067"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="With whom">
            <input
              className={inputClass}
              placeholder="Maya and Jordan"
              value={with_}
              onChange={(e) => setWith(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <Field label="Back by">
            <input
              className={inputClass}
              placeholder="6:00 PM"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="min-h-[48px] w-full rounded-2xl border border-nova-400/40 bg-nova-400/10 px-4 py-3 text-sm font-semibold text-nova-200"
        >
          {preview ? "Hide preview" : "Try it: preview the text"}
        </button>
        {preview ? (
          <div className="rounded-2xl bg-nebula-950/70 p-4 text-sm leading-relaxed text-stardust-200">
            <p className="font-semibold text-star-100">Your adult would get:</p>
            <p className="mt-1">
              “{place || "[place]"}, {city || "[city]"} with {with_ || "[friends]"}, back by{" "}
              {back || "[time]"}.”
            </p>
            <p className="mt-2 text-xs text-stardust-500">
              Nothing is sent in setup. This is just a preview.
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-stardust-500">
        Pookie never stores your exact location, only your general area. No map pin, no tracking.
      </p>
    </div>
  );
}

function PublicDaylightCard() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-star-100">Public places, daylight</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-stardust-200">
        Stick to public, populated places. Parks close at dusk, plan to be out well before dark.
        Trust your gut; leaving is always okay.
      </p>
      <div className="mt-4 rounded-2xl border border-aurum-400/30 bg-aurum-400/5 p-4 text-sm leading-relaxed text-stardust-200">
        Dusk guard is on: Pookie warns you 90 minutes before sunset so you can head home in
        daylight.
      </div>
    </div>
  );
}

function CheckInCard() {
  const [time, setTime] = useState("16:00");
  return (
    <div>
      <h2 className="text-xl font-semibold text-star-100">Check In</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-stardust-200">
        Set a check-in timer. If you miss it, Pookie nudges <em>you</em> first, then your trusted
        adult if you don&apos;t respond. You control the timer.
      </p>
      <div className="mt-4">
        <Field label="Try it: pick a check-in time">
          <input
            type="time"
            className={inputClass}
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>
        <p className="mt-2 text-sm text-stardust-300">
          At {time}, Pookie asks: “Still good?” No answer in 15 minutes, and your trusted adult
          hears about it.
        </p>
      </div>
    </div>
  );
}

function IfWrongCard() {
  return (
    <div>
      <h2 className="text-xl font-semibold text-star-100">If Something Feels Wrong</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-stardust-200">
        Call 911 first, then your trusted adult. Your live plan is on your phone even with no
        signal.
      </p>
      <div className="mt-4 rounded-2xl border border-nova-400/20 bg-nebula-950/70 p-4">
        <p className="text-sm font-semibold text-star-100">Offline plan card (works with no signal)</p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed text-stardust-300">
          <li>1. Call 911.</li>
          <li>2. Text your trusted adult where you are (place name + city).</li>
          <li>3. Stay where people are. Keep your phone on.</li>
        </ul>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-stardust-500">
        Pookie never stores your exact location, only your general area.
      </p>
    </div>
  );
}
