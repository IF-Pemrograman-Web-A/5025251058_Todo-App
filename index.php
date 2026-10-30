<?php
// App shell must render even if MySQL is unavailable.
$current_type = ($_GET['type'] ?? '') === 'shared' ? 'shared' : 'personal';
?>
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#2c3e50">
    <meta name="description" content="Todo personal dan shared yang tetap dapat digunakan offline.">
    <link rel="manifest" href="manifest.webmanifest">
    <link rel="icon" href="icons/icon-192.png" type="image/png">
    <link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
    <link rel="stylesheet" href="style.css">
    <title>Shine's Todo — E05 The Offline Abyss</title>
</head>
<body>
    <header>
        <h1>Shine's ToDo APP</h1>
        <p>[E05] The Offline Abyss</p>
        <div class="toolbar">
            <button type="button" id="theme-toggle" class="theme-btn">Toggle Dark Mode</button>
            <button type="button" id="install-btn" class="theme-btn">Install App</button>
            <button type="button" id="notification-btn" class="theme-btn">Aktifkan Pengingat</button>
        </div>
    </header>
    <?php include __DIR__ . '/menu-bar.php'; ?>
    <div class="connection-panel">
        <p id="connection-status" role="status">Menyiapkan penyimpanan lokal…</p>
        <p id="sw-status">Menyiapkan mode offline…</p>
        <p id="app-message" role="status"></p>
        <button type="button" id="sync-btn">Sinkronkan sekarang</button>
        <a href="diagnostics.html">Periksa PWA</a>
    </div>
    <div class="layout-container">
        <?php include __DIR__ . '/content.php'; ?>
    </div>
    <dialog id="install-help">
        <h2>Install Todo App</h2>
        <p id="install-help-text">Chrome/Edge: buka menu browser → Install app. Safari iPhone/iPad: Share → Add to Home Screen. Buka aplikasi lewat localhost atau HTTPS, lalu tunggu mode offline siap.</p>
        <form method="dialog"><button>Tutup</button></form>
    </dialog>
    <footer><p>&copy; 2026 Shine Lee — The Offline Abyss</p></footer>
    <script src="script.js" defer></script>
</body>
</html>
