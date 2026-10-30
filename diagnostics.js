'use strict';
async function report() {
    try {
        const manifest = await (await fetch('manifest.webmanifest')).json();
        const reg = await navigator.serviceWorker.getRegistration();
        document.getElementById('manifest-report').textContent = JSON.stringify({online: navigator.onLine, secureContext: isSecureContext, controller: navigator.serviceWorker.controller?.scriptURL || null, workerState: reg?.active?.state, manifest}, null, 2);
        const prefix = `shine-e05-${encodeURIComponent(new URL('./', location.href).pathname)}-`;
        const cachesReport = {};
        for (const name of (await caches.keys()).filter(name => name.startsWith(prefix))) cachesReport[name] = (await (await caches.open(name)).keys()).map(request => new URL(request.url).pathname + new URL(request.url).search);
        document.getElementById('cache-report').textContent = JSON.stringify(cachesReport, null, 2);
        const request = indexedDB.open(`shine-e05:${new URL('./', location.href).pathname}`, 1);
        request.onupgradeneeded = () => { request.result.createObjectStore('todos', {keyPath: 'id'}); request.result.createObjectStore('outbox', {keyPath: 'seq', autoIncrement: true}); };
        request.onsuccess = () => {
            const db = request.result;
            const result = {};
            const tx = db.transaction(['todos', 'outbox']);
            for (const name of ['todos', 'outbox']) { const read = tx.objectStore(name).count(); read.onsuccess = () => { result[name] = read.result; }; }
            tx.oncomplete = () => { document.getElementById('db-report').textContent = JSON.stringify(result, null, 2); db.close(); };
        };
        request.onerror = () => { document.getElementById('db-report').textContent = request.error.message; };
    } catch (error) { document.getElementById('manifest-report').textContent = error.message; }
}
document.getElementById('refresh').addEventListener('click', report);
void report();
