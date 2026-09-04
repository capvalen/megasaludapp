/* ============================================================
   MegaSalud · Service Worker
   Permite que Chrome instale la app (PWA) y ofrece caché básica.
   Estrategia: network-first para navegaciones, cache-first para
   archivos estáticos (js/css/imágenes/fuentes).
   ============================================================ */

const CACHE = 'megasalud-v1';

// Instalación: precachear la página de bienvenida
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(['/bienvenida/', '/manifest.webmanifest']))
  );
  self.skipWaiting();
});

// Activar: limpiar cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: red primero; si falla (offline), usar la caché
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  // Navegaciones: red primero, caché como respaldo
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copia = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copia));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match('/bienvenida/')))
    );
    return;
  }

  // Assets: caché primero, red como respaldo
  e.respondWith(
    caches.match(request).then(
      (r) =>
        r ||
        fetch(request).then((res) => {
          if (res.ok && new URL(request.url).origin === location.origin) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
          }
          return res;
        })
    )
  );
});