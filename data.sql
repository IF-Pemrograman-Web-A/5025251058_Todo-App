-- Todo App E06 - database baru agar database E05 tetap aman.
CREATE DATABASE IF NOT EXISTS todo_db_e06
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE todo_db_e06;

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    username VARCHAR(40) NOT NULL,
    nama_lengkap VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS todos (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    client_id VARCHAR(64) NOT NULL,
    judul VARCHAR(200) NOT NULL,
    deskripsi TEXT NULL,
    waktu_notif DATETIME NULL,
    prioritas ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    lampiran VARCHAR(255) NULL,
    kategori ENUM('personal', 'shared') NOT NULL DEFAULT 'personal',
    selesai TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_todos_client_id (client_id),
    KEY idx_todos_personal (kategori, user_id, selesai, waktu_notif),
    KEY idx_todos_shared (kategori, selesai, waktu_notif),
    CONSTRAINT fk_todos_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Melindungi operasi offline dari pengiriman ulang ketika respons jaringan hilang.
CREATE TABLE IF NOT EXISTS applied_operations (
    op_id VARCHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (op_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
