const CACHE_NAME = 'sistema-hemoglobina-v1';
const urlsToCache = [
  './',
  './index.html',
  './public/css/administrador.css',
  './public/css/editarmedico.css',
  './public/css/editarpaciente.css',
  './public/css/login.css',
  './public/css/medicos.css',
  './public/css/monitoreo.css',
  './public/css/registro.css',
  './public/js/administrador.js',
  './public/js/config.js',
  './public/js/editarmedico.js',
  './public/js/editarpaciente.js',
  './public/js/medicos.js',
  './public/js/paciente.js',
  './public/js/utils.js',
  './public/img/icon192.png',
  './public/img/icon512.png'
  // Si tienes archivos dentro de la carpeta 'view', agrégalos también aquí con su ruta relativa, por ejemplo:
  // './view/tu-vista.html'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Activación y limpieza de cachés antiguos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interceptar peticiones para servir desde la caché si no hay internet
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});