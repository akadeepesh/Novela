/*
 * Offline support. The writing itself lives in IndexedDB and never touches
 * this cache; this only keeps the app's own pages and code available when
 * there is no network.
 *
 *  - Built files (/_next/static) never change once published: cache first.
 *  - Pages and their data requests: network first, falling back to the last
 *    copy seen, so any page opened before can be reopened offline.
 *  - Never cached: anything that isn't a same-origin GET (e.g. the Research
 *    link-preview request).
 */

const VERSION = "v1"
const STATIC_CACHE = `static-${VERSION}`
const PAGE_CACHE = `pages-${VERSION}`
const OFFLINE_URL = "/offline.html"
const PRECACHE = [OFFLINE_URL, "/", "/dashboard", "/projects/new", "/settings", "/manifest.webmanifest"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGE_CACHE)
      // One failure (e.g. offline during install) shouldn't block the rest.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})))
      await self.skipWaiting()
    })()
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([STATIC_CACHE, PAGE_CACHE])
      for (const key of await caches.keys()) {
        if (!keep.has(key)) await caches.delete(key)
      }
      await self.clients.claim()
    })()
  )
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone())
  return response
}

async function networkFirst(request, { isNavigation }) {
  const cache = await caches.open(PAGE_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch (err) {
    const cached = await cache.match(request, { ignoreVary: true })
    if (cached) return cached
    if (isNavigation) {
      const offline = await cache.match(OFFLINE_URL)
      if (offline) return offline
    }
    throw err
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === "/sw.js") return

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request))
    return
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, { isNavigation: true }))
    return
  }
  // Client-side navigation data, icons, fonts and other same-origin files.
  event.respondWith(networkFirst(request, { isNavigation: false }))
})
