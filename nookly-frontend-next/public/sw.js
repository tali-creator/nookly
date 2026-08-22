/* Nookly service worker — provides installability + a basic offline shell.
   Strategy:
   - Navigations: network-first, fall back to cache then an offline page.
   - Same-origin static assets (/_next/static, icons, images): cache-first.
   - Cross-origin API calls (the separate backend origin): passed straight
     through without caching. */

const CACHE = "nookly-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const offline = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Offline — Nookly</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;
            min-height:100vh;display:flex;align-items:center;justify-content:center;
            background:#fff;color:#1f2937;text-align:center;padding:24px}
          .card{max-width:360px}.logo{font-size:32px;font-weight:800;color:#5A8000}
          h1{font-size:20px;margin:16px 0 8px}p{color:#6b7280;line-height:1.5}
        </style></head>
        <body><div class="card"><div class="logo">nookly</div>
        <h1>You're offline</h1><p>Check your connection and try again. Pages you've
        already visited are still available.</p></div></body></html>`;
      await cache.put(
        OFFLINE_URL,
        new Response(offline, { headers: { "Content-Type": "text/html" } })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Don't touch cross-origin (backend) API traffic.
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || (await caches.match(OFFLINE_URL)) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets: cache-first.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.startsWith("/images") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|css|js)$/.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, res.clone());
          return res;
        } catch {
          return Response.error();
        }
      })()
    );
    return;
  }

  // Everything else same-origin: network-first, cache fallback.
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(request);
        const cache = await caches.open(CACHE);
        cache.put(request, res.clone());
        return res;
      } catch {
        return (await caches.match(request)) || Response.error();
      }
    })()
  );
});
