/* Offline support. App files come from the network when there is signal (so updates show straight away)
   and from the cache when there isn't. */
const VERSION = 'train-1.10.0';
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
  return fetch(req, { cache: 'no-store' }).then((res) => { if (res.ok) c.put(req, res.clone()); return res; });
}

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
  // Network first with a 3 s limit, then the cached copy.
  e.respondWith(caches.open(VERSION).then(async (c) => {
    const cached = () => c.match(req, { ignoreSearch: true }).then((h) => h || c.match('./index.html'));
    try {
      return await Promise.race([
        fromNetwork(req, c),
        new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3000)),
      ]);
    } catch (err) {
      return (await cached()) || fetch(req);
    }
  }));
});
