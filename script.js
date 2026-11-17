'use strict';

// E02 - The JavaScript Dungeon
// Data disimpan sebagai Array of Objects dan akan kembali ke default saat refresh.
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

let todos = defaultTodos.map(todo => ({ ...todo }));
let selectedTodoId = null;

const todoList = document.getElementById('todo-list');
const addButton = document.getElementById('add-btn');
const titleInput = document.getElementById('title');
const descriptionInput = document.getElementById('description');
const detailCard = document.getElementById('detail-card');
const themeToggle = document.getElementById('theme-toggle');

function showEmptyDetail() {
    detailCard.replaceChildren();

    const heading = document.createElement('h3');
    heading.textContent = 'Pilih task buat lihat detailnya';

    const status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Status: -';

    const due = document.createElement('p');
    due.className = 'due-date';
    due.textContent = 'Due: -';

    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = 'Deskripsi akan muncul di sini.';

    detailCard.append(heading, status, due, description);
}

function showDetail(id) {
    const todo = todos.find(item => item.id === id);
    if (!todo) {
        selectedTodoId = null;
        showEmptyDetail();
        return;
    }

    selectedTodoId = id;
    detailCard.replaceChildren();

    const heading = document.createElement('h3');
    heading.textContent = todo.title;

    const status = document.createElement('p');
    status.className = 'status';
    const statusLabel = document.createElement('strong');
    statusLabel.textContent = 'Status: ';
    status.append(statusLabel, document.createTextNode(todo.status ? 'Completed' : 'Pending'));

    const due = document.createElement('p');
    due.className = 'due-date';
    const dueLabel = document.createElement('strong');
    dueLabel.textContent = 'Due: ';
    due.append(dueLabel, document.createTextNode('Not set'));

    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = todo.description || 'Tidak ada deskripsi.';

    detailCard.append(heading, status, due, description);
}

function renderTodos() {
    todoList.replaceChildren();

    if (todos.length === 0) {
        const empty = document.createElement('li');
        empty.textContent = 'Belum ada task. Tambahkan task pertamamu!';
        todoList.appendChild(empty);
        showEmptyDetail();
        selectedTodoId = null;
        return;
    }

    todos.forEach(todo => {
        const li = document.createElement('li');
        const wrapper = document.createElement('div');
        wrapper.className = 'todo-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `todo-${todo.id}`;
        checkbox.checked = Boolean(todo.status);
        checkbox.addEventListener('change', () => toggleStatus(todo.id));

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.textContent = todo.title;
        label.addEventListener('click', () => showDetail(todo.id));

        const actions = document.createElement('div');
        actions.className = 'actions';

        const editButton = document.createElement('button');
        editButton.type = 'button';
        editButton.className = 'btn-edit';
        editButton.textContent = 'Edit';
        editButton.addEventListener('click', () => editTodo(todo.id));

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn-delete';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteTodo(todo.id));

        actions.append(editButton, deleteButton);
        wrapper.append(checkbox, label, actions);
        li.appendChild(wrapper);
        todoList.appendChild(li);
    });

    const selectedTodo = todos.find(item => item.id === selectedTodoId);
    if (selectedTodo) showDetail(selectedTodo.id);
    else showDetail(todos[0].id);
}

function addTodo() {
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
        alert('Title nggak boleh kosong!');
        titleInput.focus();
        return;
    }

    const newTodo = {
        id: Date.now(),
        title,
        description: description || 'No description provided.',
        status: false
    };

    todos.push(newTodo);
    titleInput.value = '';
    descriptionInput.value = '';
    renderTodos();
    showDetail(newTodo.id);
    titleInput.focus();
}

function toggleStatus(id) {
    const todo = todos.find(item => item.id === id);
    if (!todo) return;

    todo.status = !todo.status;
    renderTodos();
    showDetail(id);
}

function editTodo(id) {
    const todo = todos.find(item => item.id === id);
    if (!todo) return;

    const updatedTitle = prompt('Edit judul task:', todo.title);
    if (updatedTitle === null) return;

    const trimmedTitle = updatedTitle.trim();
    if (!trimmedTitle) {
        alert('Title nggak boleh kosong!');
        return;
    }

    todo.title = trimmedTitle;
    renderTodos();
    showDetail(id);
}

function deleteTodo(id) {
    const todo = todos.find(item => item.id === id);
    if (!todo) return;

    const confirmed = confirm(`Hapus task "${todo.title}"?`);
    if (!confirmed) return;

    todos = todos.filter(item => item.id !== id);
    if (selectedTodoId === id) selectedTodoId = null;

    renderTodos();
}

addButton.addEventListener('click', addTodo);

titleInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
        event.preventDefault();
        addTodo();
    }
});

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
});

renderTodos();
