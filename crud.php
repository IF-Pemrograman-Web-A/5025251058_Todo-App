<?php
require_once 'config.php';
header('Content-Type: application/json');

$action = $_GET['action'] ?? '';


if ($action === 'get') {
    $type = $_GET['type'] ?? 'personal';
    $stmt = $conn->prepare("SELECT * FROM todos WHERE todo_type = ? ORDER BY created_at DESC");
    $stmt->bind_param("s", $type);
    $stmt->execute();
    $result = $stmt->get_result();
    $todos = [];
    while($row = $result->fetch_assoc()) {
        $todos[] = $row;
    }
    echo json_encode($todos);
    exit;
}

if ($action === 'add') {
    $title = $_POST['title'] ?? '';
    $desc = $_POST['description'] ?? '';
    $notify = $_POST['notify_time'] ?? null;
    if ($notify === '') $notify = null;
    $type = $_POST['todo_type'] ?? 'personal';

    $imagePath = null;
    if (isset($_FILES['image']) && $_FILES['image']['error'] === UPLOAD_ERR_OK) {
        $uploadDir = 'uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0777, true);
        $fileName = time() . '_' . basename($_FILES['image']['name']);
        $targetFile = $uploadDir . $fileName;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
            $imagePath = $targetFile;
        }
    }

    $stmt = $conn->prepare("INSERT INTO todos (title, description, notify_time, image_path, todo_type) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("sssss", $title, $desc, $notify, $imagePath, $type);
    $stmt->execute();
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'delete') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'];

    
    $stmt = $conn->prepare("SELECT image_path FROM todos WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $res = $stmt->get_result()->fetch_assoc();
    if ($res && !empty($res['image_path']) && file_exists($res['image_path'])) {
        unlink($res['image_path']);
    }

    $stmt = $conn->prepare("DELETE FROM todos WHERE id = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo json_encode(['status' => 'success']);
    exit;
}

if ($action === 'update_status') {
    $data = json_decode(file_get_contents("php://input"), true);
    $id = $data['id'];
    $completed = $data['completed'] ? 1 : 0;
    
    $stmt = $conn->prepare("UPDATE todos SET completed = ? WHERE id = ?");
    $stmt->bind_param("ii", $completed, $id);
    $stmt->execute();
    echo json_encode(['status' => 'success']);
    exit;
}
?>
