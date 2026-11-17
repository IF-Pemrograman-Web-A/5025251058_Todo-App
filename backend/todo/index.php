<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config.php';

/** Ambil JSON body dan pastikan bentuknya object/array. */
function read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        api_response(400, 'error', 'Format JSON tidak valid.');
    }
    return $decoded;
}

function validate_client_id($value): string
{
    if (!is_string($value) || preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $value) !== 1) {
        api_response(422, 'error', 'client_id tidak valid.');
    }
    return $value;
}

function normalize_deadline($value): ?string
{
    // Normalisasi format deadline; validasi di bawah mewajibkannya untuk Todo baru E06.
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value)) {
        api_response(422, 'error', 'Format deadline tidak valid.');
    }

    $date = DateTimeImmutable::createFromFormat('!Y-m-d\\TH:i', $value);
    $errors = DateTimeImmutable::getLastErrors();
    if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value);
        $errors = DateTimeImmutable::getLastErrors();
    }
    if ($date === false || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0))) {
        api_response(422, 'error', 'Format deadline tidak valid. Gunakan YYYY-MM-DDTHH:MM.');
    }
    return $date->format('Y-m-d H:i:s');
}

function validate_todo_input(array $input, bool $isUpdate = false): array
{
    $title = trim((string) ($input['judul'] ?? ''));
    if ($title === '') {
        api_response(400, 'error', 'Judul tugas wajib diisi.');
    }
    $titleLength = preg_match_all('/./us', $title);
    if ($titleLength === false || $titleLength > 200) {
        api_response(422, 'error', 'Judul maksimal 200 karakter.');
    }

    $description = trim((string) ($input['desc'] ?? $input['deskripsi'] ?? ''));
    if (strlen($description) > 60000) {
        api_response(422, 'error', 'Deskripsi terlalu panjang (maksimal 60000 byte).');
    }

    $deadline = normalize_deadline($input['waktuNotif'] ?? $input['waktu_notif'] ?? null);
    // E06 mewajibkan deadline untuk tugas baru; data E05 lama boleh tetap null saat migrasi.
    if ($deadline === null && empty($input['migrasiE05'])) {
        api_response(400, 'error', 'Judul dan deadline wajib diisi.');
    }
    $priority = $input['prioritas'] ?? 'medium';
    if (!in_array($priority, ['low', 'medium', 'high'], true)) {
        api_response(422, 'error', 'Prioritas tidak valid. Gunakan low, medium, atau high.');
    }

    $category = $input['kategori'] ?? $input['todo_type'] ?? 'personal';
    if (!in_array($category, ['personal', 'shared'], true)) {
        api_response(422, 'error', 'Kategori tidak valid. Gunakan personal atau shared.');
    }

    $completed = $input['selesai'] ?? $input['completed'] ?? 0;
    if (!in_array($completed, [0, 1, '0', '1', false, true], true)) {
        api_response(422, 'error', 'Status selesai harus bernilai 0 atau 1.');
    }

    return [
        'judul' => $title,
        'deskripsi' => $description,
        'waktu_notif' => $deadline,
        'prioritas' => $priority,
        'kategori' => $category,
        'selesai' => (int) (bool) $completed,
    ];
}

function fetch_todo(PDO $pdo, string $identifier, ?string $category, int $userId): array
{
    if (ctype_digit($identifier)) {
        $statement = $pdo->prepare('SELECT * FROM todos WHERE id = ? LIMIT 1');
        $statement->execute([(int) $identifier]);
        $todo = $statement->fetch();
    } else {
        $statement = $pdo->prepare('SELECT * FROM todos WHERE client_id = ? LIMIT 1');
        $statement->execute([$identifier]);
        $todo = $statement->fetch();
    }

    if (!$todo) {
        api_response(404, 'error', 'Tugas tidak ditemukan.');
    }
    if ($category !== null && $todo['kategori'] !== $category) {
        api_response(404, 'error', 'Tugas tidak ditemukan pada kategori tersebut.');
    }
    if ($todo['kategori'] === 'personal' && (int) $todo['user_id'] !== $userId) {
        api_response(403, 'error', 'Akses ditolak: tugas personal ini bukan milik Anda.');
    }
    return $todo;
}

function claim_operation(PDO $pdo, string $opId): bool
{
    if ($opId === '') {
        return true;
    }
    if (preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $opId) !== 1) {
        api_response(422, 'error', 'op_id tidak valid.');
    }
    $statement = $pdo->prepare('INSERT IGNORE INTO applied_operations (op_id) VALUES (?)');
    $statement->execute([$opId]);
    return $statement->rowCount() === 1;
}

try {
    $pdo = database_connection();
    $currentUserId = current_user_id($pdo);
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $category = isset($_GET['category']) ? (string) $_GET['category'] : null;
    $identifier = isset($_GET['id']) ? (string) $_GET['id'] : null;
    $input = read_json_body();

    if ($category !== null && !in_array($category, ['personal', 'shared'], true)) {
        api_response(400, 'error', 'Kategori tidak valid.');
    }

    switch ($method) {
        case 'GET':
            if ($identifier !== null && $identifier !== '') {
                $todo = fetch_todo($pdo, $identifier, $category, $currentUserId);
                api_response(200, 'success', 'Detail tugas berhasil diambil.', todo_payload($todo));
            }
            if ($category === null) {
                api_response(400, 'error', 'Pilih kategori personal atau shared.');
            }

            if ($category === 'personal') {
                $statement = $pdo->prepare("SELECT * FROM todos WHERE kategori = 'personal' AND user_id = ? ORDER BY selesai ASC, waktu_notif IS NULL ASC, waktu_notif ASC, id DESC");
                $statement->execute([$currentUserId]);
            } else {
                $statement = $pdo->query("SELECT * FROM todos WHERE kategori = 'shared' ORDER BY selesai ASC, waktu_notif IS NULL ASC, waktu_notif ASC, id DESC");
            }
            api_response(200, 'success', 'Daftar tugas berhasil diambil.', array_map('todo_payload', $statement->fetchAll()));

        case 'POST':
            if ($category !== null || $identifier !== null) {
                api_response(400, 'error', 'POST untuk membuat tugas harus dikirim ke /backend/todo/.');
            }
            $fields = validate_todo_input($input);
            $clientId = isset($input['client_id'])
                ? validate_client_id($input['client_id'])
                : bin2hex(random_bytes(16));
            $opId = (string) ($input['op_id'] ?? '');
            $attachmentPath = null;
            if (!empty($input['lampiran'])) {
                try {
                    $attachmentPath = store_attachment((string) $input['lampiran']);
                } catch (InvalidArgumentException $exception) {
                    api_response(422, 'error', $exception->getMessage());
                }
            }

            $pdo->beginTransaction();
            if (!claim_operation($pdo, $opId)) {
                $existing = $pdo->prepare('SELECT * FROM todos WHERE client_id = ? LIMIT 1');
                $existing->execute([$clientId]);
                $row = $existing->fetch();
                $pdo->commit();
                if ($row && $row['kategori'] === 'personal' && (int) $row['user_id'] !== $currentUserId) {
                    api_response(403, 'error', 'Akses ditolak: tugas personal ini bukan milik Anda.');
                }
                api_response(200, 'success', 'Operasi sudah pernah diterapkan.', $row ? todo_payload($row) : null);
            }

            $existing = $pdo->prepare('SELECT * FROM todos WHERE client_id = ? LIMIT 1 FOR UPDATE');
            $existing->execute([$clientId]);
            $old = $existing->fetch();
            $ownerId = $fields['kategori'] === 'personal' ? $currentUserId : null;
            if ($old) {
                if ($old['kategori'] === 'personal' && (int) $old['user_id'] !== $currentUserId) {
                    $pdo->rollBack();
                    api_response(403, 'error', 'Akses ditolak: tugas personal ini bukan milik Anda.');
                }
                if ($old['lampiran'] && !$attachmentPath) {
                    $attachmentPath = $old['lampiran'];
                }
                $update = $pdo->prepare('UPDATE todos SET user_id = ?, judul = ?, deskripsi = ?, waktu_notif = ?, prioritas = ?, lampiran = ?, kategori = ?, selesai = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
                $update->execute([$ownerId, $fields['judul'], $fields['deskripsi'], $fields['waktu_notif'], $fields['prioritas'], $attachmentPath, $fields['kategori'], $fields['selesai'], $old['id']]);
                if ($attachmentPath !== $old['lampiran']) {
                    remove_attachment($old['lampiran']);
                }
                $serverId = (int) $old['id'];
                $httpCode = 200;
                $message = 'Tugas berhasil disinkronkan.';
            } else {
                $insert = $pdo->prepare('INSERT INTO todos (user_id, client_id, judul, deskripsi, waktu_notif, prioritas, lampiran, kategori, selesai) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
                $insert->execute([$ownerId, $clientId, $fields['judul'], $fields['deskripsi'], $fields['waktu_notif'], $fields['prioritas'], $attachmentPath, $fields['kategori'], $fields['selesai']]);
                $serverId = (int) $pdo->lastInsertId();
                $httpCode = 201;
                $message = 'Tugas baru berhasil dibuat.';
            }
            $select = $pdo->prepare('SELECT * FROM todos WHERE id = ?');
            $select->execute([$serverId]);
            $created = $select->fetch();
            $pdo->commit();
            api_response($httpCode, 'success', $message, todo_payload($created));

        case 'PUT':
            if ($category === null || $identifier === null || $identifier === '') {
                api_response(400, 'error', 'Kategori dan ID tugas pada URL wajib diisi.');
            }
            $fields = validate_todo_input($input, true);
            if ($fields['kategori'] !== $category) {
                api_response(422, 'error', 'Kategori pada body harus sama dengan kategori URL.');
            }
            $opId = (string) ($input['op_id'] ?? '');
            $pdo->beginTransaction();
            if (!claim_operation($pdo, $opId)) {
                $row = fetch_todo($pdo, $identifier, $category, $currentUserId);
                $pdo->commit();
                api_response(200, 'success', 'Operasi sudah pernah diterapkan.', todo_payload($row));
            }
            $existingTodo = fetch_todo($pdo, $identifier, $category, $currentUserId);
            $attachmentPath = $existingTodo['lampiran'];
            if (!empty($input['hapusLampiran'])) {
                $attachmentPath = null;
            }
            if (!empty($input['lampiran'])) {
                try {
                    $newAttachment = store_attachment((string) $input['lampiran']);
                } catch (InvalidArgumentException $exception) {
                    $pdo->rollBack();
                    api_response(422, 'error', $exception->getMessage());
                }
                $attachmentPath = $newAttachment;
            }

            $update = $pdo->prepare('UPDATE todos SET judul = ?, deskripsi = ?, waktu_notif = ?, prioritas = ?, lampiran = ?, selesai = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([$fields['judul'], $fields['deskripsi'], $fields['waktu_notif'], $fields['prioritas'], $attachmentPath, $fields['selesai'], $existingTodo['id']]);
            if ($attachmentPath !== $existingTodo['lampiran']) {
                remove_attachment($existingTodo['lampiran']);
            }
            $select = $pdo->prepare('SELECT * FROM todos WHERE id = ?');
            $select->execute([$existingTodo['id']]);
            $updated = $select->fetch();
            $pdo->commit();
            api_response(200, 'success', 'Tugas berhasil diperbarui.', todo_payload($updated));

        case 'PATCH':
            if ($category === null || $identifier === null || $identifier === '') {
                api_response(400, 'error', 'Kategori dan ID tugas pada URL wajib diisi.');
            }
            $statusValue = $input['status'] ?? $input['selesai'] ?? null;
            if (!in_array($statusValue, [0, 1, '0', '1', false, true], true)) {
                api_response(400, 'error', 'Status wajib bernilai 0 atau 1.');
            }
            $opId = (string) ($input['op_id'] ?? '');
            $pdo->beginTransaction();
            if (!claim_operation($pdo, $opId)) {
                $row = fetch_todo($pdo, $identifier, $category, $currentUserId);
                $pdo->commit();
                api_response(200, 'success', 'Operasi sudah pernah diterapkan.', todo_payload($row));
            }
            $existingTodo = fetch_todo($pdo, $identifier, $category, $currentUserId);
            $status = (int) (bool) $statusValue;
            $update = $pdo->prepare('UPDATE todos SET selesai = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            $update->execute([$status, $existingTodo['id']]);
            $pdo->commit();
            api_response(200, 'success', 'Status tugas berhasil diperbarui.', ['id' => (int) $existingTodo['id'], 'selesai' => $status, 'status' => $status]);

        case 'DELETE':
            if ($category === null || $identifier === null || $identifier === '') {
                api_response(400, 'error', 'Kategori dan ID tugas pada URL wajib diisi.');
            }
            $opId = (string) ($input['op_id'] ?? '');
            $pdo->beginTransaction();
            if (!claim_operation($pdo, $opId)) {
                $pdo->commit();
                api_response(200, 'success', 'Operasi penghapusan sudah pernah diterapkan.', ['deleted' => true]);
            }
            if (ctype_digit($identifier)) {
                $lookup = $pdo->prepare('SELECT * FROM todos WHERE id = ? LIMIT 1');
                $lookup->execute([(int) $identifier]);
            } else {
                $lookup = $pdo->prepare('SELECT * FROM todos WHERE client_id = ? LIMIT 1');
                $lookup->execute([$identifier]);
            }
            $existingTodo = $lookup->fetch();
            if (!$existingTodo) {
                if ($opId !== '') {
                    $pdo->commit();
                    api_response(200, 'success', 'Tugas sudah tidak tersedia; penghapusan dianggap selesai.', ['deleted' => true, 'already_missing' => true]);
                }
                $pdo->rollBack();
                api_response(404, 'error', 'Tugas tidak ditemukan.');
            }
            if ($existingTodo['kategori'] !== $category) {
                $pdo->rollBack();
                api_response(404, 'error', 'Tugas tidak ditemukan pada kategori tersebut.');
            }
            if ($existingTodo['kategori'] === 'personal' && (int) $existingTodo['user_id'] !== $currentUserId) {
                $pdo->rollBack();
                api_response(403, 'error', 'Akses ditolak: tugas personal ini bukan milik Anda.');
            }
            $delete = $pdo->prepare('DELETE FROM todos WHERE id = ?');
            $delete->execute([$existingTodo['id']]);
            $pdo->commit();
            remove_attachment($existingTodo['lampiran'] ?? null);
            api_response(200, 'success', 'Tugas berhasil dihapus.', ['id' => (int) $existingTodo['id'], 'client_id' => $existingTodo['client_id']]);

        default:
            header('Allow: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            api_response(405, 'error', 'HTTP method tidak diizinkan.');
    }
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Todo App E06 API error: ' . $exception->getMessage());
    api_response(500, 'error', 'Terjadi kesalahan pada server. Periksa log PHP untuk detailnya.');
}
