<?php
require_once 'config.php';

$current_type = (isset($_GET['type']) && $_GET['type'] === 'shared') ? 'shared' : 'personal';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Todo List - <?= ucfirst($current_type) ?></title>
    <link rel="stylesheet" href="style.css">
    <meta name="theme-color" content="#2c3e50">
</head>
<body>
    <header role="banner">
        <h1>Shine`s ToDo APP</h1>
        <button id="theme-toggle" class="theme-btn" aria-label="Toggle Dark Mode">Toggle Dark Mode</button>
    </header>

    <?php include 'menu-bar.php'; ?>

    <div class="layout-container" style="margin-top: 20px;">
        <?php include 'content.php'; ?>
    </div>

    <footer role="contentinfo">
        <p>&copy; 2026 The Style Warrior - Todo List</p>
    </footer>

    <script>const CURRENT_TYPE = "<?= $current_type ?>";</script>
    <script src="script.js"></script>
</body>
</html>
