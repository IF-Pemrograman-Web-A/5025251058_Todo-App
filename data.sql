CREATE DATABASE IF NOT EXISTS todo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE todo_db;
CREATE TABLE IF NOT EXISTS todos (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    completed TINYINT(1) NOT NULL DEFAULT 0,
    notify_time DATETIME NULL,
    image_path VARCHAR(255) NULL,
    todo_type ENUM('personal','shared') NOT NULL DEFAULT 'personal',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS applied_operations (
    op_id VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
INSERT IGNORE INTO todos (client_id,title,description,todo_type) VALUES
('sample-personal','Selesaikan latihan PWA','Coba tambah tugas saat offline, lalu sambungkan kembali.','personal'),
('sample-shared','Diskusi tugas kelompok','Daftar Shared tetap tersedia meskipun belum pernah dibuka sebelum offline.','shared');
