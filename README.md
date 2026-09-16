# Todo App - [E02b] The JavaScript Dungeon

## Identitas
- **Nama:** Shine Lee Romenzio Tarigan
- **NRP:** 5025251058
- **Kelas:** IF - Pemrograman Web - A

## Deskripsi
Project ini adalah kelanjutan dari tugas pembuatan Todo List Webpage (sebelumnya [E01] The Style Warrior). Di iterasi kedua ini, halaman web yang awalnya cuma tampilan statis udah dibikin jadi interaktif dan dinamis menggunakan Vanilla JavaScript. 

Semua kriteria penugasan udah diterapkan, mulai dari manipulasi DOM buat nambahin task tanpa *refresh*, fitur edit dan hapus, *checkbox* buat nandain task selesai, simpan data ke objek, sampai fitur *toggle* untuk Dark Mode.

## Preview Tampilan
*<img width="1901" height="947" alt="image" src="https://github.com/user-attachments/assets/3d2c4e08-c5e8-454a-9401-8fa43b6c5a5f" />*

---

## 🛠️ Fitur & Implementasi Kode

Berikut adalah penjelasan detail gimana masing-masing fitur diimplementasikan beserta potongan kodenya:

### 1. Menyimpan Data sebagai Objek (Default Data)
Sesuai kriteria tugas, data disimpan sebagai *Array of Objects*. Kalau browser di-refresh, data otomatis balik ke bentuk awal (default).

```javascript
const defaultTodos = [
    { 
        id: 1, 
        title: "Learn HTML Semantic Elements", 
        description: "Review header, main, aside, and footer elements.", 
        status: false 
    },
    { 
        id: 2, 
        title: "Master CSS Flexbox", 
        description: "Review flex-direction, align-items, and justify-content properties to build the side-by-side layout.", 
        status: true 
    }
];

// Salin data default biar bisa diotak-atik (dimanipulasi)
let todos = [...defaultTodos];
```

### 2. Manipulasi DOM: Menampilkan & Menambahkan Task (Tanpa Refresh)
List tugas di-*generate* langsung menggunakan fungsi `renderTodos()`. Kalau ada input baru dari form, event *listener* akan nangkep nilainya, ngebuat ID unik berdasarkan waktu, masukin ke objek, dan langsung merender ulang DOM tanpa me-reload halaman.

```javascript
// Nangkep input buat bikin Todo baru
addBtn.addEventListener('click', () => {
    const titleValue = titleInput.value.trim();
    const descValue = descInput.value.trim();

    if (titleValue !== '') {
        const newTodo = {
            id: Date.now(), // Generate ID unik dari waktu sekarang
            title: titleValue,
            description: descValue || "No description provided.",
            status: false
        };

        todos.push(newTodo);
        
        // Reset kolom form
        titleInput.value = '';
        descInput.value = '';
        
        // Render ulang DOM
        renderTodos();
    } else {
        alert("Title nggak boleh kosong!");
    }
});
```

### 3. Fitur Checkbox, Edit, dan Delete
Tiap task yang dirender dibekali fungsi *inline* pada HTML-nya (`onchange` untuk checkbox, dan `onclick` untuk tombol) yang langsung terhubung ke *window object* di JS.

**Checkbox (Tandai Selesai):**

```javascript
window.toggleStatus = (id) => {
    const todoIndex = todos.findIndex(t => t.id === id);
    if (todoIndex !== -1) {
        todos[todoIndex].status = !todos[todoIndex].status;
        renderTodos();
        showDetail(id); // Update status di card detail
    }
};
```

**Tombol Hapus:**

```javascript
window.deleteTodo = (id) => {
    todos = todos.filter(t => t.id !== id);
    renderTodos();
    
    // Reset area detail biar kosong lagi
    detailCard.innerHTML = `
        <h3>Pilih task buat lihat detailnya</h3>
        <p class="status"><strong>Status:</strong> -</p>
        <p class="due-date"><strong>Due:</strong> -</p>
        <p class="description">Deskripsi akan muncul di sini.</p>
    `;
};
```

**Tombol Edit:**

```javascript
window.editTodo = (id) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        const newTitle = prompt("Edit judul task:", todo.title);
        
        if (newTitle !== null && newTitle.trim() !== '') {
            todo.title = newTitle.trim();
            renderTodos();
            showDetail(id);
        }
    }
};
```

### 4. Toggle Light/Dark Mode (Toggle Class)
Terdapat tombol di bagian *header* yang kalau diklik bakal nambahin atau ngehapus class `dark-mode` ke elemen `<body>`. 

```javascript
// Event handler untuk ganti tema
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});
```

Dan ini adalah pengaturan warnanya di file CSS biar transisinya halus:

```css
/* Transisi biar mulus waktu ganti mode */
body {
    transition: background-color 0.3s, color 0.3s;
}

/* Tampilan saat dark mode aktif */
body.dark-mode {
    background-color: #1a1a2e;
    color: #e0e0e0;
}

body.dark-mode header, body.dark-mode footer {
    background-color: #0f3460;
}

body.dark-mode main, 
body.dark-mode .todo-detail-container, 
body.dark-mode .todo-form-container {
    background-color: #16213e;
    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
}

body.dark-mode h2 {
    color: #43bccd;
    border-bottom: 2px solid #2a3d5e;
}
```

---
*Dibuat menggunakan HTML, CSS, dan Vanilla JavaScript.*
