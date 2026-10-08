if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.log('SW Registration failed: ', err));
    });
}
if ('Notification' in window) {
    Notification.requestPermission();
}

const themeBtn = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

themeBtn.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
});

const form = document.getElementById('todo-form');
const todoList = document.getElementById('todo-list');
let todosData = [];

loadTodos();
checkNotifications();

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    await fetch('crud.php?action=add', {
        method: 'POST',
        body: formData
    });
    
    form.reset();
    loadTodos();
});

async function loadTodos() {
    const response = await fetch(`crud.php?action=get&type=${CURRENT_TYPE}`);
    todosData = await response.json();

    todoList.innerHTML = '';
    todosData.forEach(todo => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        const isCompleted = parseInt(todo.completed) === 1;
        
        li.innerHTML = `
            <input type="checkbox" id="task-${todo.id}" ${isCompleted ? 'checked' : ''}>
            <label for="task-${todo.id}">${todo.title}</label>
            <div class="actions">
                <button type="button" class="btn-edit" onclick="showDetail(${todo.id})">View</button>
                <button type="button" class="btn-delete" onclick="deleteTodo(${todo.id})">Del</button>
            </div>
        `;

        li.querySelector('input').addEventListener('change', (e) => {
            updateStatus(todo.id, e.target.checked);
        });

        todoList.appendChild(li);
    });
}

async function updateStatus(id, isCompleted) {
    await fetch('crud.php?action=update_status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id, completed: isCompleted })
    });
    loadTodos();
}

window.deleteTodo = async (id) => {
    if(confirm("Yakin ingin menghapus task ini?")) {
        await fetch('crud.php?action=delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        loadTodos();
    }
}

window.showDetail = (id) => {
    const todo = todosData.find(t => parseInt(t.id) === parseInt(id));
    if(todo) {
        document.getElementById('detail-title').innerText = todo.title;
        document.getElementById('detail-status').innerText = parseInt(todo.completed) === 1 ? 'Completed' : 'Pending';
        document.getElementById('detail-time').innerText = todo.notify_time ? new Date(todo.notify_time).toLocaleString() : 'No notification set';
        document.getElementById('detail-desc').innerText = todo.description || 'Tidak ada deskripsi.';
        
        const imgEl = document.getElementById('detail-img');
        if (todo.image_path) {
            imgEl.src = todo.image_path;
            imgEl.style.display = 'block';
        } else {
            imgEl.style.display = 'none';
        }
    }
};

function checkNotifications() {
    setInterval(() => {
        const now = new Date().getTime();
        todosData.forEach(todo => {
            if (todo.notify_time && !todo.notified) {
                const taskTime = new Date(todo.notify_time).getTime();
                if (now >= taskTime) {
                    if (navigator.serviceWorker.controller) {
                        navigator.serviceWorker.ready.then(reg => {
                            reg.showNotification("To-Do Reminder!", {
                                body: `Saatnya mengerjakan: ${todo.title}`,
                                icon: 'https://cdn-icons-png.flaticon.com/512/2387/2387679.png',
                            });
                        });
                    }
                    todo.notified = true; 
                }
            }
        });
    }, 30000);
}
