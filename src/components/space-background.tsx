"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const VIDEO_BASE = "/videos";

export const COCKPIT_VIDEOS = {
  home: `${VIDEO_BASE}/cockpit-home.mp4`,
  today: `${VIDEO_BASE}/cockpit-today.mp4`,
  chat: `${VIDEO_BASE}/cockpit-chat.mp4`,
  progress: `${VIDEO_BASE}/cockpit-progress.mp4`,
  hub: `${VIDEO_BASE}/cockpit-hub.mp4`,
  module: `${VIDEO_BASE}/cockpit-module.mp4`,
} as const;

export type CockpitVideoKey = keyof typeof COCKPIT_VIDEOS;

const COCKPIT_POSTERS: Record<CockpitVideoKey, string> = {
  home: `${VIDEO_BASE}/cockpit-home-poster.jpg`,
  today: `${VIDEO_BASE}/cockpit-today-poster.jpg`,
  chat: `${VIDEO_BASE}/cockpit-chat-poster.jpg`,
  progress: `${VIDEO_BASE}/cockpit-progress-poster.jpg`,
  hub: `${VIDEO_BASE}/cockpit-hub-poster.jpg`,
  module: `${VIDEO_BASE}/cockpit-module-poster.jpg`,
};

const CROSSFADE_MS = 1100;

const OVERLAY =
  "radial-gradient(ellipse 120% 95% at 50% 42%, transparent 52%, rgba(0,0,0,0.42) 100%)," +
  "linear-gradient(180deg, rgba(2,4,10,0.74) 0%, rgba(2,4,10,0.62) 44%, rgba(2,4,10,0.76) 100%)";

export function cockpitVideoForPathname(pathname: string): CockpitVideoKey {
  const child = pathname.match(/^\/c\/[^/]+(\/.*)?$/);
  if (child) {
    const rest = child[1] ?? "/";
    if (rest === "/") return "home";
    if (rest.startsWith("/today")) return "today";
    if (rest.startsWith("/pookie")) return "chat";
    if (rest.startsWith("/school")) return "progress";
    return "module";
  }
  if (pathname === "/me") return "hub";
  return "module";
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );
}

function attachVideo(el: HTMLVideoElement | null) {
  if (!el) return;
  el.muted = true;
  const p = el.play();
  if (p !== undefined) p.catch(() => {});
}

type TopLayer = { src: string; on: boolean; id: number };

export function SpaceBackground({ src, poster }: { src: string; poster?: string }) {
  const mounted = useMounted();
  const reduced = usePrefersReducedMotion();
  const [dimmed, setDimmed] = useState(false);
  const [base, setBase] = useState<string | null>(null);
  const [top, setTop] = useState<TopLayer | null>(null);
  const topIdRef = useRef(0);

  // Render-phase layer sync: the base layer settles on the first mounted
  // render (the video element is never emitted during SSR, so it can't
  // block paint), and a route change stages the incoming video as the top
  // layer. Render-phase setState is React's documented pattern for this —
  // no cascading effect renders, no refs touched during render.
  if (mounted && !reduced) {
    if (base === null && top === null) {
      setBase(src);
    } else if (base !== null && base !== src && top?.src !== src) {
      setTop({ src, on: false, id: (top?.id ?? 0) + 1 });
    }
  }

  useEffect(() => {
    topIdRef.current = top?.id ?? 0;
  }, [top]);

  // Hidden tab: pause the decode, resume on return.
  useEffect(() => {
    if (!mounted || reduced) return;
    const onVisibility = () => {
      document.querySelectorAll<HTMLVideoElement>("video[data-cockpit-video]").forEach((v) => {
        if (document.hidden) {
          v.pause();
        } else {
          v.muted = true;
          const p = v.play();
          if (p !== undefined) p.catch(() => {});
        }
      });
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [mounted, reduced]);

  // While a video is playing it fully occludes the canvas/cosmic layers —
  // fade them out so their animation loops stop costing GPU.
  useEffect(() => {
    if (!mounted) return;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".nebula-canvas, .cosmic-scene-layer")
    );
    els.forEach((el) => {
      el.style.transition = "opacity 1.4s ease";
      el.style.opacity = dimmed && !reduced ? "0" : "";
    });
    return () => {
      els.forEach((el) => {
        el.style.opacity = "";
      });
    };
  }, [mounted, dimmed, reduced]);

  if (!mounted) return null;

  if (reduced) {
    return (
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2]">
        {poster && (
          <img
            src={poster}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: OVERLAY }} />
      </div>
    );
  }

  const promoteTop = (layer: TopLayer) => {
    setTop((t) => (t && t.id === layer.id ? { ...t, on: true } : t));
    window.setTimeout(() => {
      // A newer navigation supersedes this one — its layer promotes instead.
      if (topIdRef.current !== layer.id) return;
      setTop(null);
      setBase(layer.src);
    }, CROSSFADE_MS);
  };

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[2]">
      {base && (
        <video
          key={base}
          ref={attachVideo}
          data-cockpit-video=""
          className="absolute inset-0 h-full w-full object-cover"
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          poster={poster}
          disablePictureInPicture
          tabIndex={-1}
          src={base}
          onPlaying={() => setDimmed(true)}
          onError={() => setDimmed(false)}
        />
      )}
      {top && (
        <video
          key={top.src}
          ref={attachVideo}
          data-cockpit-video=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${
            top.on ? "opacity-100" : "opacity-0"
          }`}
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          poster={poster}
          disablePictureInPicture
          tabIndex={-1}
          src={top.src}
          onCanPlay={() => promoteTop(top)}
          onPlaying={() => setDimmed(true)}
          onError={() => setTop(null)}
        />
      )}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: OVERLAY }} />
    </div>
  );
}

export function CockpitBackground() {
  const pathname = usePathname();
  const mounted = useMounted();

  if (!mounted) return null;
  const key = cockpitVideoForPathname(pathname);
  return <SpaceBackground src={COCKPIT_VIDEOS[key]} poster={COCKPIT_POSTERS[key]} />;
}
