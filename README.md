# Todo App — [E06] The Endpoint of Portals

| Identitas | Keterangan |
|---|---|
| Nama | Shine Lee Romenzio Tarigan |
| NRP | 5025251058 |
| Kelas | IF — Pemrograman Web A |

## Ringkasan

E06 merupakan kelanjutan Todo App E05. Fitur Personal/Shared, lampiran gambar, dark mode, PWA, notifikasi, IndexedDB, dan operasi offline tetap dipertahankan. Pada E06, operasi data disediakan melalui REST API menggunakan PHP, PDO, MySQL, dan JWT.

### Fitur E06

- REST API dengan method `GET`, `POST`, `PUT`, `PATCH`, dan `DELETE`.
- Endpoint Todo Personal dan Shared, termasuk pengambilan detail berdasarkan ID.
- Koneksi MySQL menggunakan PDO dan prepared statements.
- User anonim otomatis dengan username `User_` + angka acak.
- JWT HS256 disimpan dalam cookie `HttpOnly` selama 30 hari.
- Validasi data, lampiran gambar, kepemilikan Todo Personal, dan HTTP response code.
- `client_id` dan `op_id` untuk membantu sinkronisasi offline yang aman dari request berulang.

## Menjalankan di XAMPP

Persyaratan: PHP 8.1+, MySQL/MariaDB, ekstensi `pdo_mysql` dan `fileinfo`, serta Apache `mod_rewrite`.

1. Extract repository ini ke `C:\xampp\htdocs\5025251058_Todo-App\`.
2. Jalankan Apache dan MySQL melalui XAMPP.
3. Buka phpMyAdmin, lalu import `data.sql`. Database baru `todo_db_e06` dibuat tanpa menghapus database E05.
4. Periksa pengaturan database pada `backend/config.php`. Default: host `127.0.0.1`, port `3306`, database `todo_db_e06`, user `root`, password kosong.
5. Pastikan Apache mengizinkan `.htaccess` (`AllowOverride All`) dan folder `uploads/` dapat ditulisi.
6. Buka `http://localhost/5025251058_Todo-App/index.php?type=personal`.

Jalankan melalui Apache/PHP, bukan `file://`, Live Server, atau GitHub Pages. PHP dan MySQL tidak dijalankan oleh GitHub Pages.

Untuk deployment, atur environment variable `JWT_SECRET` dengan kunci acak minimal 32 karakter. Kunci fallback pada `backend/config.php` hanya untuk praktikum lokal.

## REST API

Base URL: `/backend/todo/`

| Method | Endpoint | Fungsi | Response sukses |
|---|---|---|---|
| GET | `/backend/todo/personal` | Daftar Todo Personal milik user saat ini | `200` |
| GET | `/backend/todo/shared` | Daftar Todo Shared | `200` |
| GET | `/backend/todo/{kategori}/{id}` | Detail Todo | `200` |
| POST | `/backend/todo/` | Membuat Todo | `201` |
| PUT | `/backend/todo/{kategori}/{id}` | Mengubah isi Todo | `200` |
| PATCH | `/backend/todo/{kategori}/{id}` | Mengubah status selesai | `200` |
| DELETE | `/backend/todo/{kategori}/{id}` | Menghapus Todo | `200` |

Kategori adalah `personal` atau `shared`. Body request menggunakan field `judul`, `desc`, `waktuNotif`, `prioritas`, `kategori`, `selesai`, dan `lampiran` sesuai kebutuhan operasi. Deadline wajib untuk Todo baru. Lampiran menerima PNG/JPG/JPEG/WEBP/GIF maksimal 2 MB.

### HTTP response code

| Code | Makna |
|---|---|
| `200` | OK — operasi berhasil |
| `201` | Created — Todo berhasil dibuat |
| `400` | Bad Request — JSON atau field wajib tidak valid |
| `401` | Unauthorized — JWT tidak valid/kedaluwarsa |
| `403` | Forbidden — akses ke Todo Personal milik user lain |
| `404` | Not Found — Todo tidak ditemukan |
| `405` | Method Not Allowed — method tidak didukung |
| `422` | Unprocessable Entity — nilai input tidak valid |
| `500` | Internal Server Error — kesalahan server/database |

Semua respons API berbentuk JSON dengan `status`, `code`, `message`, dan `data` bila tersedia.

## Offline dan Sinkronisasi

Perubahan lokal disimpan di IndexedDB dan antrean *outbox*. Ketika online, antrean diproses ke REST API. Data lokal tidak dihapus dari antrean sebelum server mengonfirmasi keberhasilan. Service Worker menyimpan app shell dan aset PWA; respons REST API tidak dimasukkan ke Cache Storage.

## Pengujian

1. Import `data.sql`, jalankan Apache dan MySQL, lalu buka aplikasi.
2. Tambah Todo Personal dan Shared; periksa `POST` dengan response `201` pada DevTools → Network.
3. Ubah status Todo; periksa `PATCH` dengan response `200`.
4. Ubah data Todo melalui tombol **Edit**; periksa `PUT` dengan response `200`.
5. Hapus Todo; periksa `DELETE` dengan response `200`.
6. Uji input tidak valid dan ID yang tidak ditemukan untuk memeriksa response `400`, `422`, dan `404`.
7. Uji saat Offline, lalu Online kembali dan tekan **Sinkronkan sekarang**.

## Migrasi Data E05 (Opsional)

Database E06 menggunakan `todo_db_e06` agar database E05 tetap aman. Setelah import `data.sql`, jalankan `migrate-e05-to-e06.sql` satu kali untuk menyalin Todo lama dari database `todo_db`. Salin juga file gambar lama ke folder `uploads/` bila ingin mempertahankan lampirannya.
