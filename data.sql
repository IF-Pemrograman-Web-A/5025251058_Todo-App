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

-- Data contoh untuk membantu demonstrasi E04.
-- Kondisi NOT EXISTS mencegah data contoh ditambahkan berulang kali.
INSERT INTO todos (title, description, completed, notify_time, image_path, todo_type)
SELECT 'Menyelesaikan laporan praktikum',
       'Rapikan hasil praktikum dan siapkan file untuk dikumpulkan.',
       0, DATE_ADD(NOW(), INTERVAL 1 DAY), NULL, 'personal'
WHERE NOT EXISTS (
    SELECT 1 FROM todos WHERE title = 'Menyelesaikan laporan praktikum' AND todo_type = 'personal'
);

INSERT INTO todos (title, description, completed, notify_time, image_path, todo_type)
SELECT 'Persiapan presentasi kelompok',
       'Koordinasikan materi dan pembagian tugas dengan anggota kelompok.',
       0, DATE_ADD(NOW(), INTERVAL 2 DAY), NULL, 'shared'
WHERE NOT EXISTS (
    SELECT 1 FROM todos WHERE title = 'Persiapan presentasi kelompok' AND todo_type = 'shared'
);

INSERT INTO todos (title, description, completed, notify_time, image_path, todo_type)
SELECT 'Membaca materi JavaScript',
       'Ulangi materi array, object, event listener, dan manipulasi DOM.',
       1, NULL, NULL, 'personal'
WHERE NOT EXISTS (
    SELECT 1 FROM todos WHERE title = 'Membaca materi JavaScript' AND todo_type = 'personal'
);
