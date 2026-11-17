-- BACKUP database E04 terlebih dahulu. Jalankan SEKALI jika tabel todos E04 sudah ada.
-- Jangan jalankan data.sql untuk migrasi tabel lama.
USE todo_db;
ALTER TABLE todos ENGINE=InnoDB;
ALTER TABLE todos ADD COLUMN client_id VARCHAR(64) NULL;
UPDATE todos SET client_id = CONCAT('legacy-', id) WHERE client_id IS NULL;
ALTER TABLE todos MODIFY client_id VARCHAR(64) NOT NULL, ADD UNIQUE KEY uq_client_id (client_id);
CREATE TABLE IF NOT EXISTS applied_operations (
    op_id VARCHAR(64) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
