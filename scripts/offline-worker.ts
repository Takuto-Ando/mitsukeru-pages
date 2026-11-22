type Release = {
  base: string;
  prefix: string;
  version: string;
  urls: string[];
  optionalUrls: string[];
  documents: Record<string, string>;
};

export function renderOfflineWorker(release: Release): string {
  return `
const {base, prefix, version, urls, optionalUrls, documents} = ${JSON.stringify(release)};
const cacheName = prefix + version;
const precache = new Set(urls);
const optional = new Set(optionalUrls);
const isHtml = response => /text\\/html/i.test(response.headers.get("Content-Type") || "");

self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName);
  try {
    const requests = urls.map(url => new Request(new URL(url, self.location.origin), {cache: "reload"}));
    await cache.addAll(requests);
    // Static hosts can return their HTML fallback with HTTP 200 for a missing chunk.
    for (const request of requests) {
      if (!/\\.(?:m?js|css|wasm)$/.test(new URL(request.url).pathname)) continue;
      const response = await cache.match(request);
      if (!response || isHtml(response)) {
        throw new Error("Missing release asset: " + request.url);
      }
    }
  } catch (error) {
    await caches.delete(cacheName);
    throw error;
  }
})()));

// The browser activates the waiting worker once no documents use the old
// release. Avoid skipWaiting and clients.claim, which can mix releases in a tab.
self.addEventListener("activate", event => event.waitUntil((async () => {
  for (const name of await caches.keys()) {
    if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
  }
})()));

self.addEventListener("message", event => {
  if (event.data === "offline-status") event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const ready = (await Promise.all(urls.map(url => cache.match(url)))).every(Boolean);
    event.ports[0]?.postMessage({ready, version});
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith(base)) return;

  if (request.mode === "navigate") {
    const path = url.pathname.slice(base.length).replace(/\\/$/, "");
    const entry = path.endsWith(".html") ? path : (path ? path + "/" : "") + "index.html";
    if (Object.hasOwn(documents, entry)) {
      // The document and its asset manifest must always come from the same release.
      event.respondWith(Promise.resolve(new Response(documents[entry], {
        headers: {"Content-Type": "text/html; charset=utf-8"},
      })));
    }
  } else if (precache.has(url.pathname) || optional.has(url.pathname)) {
    event.respondWith(caches.open(cacheName).then(async cache => {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok && optional.has(url.pathname)) {
        if (isHtml(response)) return Response.error();
        await cache.put(url.pathname, response.clone()).catch(() => {});
      }
      return response;
    }));
  }
});
`;
}
