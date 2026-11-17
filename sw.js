'use strict';
// Scope-specific names avoid removing caches belonging to another localhost app.
const PREFIX = `shine-e05-${encodeURIComponent(new URL(self.registration.scope).pathname)}-`;
const SHELL = `${PREFIX}shell-v2`;
const IMAGES = `${PREFIX}images-v2`;
const local = path => new URL(path, self.registration.scope).href;
const ASSETS = ['index.html', 'index.php', 'index.php?type=personal', 'index.php?type=shared',
    'offline.html', 'diagnostics.html', 'diagnostics.js', 'style.css', 'e06.css', 'script.js',
    'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
    'icons/maskable-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(SHELL);
        await cache.addAll(ASSETS.map(local));
        await self.skipWaiting();
    })());
});
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) {
            if (name.startsWith(PREFIX) && ![SHELL, IMAGES].includes(name)) await caches.delete(name);
        }
        await self.clients.claim();
    })());
});
async function navigation(request) {
    const url = new URL(request.url);
    const base = new URL(self.registration.scope);
    const isApp = [base.pathname, `${base.pathname}index.php`].includes(url.pathname);
    const key = isApp ? local(`index.php?type=${url.searchParams.get('type') === 'shared' ? 'shared' : 'personal'}`) : request.url;
    const cache = await caches.open(SHELL);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
        const response = await fetch(request, {signal: controller.signal});
        if (response.ok) {
            if (isApp) await cache.put(key, response.clone());
            return response;
        }
        if (response.status < 500) return response;
    } catch { /* Use a precached page when the server cannot be reached. */ }
    finally { clearTimeout(timer); }
    return (await cache.match(key)) || (await cache.match(local('offline.html')));
}
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
    // API responses are never cached; task data uses IndexedDB and the outbox.
    const apiBase = new URL('backend/todo/', self.registration.scope).pathname;
    if (url.pathname === apiBase || url.pathname.startsWith(apiBase)) return;
    if (request.mode === 'navigate') {
        event.respondWith(navigation(request));
        return;
    }
    if (url.pathname.startsWith(new URL('uploads/', self.registration.scope).pathname)) {
        event.respondWith((async () => {
            const cache = await caches.open(IMAGES);
            const cached = await cache.match(request);
            if (cached) return cached;
            try {
                const response = await fetch(request);
                if (response.ok) await cache.put(request, response.clone());
                return response;
            } catch { return Response.error(); }
        })());
        return;
    }
    if (ASSETS.map(local).includes(url.href)) {
        event.respondWith((async () => (await (await caches.open(SHELL)).match(request)) || fetch(request))());
    }
});
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil((async () => {
        const windows = await self.clients.matchAll({type: 'window', includeUncontrolled: true});
        const existing = windows.find(client => client.url.startsWith(self.registration.scope));
        if (existing) return existing.focus();
        return self.clients.openWindow(local('index.php?type=personal'));
    })());
});
