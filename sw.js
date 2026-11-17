'use strict';

// Gunakan URL relatif terhadap lokasi Service Worker agar tetap benar
// ketika proyek dijalankan dari subfolder seperti /5025251058_Todo-App/.
const APP_SCOPE = self.registration.scope;
const CACHE_NAME = `todo-cache-e04-${new URL(APP_SCOPE).pathname.replace(/[^a-z0-9]+/gi, '-')}-v2`;
const assetUrl = path => new URL(path, APP_SCOPE).href;
const STATIC_ASSETS = [
    'style.css',
    'script.js'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(STATIC_ASSETS.map(assetUrl));

        // Coba simpan halaman aplikasi sebagai fallback offline. Gagalnya
        // endpoint PHP (misalnya MySQL belum aktif) tidak menggagalkan instalasi SW.
        try {
            const pageUrl = assetUrl('index.php?type=personal');
            const response = await fetch(pageUrl, { credentials: 'same-origin' });
            if (response.ok) await cache.put(pageUrl, response);
        } catch (error) {
            console.warn('Halaman PHP belum dapat dicache:', error);
        }

        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames
            .filter(name => name.startsWith('todo-cache-e04-') && name !== CACHE_NAME)
            .map(name => caches.delete(name)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin ||
        !url.href.startsWith(APP_SCOPE)) {
        return;
    }

    // Jangan cache endpoint CRUD karena responsnya selalu bergantung pada database.
    if (url.pathname.endsWith('/crud.php')) return;

    if (request.mode === 'navigate') {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            try {
                const response = await fetch(request);
                if (response.ok) await cache.put(request, response.clone());
                return response;
            } catch (error) {
                const cachedPage = await cache.match(request) ||
                    await cache.match(assetUrl('index.php?type=personal'));
                if (cachedPage) return cachedPage;
                return new Response(
                    '<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><body><h1>Kamu sedang offline</h1><p>Halaman yang belum pernah dibuka belum tersedia. Sambungkan internet lalu buka aplikasi kembali.</p></body></html>',
                    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 200 }
                );
            }
        })());
        return;
    }

    if (STATIC_ASSETS.map(assetUrl).includes(url.href)) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            const cached = await cache.match(request);
            if (cached) return cached;
            return fetch(request);
        })());
    }
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const existing = windows.find(client => client.url.startsWith(APP_SCOPE));
        if (existing) return existing.focus();
        return self.clients.openWindow(assetUrl('index.php?type=personal'));
    })());
});
