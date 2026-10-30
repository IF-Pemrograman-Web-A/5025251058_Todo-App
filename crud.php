<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function reply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function validId($id): bool {
    return is_string($id) && preg_match('/^[a-zA-Z0-9-]{1,64}$/D', $id) === 1;
}
$newFile = null;
$oldFile = null;
try {
    $action = $_GET['action'] ?? '';
    if (!in_array($action, ['get', 'sync'], true)) reply(400, ['error' => 'Action tidak valid.']);
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== ($action === 'get' ? 'GET' : 'POST')) reply(405, ['error' => 'Metode tidak diizinkan.']);
    require __DIR__ . '/config.php';
    if ($action === 'get') {
        $result = $conn->query('SELECT client_id AS id, title, description, completed, notify_time, image_path, todo_type, created_at FROM todos ORDER BY created_at DESC, id DESC');
        reply(200, ['todos' => $result->fetch_all(MYSQLI_ASSOC)]);
    }
    $op = json_decode($_POST['operation'] ?? '', true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($op) || !validId($op['op_id'] ?? null) || !in_array($op['action'] ?? '', ['put', 'delete'], true) || !validId($op['task']['id'] ?? null)) reply(422, ['error' => 'Operasi tidak valid.']);
    $task = $op['task'];
    $conn->begin_transaction();
    // Unique operation ID makes retries safe when a response is lost.
    $stmt = $conn->prepare('INSERT IGNORE INTO applied_operations (op_id) VALUES (?)');
    $stmt->bind_param('s', $op['op_id']);
    $stmt->execute();
    if ($stmt->affected_rows === 0) {
        $conn->commit();
        reply(200, ['status' => 'success', 'duplicate' => true]);
    }
    $stmt = $conn->prepare('SELECT image_path FROM todos WHERE client_id = ? FOR UPDATE');
    $stmt->bind_param('s', $task['id']);
    $stmt->execute();
    $oldFile = $stmt->get_result()->fetch_assoc()['image_path'] ?? null;
    if ($op['action'] === 'delete') {
        $stmt = $conn->prepare('DELETE FROM todos WHERE client_id = ?');
        $stmt->bind_param('s', $task['id']);
        $stmt->execute();
    } else {
        $title = trim((string) ($task['title'] ?? ''));
        $description = (string) ($task['description'] ?? '');
        $type = $task['todo_type'] ?? '';
        $completed = !empty($task['completed']) ? 1 : 0;
        $notify = $task['notify_time'] ?? null;
        if ($notify === '') $notify = null;
        if ($notify !== null) {
            if (!is_string($notify) || !preg_match('/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/D', $notify)) throw new InvalidArgumentException('Waktu pengingat tidak valid.');
            $notify = str_replace('T', ' ', $notify);
            if (strlen($notify) === 16) $notify .= ':00';
            $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $notify);
            if (!$date || $date->format('Y-m-d H:i:s') !== $notify) throw new InvalidArgumentException('Tanggal pengingat tidak valid.');
        }
        if ($title === '' || preg_match_all('/./us', $title) > 200 || strlen($description) > 60000 || !in_array($type, ['personal', 'shared'], true)) throw new InvalidArgumentException('Judul, deskripsi, atau kategori tidak valid.');
        $imagePath = $oldFile;
        if (isset($_FILES['image']) && $_FILES['image']['error'] !== UPLOAD_ERR_NO_FILE) {
            $image = $_FILES['image'];
            if ($image['error'] !== UPLOAD_ERR_OK || $image['size'] > 2 * 1024 * 1024) throw new InvalidArgumentException('Upload gagal atau gambar melebihi 2 MB.');
            $mime = (new finfo(FILEINFO_MIME_TYPE))->file($image['tmp_name']);
            $extensions = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/gif' => 'gif'];
            if (!isset($extensions[$mime]) || @getimagesize($image['tmp_name']) === false) throw new InvalidArgumentException('File harus berupa gambar PNG/JPEG/WebP/GIF.');
            if (!is_dir(__DIR__ . '/uploads') && !mkdir(__DIR__ . '/uploads', 0755, true)) throw new RuntimeException('Tidak dapat membuat folder upload.');
            $imagePath = 'uploads/' . bin2hex(random_bytes(16)) . '.' . $extensions[$mime];
            $newFile = $imagePath;
            if (!move_uploaded_file($image['tmp_name'], __DIR__ . '/' . $imagePath)) throw new RuntimeException('Tidak dapat menyimpan gambar.');
        }
        $stmt = $conn->prepare('INSERT INTO todos (client_id, title, description, completed, notify_time, image_path, todo_type) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), completed=VALUES(completed), notify_time=VALUES(notify_time), image_path=VALUES(image_path), todo_type=VALUES(todo_type)');
        $stmt->bind_param('sssisss', $task['id'], $title, $description, $completed, $notify, $imagePath, $type);
        $stmt->execute();
        if ($imagePath === $oldFile) $oldFile = null;
    }
    $conn->commit();
    if ($oldFile && preg_match('#^uploads/[a-zA-Z0-9_.-]+$#D', $oldFile) && is_file(__DIR__ . '/' . $oldFile)) @unlink(__DIR__ . '/' . $oldFile);
    reply(200, ['status' => 'success']);
} catch (Throwable $error) {
    if (isset($conn)) { try { $conn->rollback(); } catch (Throwable $ignored) {} }
    if ($newFile && is_file(__DIR__ . '/' . $newFile)) @unlink(__DIR__ . '/' . $newFile);
    if ($error instanceof InvalidArgumentException || $error instanceof JsonException) reply(422, ['error' => $error->getMessage()]);
    error_log('Todo E05: ' . $error->getMessage());
    reply(503, ['error' => 'Server/database belum tersedia. Perubahan tetap tersimpan di perangkat. Periksa konfigurasi database.']);
}
