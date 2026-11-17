'use strict';
const $ = id => document.getElementById(id);
const CURRENT_TYPE = new URLSearchParams(location.search).get('type') === 'shared' ? 'shared' : 'personal';
const DB_NAME = `shine-e05:${new URL('./', location.href).pathname}`;
const API_URL = 'backend/todo/';
const ALLOWED_IMAGES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const PRIORITIES = ['low', 'medium', 'high'];
let db, todosData = [], selectedId = null, editingTaskId = null, detailURL = null, syncing = false, deferredPrompt = null;
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
        const priority = document.createElement('span');
        priority.className = `priority-badge priority-${PRIORITIES.includes(todo.prioritas) ? todo.prioritas : 'medium'}`;
        priority.textContent = ({low: 'Low', medium: 'Medium', high: 'High'})[todo.prioritas] || 'Medium';
        checkbox.addEventListener('change', () => updateStatus(todo.id, checkbox.checked).catch(errorMessage));
        const actions = document.createElement('div'); actions.className = 'actions';
        const view = document.createElement('button'); view.type = 'button'; view.className = 'btn-edit'; view.textContent = 'View';
        view.addEventListener('click', () => { selectedId = todo.id; showDetail(todo); });
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'btn-edit'; edit.textContent = 'Edit';
        edit.addEventListener('click', () => editTodo(todo.id));
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn-delete'; remove.textContent = 'Del';
        remove.addEventListener('click', () => deleteTodo(todo.id).catch(errorMessage));
        actions.append(view, edit, remove); li.append(checkbox, label, priority, actions);
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
    const priorityLabel = ({low: 'Low', medium: 'Medium', high: 'High'})[todo.prioritas] || 'Medium';
    $('detail-desc').textContent = `${todo.description || 'Tidak ada deskripsi.'}\n\nPrioritas: ${priorityLabel}`;
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
        await enqueue('patch', {...task, completed: completed ? 1 : 0});
        await refresh();
    });
    say('Status disimpan di perangkat.'); void sync();
}
function resetTodoForm() {
    editingTaskId = null;
    $('todo-form').reset();
    $('add-btn').textContent = 'Add Todo';
    $('cancel-edit-btn').hidden = true;
    $('create-task-title').textContent = `Create New ${CURRENT_TYPE[0].toUpperCase()}${CURRENT_TYPE.slice(1)} Task`;
}

function editTodo(id) {
    const task = todosData.find(todo => todo.id === id);
    if (!task) return;
    editingTaskId = id;
    $('title').value = task.title || '';
    $('description').value = task.description || '';
    $('notify-time').value = task.notify_time ? task.notify_time.replace(' ', 'T').slice(0, 16) : '';
    $('priority').value = PRIORITIES.includes(task.prioritas) ? task.prioritas : 'medium';
    $('image-capture').value = '';
    $('add-btn').textContent = 'Update Todo';
    $('cancel-edit-btn').hidden = false;
    $('create-task-title').textContent = 'Edit Todo Task';
    $('title').focus();
    say('Mode edit aktif. Ubah data lalu tekan Update Todo.');
}

$('cancel-edit-btn').addEventListener('click', resetTodoForm);

async function deleteTodo(id) {
    if (!confirm('Yakin ingin menghapus task ini?')) return;
    await serial(async () => {
        const task = (await readStore('todos')).find(todo => todo.id === id);
        if (!task) return;
        await enqueue('delete', task);
        await refresh();
    });
    say('Tugas dihapus di perangkat.'); void sync();
}
$('todo-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!db) return;
    const title = $('title').value.trim();
    const description = $('description').value;
    const deadline = $('notify-time').value;
    const image = $('image-capture').files[0];
    if (!title) { say('Judul tidak boleh kosong.'); return; }
    if (!deadline) { say('Deadline wajib diisi untuk Todo baru.'); return; }
    if (new TextEncoder().encode(description).length > 60000) { say('Deskripsi terlalu panjang (maksimal 60000 byte).'); return; }
    if (image && (!ALLOWED_IMAGES.includes(image.type) || image.size > 2 * 1024 * 1024)) { say('Gunakan gambar PNG/JPEG/WebP/GIF maksimal 2 MB.'); return; }
    $('add-btn').disabled = true;
    try {
        await serial(async () => {
            if (editingTaskId !== null) {
                const existing = (await readStore('todos')).find(todo => todo.id === editingTaskId);
                if (!existing) throw new Error('Todo yang akan diedit tidak ditemukan.');
                await enqueue('put', {...existing, title, description,
                    notify_time: deadline, prioritas: $('priority').value || 'medium',
                    image_blob: image || existing.image_blob || null,
                    image_path: image ? null : existing.image_path});
                resetTodoForm();
                await refresh();
                say('Perubahan Todo disimpan. Sinkronisasi akan menggunakan HTTP PUT.');
            } else {
                await enqueue('put', {id: uid(), title, description, completed: 0, todo_type: CURRENT_TYPE,
                    notify_time: deadline, prioritas: $('priority').value || 'medium',
                    image_blob: image || null, image_path: null, created_at: new Date().toISOString()});
                resetTodoForm();
                await refresh();
                say('Tugas tersimpan di perangkat.');
            }
        });
        void sync();
    } catch (error) { errorMessage(error); }
    finally { $('add-btn').disabled = false; }
});
async function api(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const headers = new Headers(options.headers || {});
        if (typeof options.body === 'string' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }
        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'same-origin',
            signal: controller.signal,
            cache: 'no-store'
        });
        let payload = {};
        try { payload = await response.json(); }
        catch { throw new Error(`Respons server bukan JSON (HTTP ${response.status}).`); }
        if (!response.ok || payload.status === 'error') {
            throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
        }
        return payload;
    } finally {
        clearTimeout(timer);
    }
}

function blobToDataURL(blob) {
    if (!blob) return Promise.resolve('');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Gambar gagal dibaca sebelum sinkronisasi.'));
        reader.readAsDataURL(blob);
    });
}

function persistServerId(clientId, serverId) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['todos', 'outbox'], 'readwrite');
        const todoStore = tx.objectStore('todos');
        const todoRequest = todoStore.get(clientId);
        todoRequest.onsuccess = () => {
            if (todoRequest.result) {
                todoRequest.result.server_id = Number(serverId);
                todoStore.put(todoRequest.result);
            }
        };

        const outboxStore = tx.objectStore('outbox');
        const queueRequest = outboxStore.getAll();
        queueRequest.onsuccess = () => {
            for (const queuedOperation of queueRequest.result) {
                if (queuedOperation.task && queuedOperation.task.id === clientId) {
                    queuedOperation.task.server_id = Number(serverId);
                    outboxStore.put(queuedOperation);
                }
            }
        };
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error('ID server gagal disimpan ke antrean lokal.'));
        tx.onerror = () => reject(tx.error || new Error('Transaksi IndexedDB gagal.'));
    });
}

function fromServerTodo(serverTodo, oldTodo = null) {
    return {
        id: String(serverTodo.client_id || serverTodo.id),
        server_id: Number(serverTodo.server_id || serverTodo.id),
        title: serverTodo.title || serverTodo.judul || '',
        description: serverTodo.description || serverTodo.deskripsi || '',
        completed: Number(serverTodo.completed ?? serverTodo.selesai ?? 0),
        notify_time: serverTodo.notify_time || serverTodo.waktu_notif || null,
        image_path: serverTodo.image_path || serverTodo.lampiran || null,
        image_blob: oldTodo?.image_blob || null,
        todo_type: serverTodo.todo_type || serverTodo.kategori,
        prioritas: serverTodo.prioritas || 'medium',
        created_at: serverTodo.created_at || new Date().toISOString()
    };
}

async function syncOperation(op) {
    const task = op.task || {};
    const category = task.todo_type || CURRENT_TYPE;
    const identifier = task.server_id || task.id;
    const endpoint = `${API_URL}${category}/${encodeURIComponent(String(identifier))}`;

    if (op.action === 'delete') {
        await api(endpoint, {
            method: 'DELETE',
            body: JSON.stringify({op_id: op.op_id})
        });
        return;
    }

    if (op.action === 'patch') {
        await api(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({op_id: op.op_id, status: Number(task.completed) ? 1 : 0})
        });
        return;
    }

    if (op.action !== 'put') {
        throw new Error(`Jenis operasi lokal tidak dikenal: ${op.action}`);
    }

    const attachment = task.image_blob ? await blobToDataURL(task.image_blob) : '';
    const payload = {
        op_id: op.op_id,
        client_id: String(task.id),
        judul: task.title,
        desc: task.description || '',
        waktuNotif: task.notify_time || '',
        prioritas: PRIORITIES.includes(task.prioritas) ? task.prioritas : 'medium',
        kategori: category,
        selesai: Number(task.completed) ? 1 : 0,
        lampiran: attachment,
        // Hanya operasi lama dari IndexedDB E05 yang mungkin tidak memiliki deadline.
        migrasiE05: !task.notify_time
    };

    if (task.server_id) {
        await api(endpoint, {method: 'PUT', body: JSON.stringify(payload)});
    } else {
        const result = await api(API_URL, {method: 'POST', body: JSON.stringify(payload)});
        const serverId = result.data?.server_id || result.data?.id;
        if (!serverId) throw new Error('Server tidak mengembalikan ID tugas setelah POST.');
        await persistServerId(String(task.id), serverId);
    }
}

async function flushOutbox() {
    const initialQueue = await readStore('outbox');
    for (const queued of initialQueue) {
        // Ambil ulang operasi dari IndexedDB: POST sebelumnya mungkin baru saja
        // menyimpan server_id ke operasi PUT/PATCH/DELETE untuk task yang sama.
        const latest = (await readStore('outbox')).find(item => item.seq === queued.seq);
        if (!latest) continue;
        await syncOperation(latest);
        const tx = db.transaction('outbox', 'readwrite');
        const completed = done(tx);
        tx.objectStore('outbox').delete(latest.seq);
        await completed;
    }
}

async function fetchServerTodos() {
    // Request pertama membuat cookie JWT jika browser belum memilikinya.
    // Lakukan berurutan supaya dua request awal tidak membuat dua user anonim.
    const personal = await api(`${API_URL}personal`);
    const shared = await api(`${API_URL}shared`);
    return [
        ...(Array.isArray(personal.data) ? personal.data : []),
        ...(Array.isArray(shared.data) ? shared.data : [])
    ];
}
async function migrateLocalE05Tasks(serverTodos) {
    const migrationKey = `shine-e06-local-migrated:${new URL('./', location.href).pathname}`;
    try {
        if (localStorage.getItem(migrationKey) === '1') return serverTodos;
    } catch { /* Continue; server client_id still prevents duplicates. */ }

    const localTodos = await readStore('todos');
    const remoteIds = new Set(serverTodos.map(todo => String(todo.client_id || todo.id)));
    const queuedIds = new Set((await readStore('outbox')).map(operation => String(operation.task?.id || '')));
    const missing = localTodos.filter(todo => !remoteIds.has(String(todo.id)) && !queuedIds.has(String(todo.id)));

    for (const originalTask of missing) {
        const task = {...originalTask};
        // A server_id from E05 cannot be reused in the separate E06 database.
        delete task.server_id;
        if (task.image_path && !task.image_blob) {
            try {
                const imageUrl = new URL(task.image_path, location.href);
                if (imageUrl.origin === location.origin) {
                    const response = await fetch(imageUrl, {cache: 'no-store'});
                    if (response.ok) task.image_blob = await response.blob();
                }
            } catch { /* Task data is migrated even if an old attachment is unavailable. */ }
        }
        await enqueue('put', task);
    }

    if (missing.length) {
        await flushOutbox();
        serverTodos = await fetchServerTodos();
    }
    try { localStorage.setItem(migrationKey, '1'); } catch { /* No localStorage: remote client_id keeps retry safe. */ }
    return serverTodos;
}

async function sync() {
    if (!db || syncing) return;
    if (!navigator.onLine) {
        await refresh();
        say('Mode offline: semua perubahan disimpan di perangkat.');
        return;
    }

    syncing = true;
    $('sync-btn').disabled = true;
    try {
        await serial(async () => {
            await flushOutbox();
            let serverTodos = await fetchServerTodos();
            // Impor satu kali snapshot E05 yang sebelumnya sudah tersimpan di IndexedDB.
            // Ini mencegah tugas offline lama terhapus ketika database E06 masih kosong.
            serverTodos = await migrateLocalE05Tasks(serverTodos);
            const old = new Map((await readStore('todos')).map(task => [task.id, task]));
            const localTodos = serverTodos.map(serverTodo => fromServerTodo(
                serverTodo,
                old.get(String(serverTodo.client_id || serverTodo.id))
            ));

            for (const task of localTodos) {
                if (task.image_path && !task.image_blob) {
                    try {
                        const response = await fetch(task.image_path, {signal: AbortSignal.timeout(5000), cache: 'no-store'});
                        if (response.ok) task.image_blob = await response.blob();
                    } catch { /* Gambar bisa dimuat kembali ketika koneksi pulih. */ }
                }
            }

            const tx = db.transaction('todos', 'readwrite');
            const completed = done(tx);
            tx.objectStore('todos').clear();
            localTodos.forEach(task => tx.objectStore('todos').put(task));
            await completed;
            await refresh();
            say('Semua perubahan sudah tersinkron ke MySQL melalui REST API.');
        });
    } catch (error) {
        await refresh();
        say(`Server belum dapat disinkronkan. Data tetap di perangkat. ${error.message}`);
    } finally {
        syncing = false;
        $('sync-btn').disabled = false;
    }
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
