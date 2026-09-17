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

let todos = [...defaultTodos];
const todoList = document.getElementById('todo-list');
const tombol = document.getElementById('add-btn');
const judul = document.getElementById('title');
const Deskripsi = document.getElementById('description');
const dc = document.getElementById('detail-card');
const tema = document.getElementById('theme-toggle');


function renderTodos() {
    todoList.innerHTML = '';
    
    todos.forEach(todo => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="todo-item">
                <input type="checkbox" id="todo-${todo.id}" ${todo.status ? 'checked' : ''} onchange="toggleStatus(${todo.id})">
                <label for="todo-${todo.id}" onclick="showDetail(${todo.id})">${todo.title}</label>
                <div class="actions">
                    <button class="btn-edit" onclick="editTodo(${todo.id})">Edit</button>
                    <button class="btn-delete" onclick="deleteTodo(${todo.id})">Delete</button>
                </div>
            </div>
        `;
        todoList.appendChild(li);
    });
}

tombol.addEventListener('click', () => {
    const titleValue = judul.value.trim();
    const descValue = Deskripsi.value.trim();

    if (titleValue !== '') {
        const newTodo = {
            id: Date.now(), 
            title: titleValue,
            description: descValue || "No description provided.",
            status: false
        };

        todos.push(newTodo);
    
        judul.value = '';
        Deskripsi.value = '';
        renderTodos();
    } else {
        alert("Title nggak boleh kosong!");
    }
});

window.toggleStatus = (id) => {
    const todoIndex = todos.findIndex(t => t.id === id);
    if (todoIndex !== -1) {
        todos[todoIndex].status = !todos[todoIndex].status;
        renderTodos();
        showDetail(id); a
    }
};

window.deleteTodo = (id) => {
    todos = todos.filter(t => t.id !== id);
    renderTodos();
    dc.innerHTML = `
        <h3>Pilih task buat lihat detailnya</h3>
        <p class="status"><strong>Status:</strong> -</p>
        <p class="due-date"><strong>Due:</strong> -</p>
        <p class="description">Deskripsi akan muncul di sini.</p>
    `;
};

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

window.showDetail = (id) => {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        dc.innerHTML = `
            <h3>${todo.title}</h3>
            <p class="status"><strong>Status:</strong> ${todo.status ? 'Completed' : 'Pending'}</p>
            <p class="description">${todo.description}</p>
        `;
    }
};

tema.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});


renderTodos();
