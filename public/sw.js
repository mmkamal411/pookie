/**
 * Squad Mobile — Pookie service worker.
 *
 * Strategy:
 *  - App shell (/offline, icons, manifest): cache-first at install.
 *  - Hashed build assets (/_next/static/*): cache-first, cached on first use.
 *    They are content-hashed so they can never go stale.
 *  - Navigations: network-first, fall back to /offline when the network
 *    fails. NEVER a blank page.
 *  - API calls: network-only (never serve stale school/family data).
 *
 * On activate, old caches are purged so a fresh deploy always wins.
 */
const STATIC_CACHE = "pookie-static-v1";
const RUNTIME_CACHE = "pookie-runtime-v1";
const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isApi(url) {
  return url.pathname.startsWith("/api/");
}

function isHashedAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API: always network, never cache.
  if (isApi(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Hashed build assets: cache-first.
  if (isHashedAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Navigations: network-first, offline fallback page on failure.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error())),
    );
    return;
  }

  // Everything else (images, manifest): stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        return res;
      });
      return hit || net;
    }),
  );
});
