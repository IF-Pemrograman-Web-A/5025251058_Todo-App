/* Run against an isolated test database: this suite creates and deletes test tasks. */
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = (process.env.BASE_URL || 'http://127.0.0.1:8080/todo-app/').replace(/\/?$/, '/');
const proof = path.join(__dirname, '../docs/proof');
fs.mkdirSync(proof, {recursive: true});
const results = [];
const pass = name => { results.push({name, status: 'PASS'}); console.log('PASS', name); };
async function waitText(page, selector, text) { await page.waitForFunction(({selector, text}) => document.querySelector(selector)?.textContent.includes(text), {selector, text}, {timeout: 25000}); }
async function synced(page) { await waitText(page, '#app-message', 'Semua perubahan sudah tersinkron'); await waitText(page, '#connection-status', '0 perubahan'); }
(async () => {
    const browser = await chromium.launch({headless: true, ...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: 'chromium'}), args: ['--no-sandbox']});
    const context = await browser.newContext({viewport: {width: 1440, height: 1100}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let taskIds = [];
    try {
        await page.goto(base + 'index.php?type=personal');
        await synced(page);
        await waitText(page, '#sw-status', 'Mode offline siap');
        pass('PHP shell, MySQL snapshot, IndexedDB and service worker ready');
        const cdp = await context.newCDPSession(page);
        const manifest = await cdp.send('Page.getAppManifest');
        assert.deepEqual(manifest.errors, []);
        const parsed = JSON.parse(manifest.data);
        assert.equal(parsed.display, 'standalone');
        assert.equal(parsed.icons.length, 3);
        for (const icon of parsed.icons) {
            const size = await page.evaluate(async src => { const img = new Image(); img.src = src; await img.decode(); return `${img.naturalWidth}x${img.naturalHeight}`; }, icon.src);
            assert.equal(size, icon.sizes);
        }
        const installability = await cdp.send('Page.getInstallabilityErrors');
        assert.deepEqual(installability.installabilityErrors, []);
        pass('Chrome DevTools Protocol: valid manifest, real PNG dimensions, no installability errors');
        const caches = await page.evaluate(async () => { const out = {}; for (const name of await window.caches.keys()) out[name] = (await (await window.caches.open(name)).keys()).map(r => r.url); return out; });
        const shell = Object.entries(caches).find(([name]) => name.endsWith('shell-v1'));
        assert(shell);
        assert(shell[1].some(url => url.endsWith('index.php?type=shared')));
        assert(shell[1].some(url => url.endsWith('offline.html')));
        assert(!Object.values(caches).flat().some(url => url.includes('crud.php')));
        fs.writeFileSync(path.join(proof, 'devtools-protocol.json'), JSON.stringify({base, manifest, installability, cacheStorage: caches}, null, 2));
        pass('App shell, both task routes and offline fallback precached; API never cached');
        await page.screenshot({path: path.join(proof, '01-online.png'), fullPage: true});
        const apiGet = async () => (await (await context.request.get(base + 'crud.php?action=get')).json()).todos;
        const initial = await apiGet();
        // Create online, check literal rendering and successful backend persistence.
        const label = `E05 test ${Date.now()}`;
        const dangerous = `${label} <img src=x onerror=alert(1)>`;
        await page.locator('#title').fill(dangerous);
        await page.locator('#description').fill('Pengujian online ke MySQL.');
        await page.locator('#todo-form').evaluate(form => form.requestSubmit());
        await waitText(page, '#todo-list', dangerous);
        await synced(page);
        let rows = await apiGet();
        const onlineTask = rows.find(t => t.title === dangerous);
        assert(onlineTask); taskIds.push(onlineTask.id);
        assert.equal(await page.locator('.todo-item label').filter({hasText: dangerous}).count(), 1);
        assert.equal(await page.locator('.todo-list img').count(), 0);
        pass('Online create persists to MySQL and titles render as plain text');
        // Going offline before visiting Shared demonstrates precache of that route.
        await context.setOffline(true);
        // New Chromium separates network emulation from navigator.onLine state.
        await cdp.send('Network.overrideNetworkState', {offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0}).catch(() => {});
        await page.reload();
        await waitText(page, '#connection-status', 'Offline');
        await page.goto(base + 'index.php?type=shared');
        await waitText(page, '#connection-status', 'Offline');
        assert.equal(await page.locator('#task-list-title').textContent(), 'Shared Task List');
        const sharedExpected = initial.filter(t => t.todo_type === 'shared');
        for (const task of sharedExpected) await waitText(page, '#todo-list', task.title);
        pass('Offline reload and first-time Shared navigation work with cached data');
        await page.locator('#title').fill(label + ' offline shared');
        await page.locator('#description').fill('Dibuat tanpa jaringan. Gambar juga tersimpan lokal.');
        await page.locator('#image-capture').setInputFiles(path.join(__dirname, '../icons/icon-192.png'));
        await page.locator('#add-btn').click();
        await waitText(page, '#connection-status', '1 perubahan');
        let item = page.locator('.todo-item').filter({hasText: label + ' offline shared'});
        await item.locator('input').check();
        await waitText(page, '#connection-status', '2 perubahan');
        await item.getByRole('button', {name: 'View', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#detail-img').complete && document.querySelector('#detail-img').naturalWidth > 0);
        await page.reload();
        item = page.locator('.todo-item').filter({hasText: label + ' offline shared'});
        await item.waitFor(); assert(await item.locator('input').isChecked());
        await item.getByRole('button', {name: 'View', exact: true}).click();
        await page.waitForFunction(() => document.querySelector('#detail-img').naturalWidth > 0);
        await page.screenshot({path: path.join(proof, '02-offline-crud.png'), fullPage: true});
        pass('Offline create with image, complete and reload persist in IndexedDB');
        await page.goto(base + 'index.php?type=personal');
        item = page.locator('.todo-item').filter({hasText: dangerous});
        page.once('dialog', d => d.accept());
        await item.getByRole('button', {name: 'Del', exact: true}).click();
        await waitText(page, '#connection-status', '3 perubahan');
        assert.equal(await page.locator('.todo-item').filter({hasText: dangerous}).count(), 0);
        pass('Offline delete is immediate and remains queued');
        // Navigation outside app routes receives actual precached offline page.
        await page.goto(base + 'not-cached.html');
        assert.equal(await page.locator('h1').textContent(), 'Kamu sedang offline');
        await page.screenshot({path: path.join(proof, '03-offline-fallback.png'), fullPage: true});
        pass('Unknown offline navigation displays offline.html fallback');
        await page.goto(base + 'diagnostics.html');
        await waitText(page, '#manifest-report', '"online": false');
        await waitText(page, '#cache-report', 'shell-v1');
        await waitText(page, '#db-report', '"outbox": 3');
        await page.screenshot({path: path.join(proof, '04-manifest-cache-offline.png'), fullPage: true});
        await page.goto(base + 'index.php?type=shared');
        await context.setOffline(false);
        await cdp.send('Network.overrideNetworkState', {offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1}).catch(() => {});
        await page.locator('#sync-btn').click();
        await synced(page);
        rows = await apiGet();
        const offlineTask = rows.find(t => t.title === label + ' offline shared');
        assert(offlineTask); taskIds.push(offlineTask.id);
        assert.equal(Number(offlineTask.completed), 1);
        assert(offlineTask.image_path?.startsWith('uploads/'));
        assert.equal(rows.filter(t => t.id === onlineTask.id).length, 0);
        assert.equal(rows.filter(t => t.id === offlineTask.id).length, 1);
        await page.screenshot({path: path.join(proof, '05-resynced.png'), fullPage: true});
        pass('Reconnect drains outbox; image and completed status reach MySQL; offline delete reaches server');
        const second = await browser.newContext();
        const secondPage = await second.newPage();
        await secondPage.goto(base + 'index.php?type=shared'); await synced(secondPage);
        assert(await secondPage.locator('.todo-item').filter({hasText: offlineTask.title}).locator('input').isChecked());
        await second.close();
        pass('A separate browser context reads the synchronized server task');
        // Test API retry idempotency with the exact same operation ID twice.
        const opId = `test-op-${Date.now()}`, id = `test-id-${Date.now()}`; taskIds.push(id);
        const op = {op_id: opId, action: 'put', task: {id, title: label + ' retry', description: '', completed: 0, todo_type: 'personal'}};
        for (let n = 0; n < 2; n++) {
            const response = await context.request.post(base + 'crud.php?action=sync', {multipart: {operation: JSON.stringify(op)}});
            assert.equal(response.status(), 200);
            if (n) assert.equal((await response.json()).duplicate, true);
        }
        assert.equal((await apiGet()).filter(t => t.id === id).length, 1);
        pass('Repeated operation ID is applied once (safe response-loss retry)');
        const invalid = {...op, op_id: `invalid-${Date.now()}`, task: {...op.task, title: ' '}};
        assert.equal((await context.request.post(base + 'crud.php?action=sync', {multipart: {operation: JSON.stringify(invalid)}})).status(), 422);
        assert.equal((await context.request.get(base + 'crud.php?action=sync')).status(), 405);
        assert.equal((await context.request.get(base + 'crud.php?action=invalid')).status(), 400);
        const badImage = {...op, op_id: `badimg-${Date.now()}`};
        assert.equal((await context.request.post(base + 'crud.php?action=sync', {multipart: {operation: JSON.stringify(badImage), image: {name: 'bad.php', mimeType: 'image/png', buffer: Buffer.from('<?php echo 1;')}}})).status(), 422);
        pass('API rejects invalid action, wrong method, empty title and forged image upload');
        // Responsive layout and persisted theme, still using the real shell.
        await page.setViewportSize({width: 390, height: 844});
        await page.locator('#theme-toggle').click(); await page.reload(); await synced(page);
        assert(await page.locator('body').evaluate(el => el.classList.contains('dark-mode')));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({path: path.join(proof, '06-mobile-dark.png'), fullPage: true});
        pass('Mobile layout has no horizontal overflow; dark mode persists');
        // No synthetic install event; test genuine prompt if Chrome provided one, otherwise manual guide.
        if (await page.evaluate(() => Boolean(deferredPrompt))) {
            pass('Native beforeinstallprompt received from Chromium (OS install confirmation remains manual)');
        } else {
            await page.locator('#install-btn').click(); assert(await page.locator('#install-help').isVisible());
            pass('Install button provides manual browser instructions when native prompt is unavailable');
        }
        assert.deepEqual(errors, []);
        pass('No uncaught JavaScript page errors');
        fs.writeFileSync(path.join(proof, 'test-report.json'), JSON.stringify({testedAt: new Date().toISOString(), base, browser: browser.version(), backend: 'Actual PHP + MySQL-compatible MariaDB, no API mock', results, pageErrors: errors, nativeOSInstallation: 'Not automated; confirm manually in Chrome/Edge'}, null, 2));
    } catch (error) {
        console.error('DEBUG', await page.evaluate(() => ({url: location.href, online: navigator.onLine, text: document.body.innerText, scripts: [...document.scripts].map(s => s.src)})).catch(() => ({})), errors);
        const debugDir = path.join(__dirname, '../test-results');
        fs.mkdirSync(debugDir, {recursive: true});
        await page.screenshot({path: path.join(debugDir, 'failure.png'), fullPage: true}).catch(() => {});
        throw error;
    } finally {
        for (const id of taskIds) await context.request.post(base + 'crud.php?action=sync', {multipart: {operation: JSON.stringify({op_id: `cleanup-${id}-${Date.now()}`, action: 'delete', task: {id}})}}).catch(() => {});
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
