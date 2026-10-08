# Todo App - [E04] The Iron Citadel

## Identitas
- **Nama:** Shine Lee Romenzio Tarigan
- **NRP:** 5025251058
- **Kelas:** IF - Pemrograman Web - A

## Deskripsi
Proyek ini merupakan kelanjutan dari aplikasi Todo List sebelumnya. Pada tugas **[E04] The Iron Citadel**, aplikasi telah dirombak dari sisi *backend* dan *database*. Todo App yang awalnya hanya untuk penggunaan personal kini mendukung penggunaan organisasional dengan adanya pemisahan *task*.

Beberapa pembaruan utama yang diterapkan pada versi ini:
1. **Navigasi Menu:** Implementasi menu navigasi sederhana untuk memisahkan daftar tugas menjadi dua kategori: "Personal" dan "Shared".
2. **Modularisasi PHP:** Migrasi kode HTML statis menjadi file PHP yang modular (seperti `menu-bar.php`, `content.php`, dan `config.php`) agar struktur kode lebih rapi dan mudah di-*maintain*.
3. **Database MySQL:** Menggantikan IndexedDB dengan MySQL untuk penyimpanan data yang terpusat. Struktur tabel dan *dummy data* telah disediakan dalam file `data.sql`.
4. **Backend CRUD dengan PHP:** Operasi *Create, Read, Update,* dan *Delete* sekarang diproses secara asinkron menggunakan Fetch API (JavaScript) yang terhubung ke *endpoint* PHP (`crud.php`).
5. **File Handling:** Menggantikan fitur Media Capture berbasis Base64 dengan sistem upload file standar menggunakan PHP, di mana gambar akan disimpan langsung ke dalam folder lokal server (`uploads/`).

## Cara Menjalankan
Karena proyek ini sekarang menggunakan PHP dan MySQL, aplikasi **wajib** dijalankan menggunakan *local web server* seperti **XAMPP**.

1. Pastikan aplikasi **XAMPP** sudah ter-install di komputermu.
2. Buka XAMPP Control Panel, lalu klik **Start** pada modul **Apache** dan **MySQL**.
3. *Clone* atau pindahkan folder proyek ini ke dalam direktori `htdocs` (biasanya berada di `C:\xampp\htdocs\todo-app`).
4. **Setup Database:**
   - Buka browser dan akses `localhost/phpmyadmin`.
   - Buat database baru dengan nama `todo_db`.
   - Lakukan *import* atau eksekusi *query* dari file `data.sql` yang ada di dalam repositori ini.
5. Buka browser baru dan jalankan aplikasi dengan mengakses URL: `localhost/todo-app` (sesuaikan dengan nama folder di dalam htdocs).

## Preview Tampilan
<!-- Ganti link src di bawah dengan screenshot aplikasi terbarumu nanti -->
<img width="1918" height="957" alt="image" src="https://github.com/user-attachments/assets/717b6e91-a636-47fb-8344-d124950677ef" />
