<?php
declare(strict_types=1);

/**
 * Konfigurasi backend E06: koneksi PDO dan autentikasi JWT.
 * Environment variable yang didukung: DB_HOST, DB_PORT, DB_NAME, DB_USER,
 * DB_PASS, dan JWT_SECRET.
 */
date_default_timezone_set('Asia/Jakarta');

const TODO_COOKIE_NAME = 'shine_todo_jwt';
const TODO_TOKEN_TTL = 2592000; // 30 hari

function api_response(int $httpCode, string $status, string $message, $data = null): never
{
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $payload = [
        'status' => $status,
        'code' => $httpCode,
        'message' => $message,
    ];
    if ($data !== null) {
        $payload['data'] = $data;
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function base64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function base64url_decode(string $value): string|false
{
    $padding = strlen($value) % 4;
    if ($padding !== 0) {
        $value .= str_repeat('=', 4 - $padding);
    }
    return base64_decode(strtr($value, '-_', '+/'), true);
}

function jwt_secret(): string
{
    $secret = getenv('JWT_SECRET');
    if ($secret !== false && strlen($secret) >= 32) {
        return $secret;
    }

    // Kunci ini hanya untuk penggunaan lokal/praktikum. Ganti sebelum deployment.
    return 'LOCAL_DEVELOPMENT_ONLY_Change_This_JWT_Secret_5025251058_E06';
}

function create_jwt(int $userId): string
{
    $header = base64url_encode((string) json_encode(['typ' => 'JWT', 'alg' => 'HS256']));
    $payload = base64url_encode((string) json_encode([
        'iat' => time(),
        'exp' => time() + TODO_TOKEN_TTL,
        'data' => ['id' => $userId],
    ]));
    $unsignedToken = $header . '.' . $payload;
    $signature = base64url_encode(hash_hmac('sha256', $unsignedToken, jwt_secret(), true));

    return $unsignedToken . '.' . $signature;
}

function verify_jwt(string $token): ?int
{
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return null;
    }

    [$encodedHeader, $encodedPayload, $signature] = $parts;
    $headerJson = base64url_decode($encodedHeader);
    $payloadJson = base64url_decode($encodedPayload);
    if ($headerJson === false || $payloadJson === false) {
        return null;
    }

    $header = json_decode($headerJson, true);
    $payload = json_decode($payloadJson, true);
    if (!is_array($header) || ($header['typ'] ?? '') !== 'JWT' || ($header['alg'] ?? '') !== 'HS256' || !is_array($payload)) {
        return null;
    }

    $expected = base64url_encode(hash_hmac('sha256', $encodedHeader . '.' . $encodedPayload, jwt_secret(), true));
    if (!hash_equals($expected, $signature)) {
        return null;
    }

    $userId = filter_var($payload['data']['id'] ?? null, FILTER_VALIDATE_INT);
    $expiresAt = filter_var($payload['exp'] ?? null, FILTER_VALIDATE_INT);
    if (!$userId || !$expiresAt || $expiresAt <= time()) {
        return null;
    }

    return (int) $userId;
}

function database_connection(): PDO
{
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $database = getenv('DB_NAME') ?: 'todo_db_e06';
    $username = getenv('DB_USER') ?: 'root';
    $password = getenv('DB_PASS') ?: '';
    $dsn = "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4";

    try {
        return new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        error_log('Todo App E06 database connection failed: ' . $exception->getMessage());
        api_response(500, 'error', 'Koneksi database gagal. Periksa konfigurasi dan pastikan MySQL aktif.');
    }
}

function current_user_id(PDO $pdo): int
{
    if (isset($_COOKIE[TODO_COOKIE_NAME])) {
        $userId = verify_jwt((string) $_COOKIE[TODO_COOKIE_NAME]);
        if ($userId !== null) {
            $check = $pdo->prepare('SELECT id FROM users WHERE id = ? LIMIT 1');
            $check->execute([$userId]);
            if ($check->fetchColumn()) {
                return $userId;
            }
        }

        setcookie(TODO_COOKIE_NAME, '', [
            'expires' => time() - 3600,
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        api_response(401, 'error', 'Token autentikasi tidak valid atau kedaluwarsa. Muat ulang halaman untuk membuat sesi baru.');
    }

    // Identitas anonim dibuat otomatis sesuai spesifikasi E06.
    $userId = 0;
    for ($attempt = 0; $attempt < 8; $attempt++) {
        $username = 'User_' . (string) random_int(100000, 999999);
        try {
            $insert = $pdo->prepare('INSERT INTO users (username, nama_lengkap) VALUES (?, ?)');
            $insert->execute([$username, $username]);
            $userId = (int) $pdo->lastInsertId();
            break;
        } catch (PDOException $exception) {
            if ($attempt === 7) {
                throw $exception;
            }
        }
    }

    $token = create_jwt($userId);
    setcookie(TODO_COOKIE_NAME, $token, [
        'expires' => time() + TODO_TOKEN_TTL,
        'path' => '/',
        'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);

    return $userId;
}

function project_root(): string
{
    return dirname(__DIR__);
}

function store_attachment(string $dataUri): string
{
    if (!preg_match('#^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$#', $dataUri, $matches)) {
        throw new InvalidArgumentException('Lampiran harus berupa gambar PNG, JPG, WEBP, atau GIF.');
    }

    $binary = base64_decode($matches[2], true);
    if ($binary === false || strlen($binary) === 0) {
        throw new InvalidArgumentException('File lampiran tidak valid.');
    }
    if (strlen($binary) > 2 * 1024 * 1024) {
        throw new InvalidArgumentException('Ukuran lampiran maksimal 2 MB.');
    }

    $fileInfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $fileInfo->buffer($binary);
    $extensions = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];
    if (!isset($extensions[$mimeType]) || @getimagesizefromstring($binary) === false) {
        throw new InvalidArgumentException('Isi file bukan gambar yang didukung.');
    }

    $uploadDirectory = project_root() . DIRECTORY_SEPARATOR . 'uploads';
    if (!is_dir($uploadDirectory) && !mkdir($uploadDirectory, 0755, true) && !is_dir($uploadDirectory)) {
        throw new RuntimeException('Folder uploads tidak dapat dibuat.');
    }

    $filename = 'foto_' . bin2hex(random_bytes(12)) . '.' . $extensions[$mimeType];
    $destination = $uploadDirectory . DIRECTORY_SEPARATOR . $filename;
    if (file_put_contents($destination, $binary, LOCK_EX) === false) {
        throw new RuntimeException('Lampiran gagal disimpan.');
    }

    return 'uploads/' . $filename;
}

function remove_attachment(?string $relativePath): void
{
    if (!$relativePath || !str_starts_with($relativePath, 'uploads/')) {
        return;
    }

    $filename = basename($relativePath);
    if ($filename === '' || $filename === '.' || $filename === '..') {
        return;
    }

    $path = project_root() . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $filename;
    if (is_file($path)) {
        @unlink($path);
    }
}

function todo_payload(array $row): array
{
    $id = (int) $row['id'];
    $clientId = (string) $row['client_id'];
    $title = (string) $row['judul'];
    $description = (string) ($row['deskripsi'] ?? '');
    $deadline = $row['waktu_notif'] ?? null;
    $priority = (string) $row['prioritas'];
    $attachment = $row['lampiran'] ?? null;
    $category = (string) $row['kategori'];
    $completed = (int) $row['selesai'];

    // Field berbahasa Indonesia sesuai E06 dan alias E05 untuk kompatibilitas UI/offline.
    return [
        'id' => $id,
        'server_id' => $id,
        'client_id' => $clientId,
        'user_id' => isset($row['user_id']) ? (int) $row['user_id'] : null,
        'judul' => $title,
        'deskripsi' => $description,
        'waktu_notif' => $deadline,
        'prioritas' => $priority,
        'lampiran' => $attachment,
        'kategori' => $category,
        'selesai' => $completed,
        'created_at' => $row['created_at'] ?? null,
        'updated_at' => $row['updated_at'] ?? null,
        'title' => $title,
        'description' => $description,
        'completed' => $completed,
        'notify_time' => $deadline,
        'image_path' => $attachment,
        'todo_type' => $category,
    ];
}
