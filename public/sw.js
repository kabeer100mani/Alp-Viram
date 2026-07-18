// SutraDhar service worker.
//
// Purpose: make the app installable ("Add to Home Screen" / "Install"), which
// requires a registered SW with a fetch handler. It is deliberately CONSERVATIVE
// about caching to avoid the classic PWA footgun — serving a stale app after a new
// deploy. Strategy:
//   - Cross-origin requests (Supabase REST/Auth/Edge Functions) are NEVER
//     intercepted — they always hit the network, so data/auth is never stale.
//   - Navigations are network-first, falling back to the cached shell only when
//     offline, so a fresh deploy is always fetched when online.
//   - Same-origin GET assets are network-first with a cache fallback (Vite hashes
//     filenames, so a cached old asset is never confused with a new one).
//
// Bump CACHE when the caching logic itself changes, to evict old entries.
const CACHE = 'sutradhar-v1'
const APP_SHELL = '/'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(APP_SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Only handle our own origin. Supabase (and any other API) must hit the network.
  if (url.origin !== self.location.origin) return

  // Navigations: network-first, fall back to the cached shell offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(APP_SHELL)))
    return
  }

  // Same-origin assets: network-first, cache a copy, fall back to cache offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match(req)),
  )
})
