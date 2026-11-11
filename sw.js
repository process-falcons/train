/* Offline support. Versioned files (app.js?v=…, styles.css?v=…, icons) come straight from the cache – a release changes
   their URL. The page itself comes from the network when there is signal (so updates show straight away), else the cache. */
const VERSION = 'train-1.15.1';
const SHELL = ['./', './index.html', './app.js', './styles.css', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'train-fonts').map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function fromNetwork(req, c) {
  return fetch(req, { cache: 'no-cache' }).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }); // no-cache: revalidate, so unchanged files come back as a cheap 304
}
// app.js?v= / styles.css?v= / icons / manifest only change with a new VERSION, so the cached copy is always right
const isStatic = (url) => url.searchParams.has('v') || /\/icons\/|manifest\.webmanifest$/.test(url.pathname);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname === 'api.github.com') return; // data always goes to the network
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(caches.open('train-fonts').then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async (c) => {
    // offline right after an update: fall back to the copy cached without ?v (install precaches ./app.js etc.)
    if (isStatic(url)) return (await c.match(req)) || fromNetwork(req, c).catch(() => c.match(req, { ignoreSearch: true }));
    // the page itself: network first (so a new release shows straight away), cached copy if slow or offline
    const cached = () => c.match(req, { ignoreSearch: true }).then((h) => h || c.match('./index.html'));
    try {
      return await Promise.race([
        fromNetwork(req, c),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 2500)),
      ]);
    } catch (err) {
      return (await cached()) || fetch(req);
    }
  }));
});
