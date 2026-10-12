"use client";

import { useEffect, useState } from "react";

function greetingForHour(h: number): string {
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * Home tab hero — time-of-day greeting (computed client-side so it matches
 * the viewer's clock), date line, Pookie orb, and the morning-glance
 * summary: what needs love and what's due soon.
 */
export function GreetingHero({
  childName,
  schoolName,
  gradeLevel,
  attentionCount,
  urgentCount,
  classCount,
}: {
  childName: string;
  schoolName: string | null;
  gradeLevel: string | null;
  attentionCount: number;
  urgentCount: number;
  classCount: number;
}) {
  const [greeting, setGreeting] = useState("Hello");
  const [dateLine, setDateLine] = useState("");

  // Deferred to a frame callback: no hydration mismatch (SSR renders the
  // fallback), and setState lives in the callback, not the effect body.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const now = new Date();
      setGreeting(greetingForHour(now.getHours()));
      setDateLine(
        new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        }).format(now)
      );
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const schoolLine = [schoolName, gradeLevel ? `Grade ${gradeLevel}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <header>
      <div className="animate-bloom flex items-center gap-4">
        <p className="text-sm font-medium tracking-[0.2em] text-nova-400 capitalize">
          Home · today&apos;s glance
        </p>
      </div>
      <p
        className="animate-bloom mt-4 text-xs font-medium tracking-[0.18em] text-stardust-500 capitalize"
        style={{ animationDelay: "0.05s" }}
      >
        {dateLine || " "}
      </p>
      <h1
        className="text-sunlit animate-bloom mt-1 text-3xl font-semibold tracking-tight sm:text-4xl"
        style={{ animationDelay: "0.08s" }}
      >
        {greeting}, here&apos;s how {childName} is growing today.
      </h1>
      <p
        className="animate-bloom mt-3 max-w-xl leading-relaxed text-stardust-300"
        style={{ animationDelay: "0.12s" }}
      >
        {schoolLine && (
          <>
            {schoolLine} ·{" "}
          </>
        )}
        Goal: <span className="font-semibold text-star-100">90%+ in every class</span>
        {classCount === 0 ? (
          <> · the board is quiet — no classes on the instruments yet</>
        ) : attentionCount > 0 ? (
          <>
            {" "}· {attentionCount} {attentionCount === 1 ? "class" : "classes"} getting
            extra love
          </>
        ) : (
          <> · every class at the goal</>
        )}
        {urgentCount > 0 && (
          <>
            {" "}· {urgentCount} {urgentCount === 1 ? "item" : "items"} due soon
          </>
        )}
        .
      </p>
    </header>
  );
}
