'use strict';
const $ = id => document.getElementById(id);
const CURRENT_TYPE = new URLSearchParams(location.search).get('type') === 'shared' ? 'shared' : 'personal';
const DB_NAME = `shine-e05:${new URL('./', location.href).pathname}`;
const ALLOWED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
let db, todosData = [], selectedId = null, detailURL = null, syncing = false, deferredPrompt = null;
let fallbackLock = Promise.resolve();
const uid = () => crypto.randomUUID();
const requestResult = request => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
const done = tx => new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('Tidak dapat menyimpan data.'));
    tx.onerror = () => reject(tx.error);
});
function serial(work) {
    if (navigator.locks) return navigator.locks.request(DB_NAME, work);
    const result = fallbackLock.then(work, work);
    fallbackLock = result.catch(() => {});
    return result;
}
function say(text) { $('app-message').textContent = text; }
function errorMessage(error) { say(`Belum berhasil: ${error.message}`); }
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore('todos', {keyPath: 'id'});
            request.result.createObjectStore('outbox', {keyPath: 'seq', autoIncrement: true});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('Tutup tab Todo lama lalu muat ulang.'));
    });
}
async function readStore(name) {
    const tx = db.transaction(name);
    const completed = done(tx);
    const values = await requestResult(tx.objectStore(name).getAll());
    await completed;
    return values;
}
async function refresh() {
    const [all, queue] = await Promise.all([readStore('todos'), readStore('outbox')]);
    const pending = new Set(queue.map(op => op.task.id));
    todosData = all.filter(task => task.todo_type === CURRENT_TYPE).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    $('todo-list').replaceChildren();
    if (!todosData.length) {
        const li = document.createElement('li');
        li.textContent = 'Belum ada tugas. Tambahkan tugas pertamamu.';
        $('todo-list').append(li);
    }
    for (const todo of todosData) {
        const li = document.createElement('li');
        li.className = 'todo-item';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox'; checkbox.id = `task-${todo.id}`; checkbox.checked = Boolean(Number(todo.completed));
        const label = document.createElement('label');
        label.htmlFor = checkbox.id; label.textContent = todo.title;
        checkbox.addEventListener('change', () => updateStatus(todo.id, checkbox.checked).catch(errorMessage));
        const actions = document.createElement('div'); actions.className = 'actions';
        const view = document.createElement('button'); view.type = 'button'; view.className = 'btn-edit'; view.textContent = 'View';
        view.addEventListener('click', () => { selectedId = todo.id; showDetail(todo); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn-delete'; remove.textContent = 'Del';
        remove.addEventListener('click', () => deleteTodo(todo.id).catch(errorMessage));
        actions.append(view, remove); li.append(checkbox, label, actions);
        if (pending.has(todo.id)) { const badge = document.createElement('span'); badge.className = 'pending'; badge.textContent = 'Menunggu sinkronisasi'; li.append(badge); }
        $('todo-list').append(li);
    }
    const selected = todosData.find(task => task.id === selectedId);
    if (selected) showDetail(selected);
    else { selectedId = null; clearDetail(); }
    $('connection-status').textContent = `${navigator.onLine ? 'Online' : 'Offline'} · ${queue.length} perubahan menunggu sinkronisasi`;
}
function clearDetail() {
    if (detailURL) URL.revokeObjectURL(detailURL);
    detailURL = null;
    $('detail-title').textContent = 'Pilih task buat lihat detailnya';
    $('detail-status').textContent = '-'; $('detail-time').textContent = '-';
    $('detail-desc').textContent = 'Deskripsi akan muncul di sini.';
    $('detail-img').style.display = 'none'; $('detail-img').removeAttribute('src');
}
function showDetail(todo) {
    if (detailURL) URL.revokeObjectURL(detailURL);
    detailURL = todo.image_blob ? URL.createObjectURL(todo.image_blob) : null;
    $('detail-title').textContent = todo.title;
    $('detail-status').textContent = Number(todo.completed) ? 'Completed' : 'Pending';
    $('detail-time').textContent = todo.notify_time ? new Date(todo.notify_time.replace(' ', 'T')).toLocaleString('id-ID') : 'No notification set';
    $('detail-desc').textContent = todo.description || 'Tidak ada deskripsi.';
    const src = detailURL || todo.image_path;
    $('detail-img').style.display = src ? 'block' : 'none';
    if (src) $('detail-img').src = src; else $('detail-img').removeAttribute('src');
}
async function enqueue(action, task) {
    const tx = db.transaction(['todos', 'outbox'], 'readwrite');
    const completed = done(tx);
    if (action === 'delete') tx.objectStore('todos').delete(task.id);
    else tx.objectStore('todos').put(task);
    tx.objectStore('outbox').add({op_id: uid(), action, task});
    await completed; // Task and operation are committed atomically.
}
async function updateStatus(id, completed) {
    await serial(async () => {
        const task = (await readStore('todos')).find(todo => todo.id === id);
        if (!task) return;
        await enqueue('put', {...task, completed: completed ? 1 : 0});
        await refresh();
    });
    say('Status disimpan di perangkat.'); void sync();
}
async function deleteTodo(id) {
    if (!confirm('Yakin ingin menghapus task ini?')) return;
    await serial(async () => { await enqueue('delete', {id}); await refresh(); });
    say('Tugas dihapus di perangkat.'); void sync();
}
$('todo-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!db) return;
    const title = $('title').value.trim();
    const description = $('description').value;
    const image = $('image-capture').files[0];
    if (!title) { say('Judul tidak boleh kosong.'); return; }
    if (new TextEncoder().encode(description).length > 60000) { say('Deskripsi terlalu panjang (maksimal 60000 byte).'); return; }
    if (image && (!ALLOWED_IMAGES.includes(image.type) || image.size > 2 * 1024 * 1024)) { say('Gunakan gambar PNG/JPEG/WebP/GIF maksimal 2 MB.'); return; }
    $('add-btn').disabled = true;
    try {
        await serial(async () => {
            await enqueue('put', {id: uid(), title, description, completed: 0, todo_type: CURRENT_TYPE,
                notify_time: $('notify-time').value || null, image_blob: image || null, image_path: null, created_at: new Date().toISOString()});
            $('todo-form').reset(); await refresh();
        });
        say('Tugas tersimpan di perangkat.'); void sync();
    } catch (error) { errorMessage(error); }
    finally { $('add-btn').disabled = false; }
});
async function api(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(url, {...options, signal: controller.signal, cache: 'no-store'});
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
        return payload;
    } finally { clearTimeout(timer); }
}
async function sync() {
    if (!db || syncing) return;
    if (!navigator.onLine) { await refresh(); say('Mode offline: semua perubahan disimpan di perangkat.'); return; }
    syncing = true; $('sync-btn').disabled = true;
    try {
        await serial(async () => {
            for (const op of await readStore('outbox')) {
                const data = new FormData();
                const {image_blob, ...task} = op.task;
                data.append('operation', JSON.stringify({op_id: op.op_id, action: op.action, task}));
                if (image_blob) data.append('image', image_blob, 'task-image');
                await api('crud.php?action=sync', {method: 'POST', body: data});
                const tx = db.transaction('outbox', 'readwrite');
                const completed = done(tx); tx.objectStore('outbox').delete(op.seq); await completed;
            }
            const snapshot = await api('crud.php?action=get');
            if (!Array.isArray(snapshot.todos)) throw new Error('Respons server tidak valid.');
            const old = new Map((await readStore('todos')).map(task => [task.id, task]));
            for (const task of snapshot.todos) {
                task.completed = Number(task.completed);
                task.image_blob = old.get(task.id)?.image_blob || null;
                if (old.get(task.id)?.image_path && old.get(task.id).image_path !== task.image_path) task.image_blob = null;
                if (task.image_path && !task.image_blob) {
                    try {
                        const response = await fetch(task.image_path, {signal: AbortSignal.timeout(5000)});
                        if (response.ok) task.image_blob = await response.blob();
                    } catch { /* Server image may be fetched on a later sync. */ }
                }
            }
            const tx = db.transaction('todos', 'readwrite');
            const completed = done(tx); tx.objectStore('todos').clear();
            snapshot.todos.forEach(task => tx.objectStore('todos').put(task)); await completed;
            await refresh(); say('Semua perubahan sudah tersinkron ke MySQL.');
        });
    } catch (error) {
        await refresh();
        say(`Server belum dapat disinkronkan. Data tetap di perangkat. ${error.message}`);
    } finally { syncing = false; $('sync-btn').disabled = false; }
}
$('sync-btn').addEventListener('click', () => void sync());
window.addEventListener('online', () => void sync());
window.addEventListener('offline', () => { if (db) void refresh().then(() => say('Mode offline: tambah, centang, dan hapus tugas tetap tersedia.')).catch(errorMessage); });
window.addEventListener('focus', () => { if (db) void serial(refresh).catch(errorMessage); });
setInterval(() => { if (db && navigator.onLine) void sync(); }, 30000);

try { if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode'); } catch {}
$('theme-toggle').addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    try { localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light'); } catch {}
});
window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event; $('install-btn').textContent = 'Install App';
});
window.addEventListener('appinstalled', () => { deferredPrompt = null; $('install-btn').textContent = 'App Terpasang'; say('Todo App berhasil dipasang.'); });
$('install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
        const prompt = deferredPrompt; deferredPrompt = null;
        try { await prompt.prompt(); const choice = await prompt.userChoice; say(choice.outcome === 'accepted' ? 'Permintaan instalasi diterima.' : 'Instalasi dibatalkan. Kamu bisa mencoba lagi lewat menu browser.'); }
        catch (error) { errorMessage(error); }
    } else $('install-help').showModal();
});
$('notification-btn').addEventListener('click', async () => {
    if (!('Notification' in window)) { say('Browser ini belum mendukung notifikasi.'); return; }
    const permission = await Notification.requestPermission();
    say(permission === 'granted' ? 'Pengingat aktif selama aplikasi terbuka.' : 'Izin notifikasi belum diberikan.');
});
setInterval(async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker?.controller) return;
    for (const task of todosData) {
        if (!task.notify_time || Number(task.completed) || Date.now() < new Date(task.notify_time.replace(' ', 'T')).getTime()) continue;
        const key = `${DB_NAME}:notified:${task.id}:${task.notify_time}`;
        try {
            if (localStorage.getItem(key)) continue;
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification('To-Do Reminder!', {body: `Saatnya mengerjakan: ${task.title}`, icon: 'icons/icon-192.png', tag: task.id});
            localStorage.setItem(key, '1');
        } catch { /* A blocked notification must not interrupt task operations. */ }
    }
}, 30000);
async function registerWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) { $('sw-status').textContent = 'Mode offline memerlukan browser pendukung dan localhost/HTTPS.'; return; }
    try {
        await navigator.serviceWorker.register('sw.js', {updateViaCache: 'none'});
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once: true}));
        $('sw-status').textContent = 'Mode offline siap · app shell tersimpan';
    } catch (error) { $('sw-status').textContent = `Mode offline belum siap: ${error.message}`; }
}
void registerWorker();
(async () => {
    try { db = await openDB(); db.onversionchange = () => { db.close(); location.reload(); }; await refresh(); $('add-btn').disabled = false; void sync(); }
    catch (error) { say(`Penyimpanan lokal tidak tersedia: ${error.message}. Izinkan penyimpanan situs lalu muat ulang.`); }
})();
