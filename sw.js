/* Christian Armory service worker: offline-first app shell.
   Bump CACHE whenever ASSET_V changes so updates reach installed apps. */
var CACHE = "christian-armory-20261028a";
var CORE = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/defenses-1.json",
  "/defenses-2.json",
  "/defenses-3.json",
  "/defenses-4.json",
  "/defenses-5.json",
  "/defenses-6.json",
  "/defenses-7.json",
  "/defenses-8.json",
  "/defenses-9.json",
  "/glossary.json",
  "/apostles.json",
  "/verses-1.json",
  "/verses-2.json",
  "/icon-192.png",
  "/icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(CORE); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return; // leave third parties alone
  e.respondWith(
    e.request.mode === "navigate"
      // pages: fresh when online, cached when offline
      ? fetch(e.request).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        }).catch(function () { return caches.match(e.request); })
      // assets: cached first (they are versioned), network fills gaps
      : caches.match(e.request).then(function (hit) {
          if (hit) return hit;
          return fetch(e.request).then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
            }
            return res;
          });
        })
  );
});
