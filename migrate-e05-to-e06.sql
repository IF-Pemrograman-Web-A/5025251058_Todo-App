-- Jalankan SETELAH data.sql diimport ke todo_db_e06.
-- Script ini mengasumsikan database E05 lama bernama todo_db dan memiliki
-- tabel todos dengan kolom client_id, title, description, completed,
-- notify_time, image_path, todo_type, dan created_at.

INSERT INTO todo_db_e06.users (username, nama_lengkap)
VALUES ('User_Migrasi_E05_5025251058', 'User_Migrasi_E05_5025251058')
ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id);

SET @e05_migration_user_id = LAST_INSERT_ID();

INSERT INTO todo_db_e06.todos
    (user_id, client_id, judul, deskripsi, waktu_notif, prioritas, lampiran, kategori, selesai, created_at)
SELECT
    CASE WHEN legacy.todo_type = 'personal' THEN @e05_migration_user_id ELSE NULL END,
    legacy.client_id,
    legacy.title,
    legacy.description,
    legacy.notify_time,
    'medium',
    legacy.image_path,
    legacy.todo_type,
    legacy.completed,
    legacy.created_at
FROM todo_db.todos AS legacy
ON DUPLICATE KEY UPDATE
    judul = VALUES(judul),
    deskripsi = VALUES(deskripsi),
    waktu_notif = VALUES(waktu_notif),
    lampiran = VALUES(lampiran),
    kategori = VALUES(kategori),
    selesai = VALUES(selesai);
