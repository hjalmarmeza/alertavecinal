const CACHE_NAME = 'alertavecinal-vecino-v6'; // Versión 2.6 - Flexbox Pure Fix
const ASSETS = [
    './',
    './index.html?v=6.5',
    './css/style.css?v=6.5',
    './js/app.js?v=6.5',
    './manifest.json',
    'https://fonts.googleapis.com/icon?family=Material+Icons+Round'
];

// Instalación: Cachear recursos y forzar espera
self.addEventListener('install', (e) => {
    // Forzar activación inmediata de esta nueva versión (Skip Waiting)
    self.skipWaiting();

    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

// Activación: Tomar control y limpiar caches viejos
self.addEventListener('activate', (e) => {
    e.waitUntil(
        Promise.all([
            self.clients.claim(), // Tomar control inmediato de los clientes
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
                );
            })
        ])
    );
});

// Fetch: Estrategia Híbrida Inteligente
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // ESTRATEGIA 1: Network-First (Internet Primero)
    // Añadimos .css para que los cambios de diseño lleguen rápido
    if (url.pathname.endsWith('index.html') ||
        url.pathname.endsWith('app.js') ||
        url.pathname.endsWith('style.css') ||
        url.pathname.endsWith('/')) {

        e.respondWith(
            fetch(e.request)
                .then(res => {
                    // Si responde la red, actualizamos caché y entregamos
                    const resClone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
                    return res;
                })
                .catch(() => {
                    // Si falla la red (offline), usamos caché
                    return caches.match(e.request);
                })
        );
        return;
    }

    // ESTRATEGIA 2: Cache-First (Velocidad)
    // Para recursos estáticos (CSS, Imágenes, Fuentes, Manifiesto)
    // Se sirven desde caché para máxima velocidad, pero se pueden actualizar en segundo plano.
    e.respondWith(
        caches.match(e.request).then((response) => {
            return response || fetch(e.request);
        })
    );
});
