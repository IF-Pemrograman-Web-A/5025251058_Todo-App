# Todo App - [E03] The Lost Cavern

## Identitas
- **Nama:** Shine Lee Romenzio Tarigan
- **NRP:** 5025251058
- **Kelas:** IF - Pemrograman Web - A

## Deskripsi
Ini adalah project aplikasi Todo List yang telah ditingkatkan untuk memenuhi kriteria tugas **[E03] The Lost Cavern**. Proyek ini mengimplementasikan penyimpanan lokal, akses perangkat keras, *service worker*, dan standar aksesibilitas web.

Beberapa hal baru yang diterapkan di project ini:
1. **Web Storage:** Menggunakan **IndexedDB** untuk menyimpan data *todo list* secara persisten (CRUD), dan **localStorage** untuk menyimpan preferensi tema (Light/Dark mode) pengguna.
2. **Media Capture API:** Menambahkan field *capture image* pada form pembuatan task untuk melampirkan foto ke dalam Todo.
3. **Service Worker & Notifications:** Mengimplementasikan Service Worker untuk menampilkan Push Notification sesuai dengan waktu *reminder* (Notification Time) yang diatur pada form Todo.
4. **Web Accessibility (A11y):** Penerapan praktik terbaik aksesibilitas meliputi penggunaan atribut ARIA (`aria-label`, `aria-live`, `aria-required`), *semantic HTML*, serta penambahan visual *focus outline* yang jelas untuk navigasi menggunakan keyboard.

## Cara Menjalankan
Penting: Karena proyek ini menggunakan Service Worker dan Media Capture API, aplikasi ini membutuhkan server lokal untuk berjalan (tidak bisa hanya klik dua kali file HTML).

1. Buka folder proyek di Visual Studio Code.
2. Gunakan ekstensi **Live Server** (Klik kanan pada `index.html` > *Open with Live Server*).
3. Izinkan *prompt* notifikasi dan kamera pada browser saat halaman pertama kali dimuat.

## Preview Tampilan
<img width="1918" height="957" alt="image" src="https://github.com/user-attachments/assets/717b6e91-a636-47fb-8344-d124950677ef" />

