/* Alaga Program installability service worker.
 * Requests stay network-first; application data is not cached here.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // A fetch handler is required by older installability checks. The browser
  // continues handling requests normally because respondWith is not called.
});
