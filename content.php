<main role="main">
    <section class="todo-list-container" aria-labelledby="task-list-title">
        <h2 id="task-list-title"><?= ucfirst($current_type) ?> Task List</h2>
        <ul class="todo-list" id="todo-list" aria-live="polite">
        </ul>
    </section>
</main>

<aside role="complementary">
    <section class="todo-detail-container" aria-labelledby="task-detail-title">
        <h2 id="task-detail-title">Task Details</h2>
        <div class="detail-card" id="detail-card" aria-live="polite">
            <h3 tabindex="0" id="detail-title">Pilih task buat lihat detailnya</h3>
            <p class="status"><strong>Status:</strong> <span id="detail-status">-</span></p>
            <p class="due-date"><strong>Notification:</strong> <span id="detail-time">-</span></p>
            <p class="description" id="detail-desc">Deskripsi akan muncul di sini.</p>
            <img id="detail-img" src="" alt="Task Image" style="display:none; width: 100%; margin-top: 15px; border-radius: 8px;">
        </div>
    </section>
    
    <section class="todo-form-container" aria-labelledby="create-task-title">
        <h2 id="create-task-title">Create New <?= ucfirst($current_type) ?> Task</h2>
        <form id="todo-form" enctype="multipart/form-data">
            <input type="hidden" name="todo_type" value="<?= $current_type ?>">
            <div class="form-group">
                <label for="title">Title <span aria-hidden="true" style="color:red">*</span></label>
                <input type="text" id="title" name="title" placeholder="Enter task title..." required>
            </div>
            <div class="form-group">
                <label for="description">Description</label>
                <textarea id="description" name="description" placeholder="Enter task details..."></textarea>
            </div>
            
            <div class="form-group">
                <label for="image-capture">Upload Image (Opsional)</label>
                <input type="file" id="image-capture" name="image" accept="image/*">
            </div>

            <div class="form-group">
                <label for="notify-time">Notification Time (Opsional)</label>
                <input type="datetime-local" id="notify-time" name="notify_time">
            </div>

            <button type="submit" id="add-btn">Add Todo</button>
        </form>
    </section>
</aside>
