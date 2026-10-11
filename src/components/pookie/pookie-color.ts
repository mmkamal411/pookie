"use client";

/**
 * Shared Pookie color state — the toolbar orb, the chat avatars, and the
 * nudge bubble all stay in sync. When the topic shifts to a class, every
 * Pookie on screen changes together.
 */

import { CLASS_NEONS } from "@/components/pookie/class-neons";

type Listener = (color: string | null) => void;

let currentColor: string | null = null;
const listeners = new Set<Listener>();

export function getPookieColor(): string | null {
  return currentColor;
}

export function setPookieColor(color: string | null) {
  currentColor = color;
  listeners.forEach((l) => l(color));
  // also broadcast for components that prefer events
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pookie:color", { detail: { color } }));
  }
}

export function subscribePookieColor(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Resolve a display neon hex from a stored color or class id */
export function resolvePookieNeon(color: string | null): string {
  if (!color) return CLASS_NEONS[0].neon;
  const found = CLASS_NEONS.find((c) => c.neon.toLowerCase() === color.toLowerCase());
  return found ? found.neon : color;
}
