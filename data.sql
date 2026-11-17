-- Todo App E04 - The Iron Citadel
-- Import file ini melalui phpMyAdmin atau MySQL CLI.
CREATE DATABASE IF NOT EXISTS todo_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE todo_db;

CREATE TABLE IF NOT EXISTS todos (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    description TEXT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    notify_time DATETIME NULL,
    image_path VARCHAR(255) NULL,
    todo_type ENUM('personal', 'shared') NOT NULL DEFAULT 'personal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_todos_type_created (todo_type, created_at),
    KEY idx_todos_completed (completed)
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;

-- Data awal bersifat opsional. Aplikasi dapat digunakan dengan tabel kosong.
