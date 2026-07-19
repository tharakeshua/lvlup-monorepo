/// <reference lib="webworker" />

const CACHE_NAME = "levelup-parent-v2";
const OFFLINE_URL = "/offline.html";
const MAX_CACHE_ENTRIES = 60;

// Domains to never cache (Firebase APIs, analytics)
const SKIP_CACHE_DOMAINS = [
  "firestore.googleapis.com",
  "identitytoolkit.googleapis.com",
  "firebaseinstallations.googleapis.com",
  "securetoken.googleapis.com",
  "www.googleapis.com",
  "firebase.googleapis.com",
];

// Pre-cache on install
const PRECACHE_URLS = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
});

// Listen for skip-waiting message from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Activate: clean old caches and claim clients
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

// Trim cache to max entries
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
  }
}

// Check if URL contains a content hash (Vite pattern: name-[hash].ext)
function isHashedAsset(url) {
  return /[-_.][a-f0-9]{8,}\.(js|css|woff2?|png|jpg|svg|webp)(\?|$)/i.test(url);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip Firebase/API domains entirely
  if (SKIP_CACHE_DOMAINS.some((d) => url.hostname.includes(d))) return;

  // Navigation: network-first with offline fallback
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed assets (immutable): cache-first, never revalidate
  if (isHashedAsset(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
              trimCache(CACHE_NAME, MAX_CACHE_ENTRIES);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // Other static assets: stale-while-revalidate
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, clone);
                trimCache(CACHE_NAME, MAX_CACHE_ENTRIES);
              });
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }
});
