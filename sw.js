// Service worker: la app sigue abriendo sin internet, pero siempre prefiere la versión más nueva.
const CACHE_NAME = 'sistema-hemoglobina-v2';
const ARCHIVOS_BASE = [
  './',
  './index.html',
  './manifest.json',
  './public/css/login.css',
  './public/css/loader.css',
  './public/js/config.js',
  './public/js/loader.js',
  './public/js/login.js',
  './public/img/icon.png',
  './public/img/icon_192.png',
  './public/img/icon_512.png'
];

self.addEventListener('install', (event) => {
  // Un archivo que falle no debe impedir que el service worker se instale.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.allSettled(ARCHIVOS_BASE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

// Primero la red (así un despliegue nuevo se ve de inmediato); si no hay internet, la copia guardada.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo se guardan archivos propios con GET. Las llamadas a la API (otro dominio) nunca pasan por la caché.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((respuesta) => {
        if (respuesta.ok) {
          const copia = respuesta.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(request).then((guardado) => guardado || caches.match('./index.html')))
  );
});
