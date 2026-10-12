"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * NebulaBackground — the Deep Space canvas.
 * Twinkling stars, drifting nebula clouds (violet/cyan/magenta), occasional
 * shooting stars, a soft moon, distant planets, and blinking satellites.
 * Stars brighten near the pointer (touch/mouse) — the sky notices you.
 * Sits behind all content with a readability overlay.
 *
 * Graceful degradation (feature detection, never browser sniffing):
 * - prefers-reduced-motion → static CSS starfield, no animation
 * - no canvas 2D (old devices, strict privacy modes) → static CSS starfield
 * Core app functionality never depends on the canvas.
 *
 * Ported from d-dash's cosmos-background (the dawsonkamal.com canvas).
 */
export function NebulaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  // Course-change state lives in a ref so the animation loop reads it
  // without re-renders. ease → target each frame (~800ms bank into a turn).
  const courseRef = useRef({ hue: 0, hueT: 0, dx: 0, dxT: 0, dy: 0, dyT: 0 });
  // Capability state via lazy initializers (no setState-in-effect): the
  // values are known synchronously on the client at first render.
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [noCanvas] = useState(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return false;
    try {
      const probe = document.createElement("canvas");
      return !probe.getContext("2d");
    } catch {
      return true;
    }
  });

  // Follow system motion-preference changes.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // New course on every navigation — the ship banks into the turn.
  // Hue drifts ±8°, the parallax vector picks a fresh gentle heading.
  useEffect(() => {
    const c = courseRef.current;
    c.hueT = Math.random() * 16 - 8;
    const ang = Math.random() * Math.PI * 2;
    const mag = 0.35 + Math.random() * 0.45;
    c.dxT = Math.cos(ang) * mag;
    c.dyT = Math.sin(ang) * mag * 0.6;
  }, [pathname]);

  // Animation loop — only when the canvas exists and motion is allowed.
  useEffect(() => {
    if (reduced || noCanvas) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;
    const cv: HTMLCanvasElement = canvas;
    let w = 0;
    let h = 0;
    let raf = 0;
    let stars: { x: number; y: number; r: number; tw: number; ts: number; hue: number; depth: number }[] = [];
    let nebulas: { x: number; y: number; r: number; hue: number; dx: number; dy: number }[] = [];
    let meteors: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number }[] = [];
    let satellites: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    let planets: { x: number; y: number; r: number; colors: string[]; ring: boolean; dx: number }[] = [];
    let moon = { x: 0, y: 0, r: 28 };
    const pointer = { x: -9999, y: -9999 };
    // Course-change state (Aurora, 2026-10-12): the ship banks into a turn on
    // every navigation. Current values ease toward targets (~800ms settle);
    // hue shifts ±8°, drift vector nudges the parallax layers. All refs —
    // no re-renders, GPU-cheap canvas math only.
    const course = courseRef.current;
    const LAYER_SPEED = [0.05, 0.13, 0.3]; // far / mid / near parallax
    // Firefly sparks — Canopy soul: tiny green/cyan/gold embers drifting
    // slowly upward with a soft glow. Firefly, not floodlight.
    let sparks: { x: number; y: number; r: number; hue: number; vy: number; ph: number; sp: number; a: number }[] = [];

    function resize() {
      w = cv.width = window.innerWidth;
      h = cv.height = window.innerHeight;
      initField();
    }

    function initField() {
      stars = [];
      const count = Math.min(200, Math.floor((w * h) / 8500));
      const hues = [0, 0, 0, 210, 280, 320]; // mostly white, some blue/violet/pink
      for (let i = 0; i < count; i++) {
        // Depth layers for parallax: 0 = far (slow), 2 = near (fast).
        // Weighted so the far field dominates — depth, not noise.
        const roll = Math.random();
        const depth = roll < 0.55 ? 0 : roll < 0.85 ? 1 : 2;
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (Math.random() * 1.5 + 0.3) * (0.7 + depth * 0.35),
          tw: Math.random() * Math.PI * 2,
          ts: 0.5 + Math.random() * 2,
          hue: hues[Math.floor(Math.random() * hues.length)],
          depth,
        });
      }
      nebulas = [
        { x: w * 0.18, y: h * 0.14, r: Math.max(w, h) * 0.36, hue: 275, dx: 0.08, dy: 0.05 },
        { x: w * 0.85, y: h * 0.58, r: Math.max(w, h) * 0.3, hue: 200, dx: -0.06, dy: 0.04 },
        { x: w * 0.5, y: h * 0.92, r: Math.max(w, h) * 0.28, hue: 320, dx: 0.05, dy: -0.07 },
        { x: w * 0.7, y: h * 0.25, r: Math.max(w, h) * 0.22, hue: 250, dx: -0.04, dy: -0.03 },
      ];
      planets = [
        { x: w * 0.08, y: h * 0.25, r: 22, colors: ["#f472b6", "#a855f7"], ring: true, dx: 0.03 },
        { x: w * 0.92, y: h * 0.45, r: 16, colors: ["#22d3ee", "#0ea5e9"], ring: false, dx: -0.02 },
        { x: w * 0.06, y: h * 0.75, r: 12, colors: ["#fbbf24", "#f97316"], ring: false, dx: 0.025 },
      ];
      moon = { x: w * 0.94, y: h * 0.12, r: 26 };
      sparks = [];
      const sparkHues = [140, 140, 190, 190, 45]; // green, cyan, gold — Canopy embers
      const sparkCount = Math.min(36, Math.floor((w * h) / 45000));
      for (let i = 0; i < sparkCount; i++) {
        sparks.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 1.6,
          hue: sparkHues[Math.floor(Math.random() * sparkHues.length)],
          vy: 0.08 + Math.random() * 0.22,
          ph: Math.random() * Math.PI * 2,
          sp: 0.4 + Math.random() * 0.8,
          a: 0.1 + Math.random() * 0.18,
        });
      }
      satellites = [];
      for (let i = 0; i < 3; i++) {
        satellites.push({
          x: Math.random() * w,
          y: Math.random() * h * 0.5,
          vx: 0.3 + Math.random() * 0.4,
          vy: 0.05,
          size: 1.5,
        });
      }
    }

    function spawnMeteor() {
      const fromLeft = Math.random() > 0.5;
      meteors.push({
        x: fromLeft ? -50 : Math.random() * w,
        y: Math.random() * h * 0.4,
        vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 4),
        vy: 2 + Math.random() * 2,
        life: 0,
        maxLife: 60 + Math.random() * 40,
      });
    }

    let frame = 0;
    function draw() {
      frame++;
      // Ease the ship into its new course (~800ms settle at 60fps).
      const EASE = 0.055;
      course.hue += (course.hueT - course.hue) * EASE;
      course.dx += (course.dxT - course.dx) * EASE;
      course.dy += (course.dyT - course.dy) * EASE;
      const bank = Math.min(
        1,
        Math.abs(course.hueT - course.hue) / 8 +
          Math.hypot(course.dxT - course.dx, course.dyT - course.dy)
      );
      const H = course.hue;

      g.clearRect(0, 0, w, h);

      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, `hsl(${242 + H} 55% 3.5%)`);
      bg.addColorStop(0.5, `hsl(${240 + H} 60% 6.5%)`);
      bg.addColorStop(1, `hsl(${242 + H} 55% 3.5%)`);
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      for (const n of nebulas) {
        n.x += n.dx;
        n.y += n.dy;
        if (n.x < -n.r) n.x = w + n.r;
        if (n.x > w + n.r) n.x = -n.r;
        if (n.y < -n.r) n.y = h + n.r;
        if (n.y > h + n.r) n.y = -n.r;
        const grad = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, `hsla(${n.hue + H}, 65%, 30%, 0.14)`);
        grad.addColorStop(0.5, `hsla(${n.hue + H}, 55%, 22%, 0.07)`);
        grad.addColorStop(1, "transparent");
        g.fillStyle = grad;
        g.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
      }

      // Banking wash — a whisper of violet while the ship turns.
      if (bank > 0.03) {
        const wa = Math.min(0.045, bank * 0.045);
        const gx = w / 2 + course.dx * w * 0.35;
        const gy = h / 2 + course.dy * h * 0.35;
        const wash = g.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.7);
        wash.addColorStop(0, `hsla(${270 + H}, 75%, 45%, ${wa})`);
        wash.addColorStop(1, "transparent");
        g.fillStyle = wash;
        g.fillRect(0, 0, w, h);
      }

      // Stars — twinkling, drifting in parallax layers, brightening near the pointer
      for (const s of stars) {
        // Near stars slide faster along the course vector — the window moves.
        const sp = LAYER_SPEED[s.depth];
        s.x += course.dx * sp;
        s.y += course.dy * sp;
        if (s.x < -4) s.x = w + 4;
        else if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4;
        else if (s.y > h + 4) s.y = -4;
        s.tw += 0.02 * s.ts;
        const dx = s.x - pointer.x;
        const dy = s.y - pointer.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const near = Math.max(0, 1 - dist / 160);
        const alpha = Math.min(1, 0.3 + 0.7 * Math.abs(Math.sin(s.tw)) + near * 0.7);
        const rad = s.r * (1 + near * 0.9);
        g.fillStyle =
          s.hue === 0
            ? `rgba(255, 255, 255, ${alpha * 0.85})`
            : `hsla(${s.hue}, 90%, 82%, ${alpha * 0.85})`;
        g.beginPath();
        g.arc(s.x, s.y, rad, 0, Math.PI * 2);
        g.fill();
      }

      if (frame % 200 === 0 && meteors.length < 3 && Math.random() > 0.3) spawnMeteor();
      meteors = meteors.filter((m) => m.life < m.maxLife);

      // Firefly sparks — slow embers rising with a sine wobble, soft glow
      g.save();
      g.globalCompositeOperation = "lighter";
      for (const sp of sparks) {
        sp.ph += 0.008 * sp.sp;
        sp.y -= sp.vy;
        sp.x += Math.sin(sp.ph) * 0.25;
        if (sp.y < -12) {
          sp.y = h + 12;
          sp.x = Math.random() * w;
        }
        const flicker = 0.6 + 0.4 * Math.sin(sp.ph * 2.3);
        const alpha = sp.a * flicker;
        const grad = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, sp.r * 4);
        grad.addColorStop(0, `hsla(${sp.hue}, 95%, 72%, ${alpha})`);
        grad.addColorStop(0.4, `hsla(${sp.hue}, 90%, 60%, ${alpha * 0.45})`);
        grad.addColorStop(1, "transparent");
        g.fillStyle = grad;
        g.beginPath();
        g.arc(sp.x, sp.y, sp.r * 4, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();

      for (const m of meteors) {
        m.x += m.vx;
        m.y += m.vy;
        m.life++;
        const progress = m.life / m.maxLife;
        const alpha = Math.sin(progress * Math.PI) * 0.9;
        const tailLen = 80 * (1 - progress * 0.5);
        const grad = g.createLinearGradient(m.x, m.y, m.x - (m.vx * tailLen) / 8, m.y - (m.vy * tailLen) / 8);
        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        grad.addColorStop(1, "transparent");
        g.strokeStyle = grad;
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(m.x, m.y);
        g.lineTo(m.x - (m.vx * tailLen) / 8, m.y - (m.vy * tailLen) / 8);
        g.stroke();
      }

      // Moon — soft glowing disc in the corner
      {
        const mg = g.createRadialGradient(moon.x, moon.y, moon.r * 0.5, moon.x, moon.y, moon.r * 2);
        mg.addColorStop(0, "rgba(255,255,240,0.9)");
        mg.addColorStop(0.3, "rgba(255,255,240,0.25)");
        mg.addColorStop(1, "transparent");
        g.fillStyle = mg;
        g.beginPath();
        g.arc(moon.x, moon.y, moon.r * 2, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#fefce8";
        g.beginPath();
        g.arc(moon.x, moon.y, moon.r, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(0,0,0,0.08)";
        g.beginPath();
        g.arc(moon.x - 8, moon.y - 5, 5, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(moon.x + 6, moon.y + 8, 4, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.arc(moon.x + 10, moon.y - 10, 3, 0, Math.PI * 2);
        g.fill();
      }

      for (const p of planets) {
        p.x += p.dx;
        if (p.x < -p.r * 2) p.x = w + p.r * 2;
        if (p.x > w + p.r * 2) p.x = -p.r * 2;
        const pg = g.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.2, p.x, p.y, p.r);
        pg.addColorStop(0, p.colors[0]);
        pg.addColorStop(1, p.colors[1]);
        g.fillStyle = pg;
        g.beginPath();
        g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        g.fill();
        if (p.ring) {
          g.strokeStyle = "rgba(255,255,255,0.3)";
          g.lineWidth = 2;
          g.beginPath();
          g.ellipse(p.x, p.y, p.r * 1.6, p.r * 0.5, -0.4, 0, Math.PI * 2);
          g.stroke();
        }
      }

      for (const s of satellites) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x > w + 10) {
          s.x = -10;
          s.y = Math.random() * h * 0.5;
        }
        const blink = 0.4 + 0.6 * Math.abs(Math.sin(frame * 0.05 + s.x * 0.01));
        g.fillStyle = `rgba(255,255,255,${blink * 0.7})`;
        g.beginPath();
        g.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        g.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const onLeave = () => {
      pointer.x = -9999;
      pointer.y = -9999;
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, noCanvas]);


  // Reduced motion or no canvas → the static CSS starfield. Still a nebula,
  // just not an animated one. No JS errors, no broken layout.
  if (reduced || noCanvas) {
    return (
      <>
        <div aria-hidden="true" className="nebula-canvas nebula-static pointer-events-none fixed inset-0 z-0" />
        <div
          aria-hidden="true"
          className="nebula-canvas pointer-events-none fixed inset-0 z-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(5,5,16,0.5) 0%, rgba(5,5,16,0.8) 100%)",
          }}
        />
      </>
    );
  }

  return (
    <>
      <canvas ref={canvasRef} aria-hidden="true" className="nebula-canvas pointer-events-none fixed inset-0 z-0" />
      <div
        aria-hidden="true"
        className="nebula-canvas pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 40%, rgba(5,5,16,0.5) 0%, rgba(5,5,16,0.8) 100%)",
        }}
      />
    </>
  );
}
