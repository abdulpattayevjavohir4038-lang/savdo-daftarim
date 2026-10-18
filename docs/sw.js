// Minimarket POS — internetsiz ochilish uchun (versiya: caa9029ba3)
const CACHE = 'mm-caa9029ba3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const withTimeout = (p, ms) => new Promise((ok, no) => { const t = setTimeout(() => no(new Error('timeout')), ms); p.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); no(e); }); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return; // server (API) va shriftlar — to'g'ridan-to'g'ri tarmoqdan
  const page = req.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('/');
  if (page) {
    // sahifa: avval tarmoq (yangi versiya darhol keladi), internet bo'lmasa — saqlangan nusxa
    e.respondWith(withTimeout(fetch(req), 6000).then((res) => {
      if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match(u.pathname.endsWith('panel.html') ? './panel.html' : './index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(req, cp)); } return res; })));
});
