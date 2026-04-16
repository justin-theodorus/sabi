const CACHE_VERSION = 'v1'
const STATIC_CACHE = `sabi-static-${CACHE_VERSION}`

// Patterns for assets that should be cached aggressively (CacheFirst)
const STATIC_PATTERNS = [
  /\/icons\//,
  /\/backgrounds\//,
  /\/npc\//,
  /\/_next\/static\//,
  /\/manifest\.json$/,
]

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  const isStatic = STATIC_PATTERNS.some((p) => p.test(url.pathname))
  if (!isStatic) return

  event.respondWith(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone())
          return response
        })
      })
    )
  )
})
