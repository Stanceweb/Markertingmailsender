// Placeholder service worker script to avoid 404s.
// If you don't intend to use a service worker, this can remain empty.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  self.clients.claim();
});
