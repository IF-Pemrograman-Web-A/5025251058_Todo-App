if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Registration failed: ', err));
    });
}
if ('Notification' in window) {
    Notification.requestPermission();
}

const themeBtn = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

let db;
const request = indexedDB.open('TodoDB', 1);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains('todos')) {
        db.createObjectStore('todos', { keyPath: 'id', autoIncrement: true });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
    loadTodos();
    checkNotifications();
};

request.onerror = (e) => console.error("IndexedDB Error", e);

const form = document.getElementById('todo-form');
const todoList = document.getElementById('todo-list');

const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    const notifyTime = document.getElementById('notify-time').value;
    const imageInput = document.getElementById('image-capture');
    
    let imageData = null;
    if (imageInput.files.length > 0) {
        imageData = await fileToBase64(imageInput.files[0]);
    }

    const newTodo = {
        title,
        description,
        notifyTime,
        imageData,
        completed: false,
        notified: false
    };

    const tx = db.transaction('todos', 'readwrite');
    const store = tx.objectStore('todos');
    store.add(newTodo);
    
    tx.oncomplete = () => {
        form.reset();
        loadTodos();
    };
});

function loadTodos() {
    const tx = db.transaction('todos', 'readonly');
    const store = tx.objectStore('todos');
    const request = store.getAll();

    request.onsuccess = () => {
        todoList.innerHTML = '';
        request.result.forEach(todo => {
            const li = document.createElement('li');
            li.className = 'todo-item';
            
            li.innerHTML = `
                <input type="checkbox" id="task-${todo.id}" ${todo.completed ? 'checked' : ''} aria-label="Mark ${todo.title} as completed">
                <label for="task-${todo.id}">${todo.title}</label>
                <div class="actions">
                    <button class="btn-edit" onclick="showDetail(${todo.id})" aria-label="View details for ${todo.title}">View</button>
                    <button class="btn-delete" onclick="deleteTodo(${todo.id})" aria-label="Delete ${todo.title}">Del</button>
                </div>
            `;

            li.querySelector('input').addEventListener('change', (e) => {
                todo.completed = e.target.checked;
                updateTodo(todo);
            });

            todoList.appendChild(li);
        });
    };
}

function updateTodo(todo) {
    const tx = db.transaction('todos', 'readwrite');
    tx.objectStore('todos').put(todo);
    tx.oncomplete = loadTodos;
}

function deleteTodo(id) {
    const tx = db.transaction('todos', 'readwrite');
    tx.objectStore('todos').delete(id);
    tx.oncomplete = loadTodos;
}

window.showDetail = (id) => {
    const tx = db.transaction('todos', 'readonly');
    const request = tx.objectStore('todos').get(id);
    
    request.onsuccess = () => {
        const todo = request.result;
        if(todo) {
            document.getElementById('detail-title').innerText = todo.title;
            document.getElementById('detail-status').innerText = todo.completed ? 'Completed' : 'Pending';
            document.getElementById('detail-time').innerText = todo.notifyTime ? new Date(todo.notifyTime).toLocaleString() : 'No notification set';
            document.getElementById('detail-desc').innerText = todo.description || 'Tidak ada deskripsi.';
            
            const imgEl = document.getElementById('detail-img');
            if (todo.imageData) {
                imgEl.src = todo.imageData;
                imgEl.style.display = 'block';
            } else {
                imgEl.style.display = 'none';
                imgEl.src = '';
            }
        }
    };
};

function checkNotifications() {
    setInterval(() => {
        const now = new Date().getTime();
        const tx = db.transaction('todos', 'readwrite');
        const store = tx.objectStore('todos');
        
        store.getAll().onsuccess = (e) => {
            const todos = e.target.result;
            todos.forEach(todo => {
                if (todo.notifyTime && !todo.notified) {
                    const taskTime = new Date(todo.notifyTime).getTime();
                    if (now >= taskTime) {
                        if (navigator.serviceWorker.controller) {
                            navigator.serviceWorker.ready.then(reg => {
                                reg.showNotification("To-Do Reminder!", {
                                    body: `Saatnya mengerjakan: ${todo.title}`,
                                    icon: 'https://cdn-icons-png.flaticon.com/512/2387/2387679.png',
                                    vibrate: [200, 100, 200]
                                });
                            });
                        }
                        
                        todo.notified = true;
                        store.put(todo);
                    }
                }
            });
        };
    }, 30000);
}
