"use client";

import { useEffect, useRef } from "react";
import { planetaryVista } from "./vista-sources";

/**
 * HeroVista — the opening viewport. The live planetary vista behind the
 * glass pane, chosen by daypart (dawn / day / dusk / night). Greeting +
 * date float over the frame — calm, not a wall of cards.
 */
export function HeroVista({ pilotName }: { pilotName: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const now = new Date();
  const vista = planetaryVista(now.getHours());
  const src = vista.src;
  const poster = vista.poster;

  useEffect(() => {
    // Seamless loop: crossfade the tail into the head (same technique as
    // the cockpit backgrounds — 2s blend, restart invisible).
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => {});
  }, [src]);

  const dateLine = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const hour = now.getHours();
  const greeting =
    hour < 5 ? "Night watch" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="pilot-vista-hero">
      <video
        ref={videoRef}
        className="pilot-vista-video"
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay
        aria-hidden="true"
      />
      <div className="pilot-vista-scrim" aria-hidden="true" />
      <div className="pilot-vista-caption">
        <p className="text-[11px] font-medium tracking-[0.25em] text-nova-300 uppercase">
          {dateLine}
        </p>
        <h1 className="text-sunlit mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting}, {pilotName}
        </h1>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-stardust-300">
          Your bridge is quiet. Pookie is handling the small stuff in the
          background — and will speak up when something needs you.
        </p>
      </div>
      <style>{VISTA_CSS}</style>
    </div>
  );
}

const VISTA_CSS = `
.pilot-vista-hero {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid rgb(255 255 255 / 0.12);
  min-height: 300px;
  display: flex;
  align-items: flex-end;
  box-shadow: 0 0 44px rgb(0 229 255 / 0.08), inset 0 0 60px rgb(0 0 0 / 0.35);
}
.pilot-vista-video {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
.pilot-vista-scrim {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgb(2 5 14 / 0.15) 0%, rgb(2 5 14 / 0.05) 40%, rgb(2 5 14 / 0.72) 100%);
}
.pilot-vista-caption {
  position: relative; z-index: 1;
  padding: 28px;
}
@media (prefers-reduced-motion: reduce) {
  .pilot-vista-video { display: none; }
}
`;
