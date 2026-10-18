// Zar Labirinti — oflayn ishlash uchun service worker.
// Yangi versiya chiqarilganda VERSION ni oshiring: eski kesh avtomatik o‘chadi.
const VERSION = 'jl-v8';
const FONTS = 'jl-fonts-v1';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-180.png', './icons/favicon.svg', './icons/favicon-32.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const put = (name, req, res) => { if (res && (res.ok || res.type === 'opaque')) caches.open(name).then((c) => c.put(req, res.clone())).catch(() => {}); return res; };

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // Sahifa: avval tarmoq (yangilanish tez yetib borsin), uzilsa — keshdagi nusxa.
    if (req.mode === 'navigate') {
      e.respondWith(fetch(req).then((r) => put(VERSION, './index.html', r)).catch(() => caches.match('./index.html')));
      return;
    }
    // Qolgan fayllar: kesh, orqada yangilanadi.
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => put(VERSION, req, r)).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  // Google Fonts: kesh, orqada yangilanadi (oflayn ham shriftlar buzilmasin).
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => put(FONTS, req, r)).catch(() => hit);
      return hit || net;
    }));
  }
});
