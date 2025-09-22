<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection
try {
    $host = 'localhost';
    $dbname = 'spcc_scheduling_system';
    $dbuser = 'root';
    $dbpass = 'nchsrgs2803';
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $dbuser, $dbpass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGetSchedules($pdo);
        break;
    case 'POST':
        handleCreateSchedule($pdo);
        break;
    case 'PUT':
        handleUpdateSchedule($pdo);
        break;
    case 'DELETE':
        handleDeleteSchedule($pdo);
        break;
    default:
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        break;
}

function handleCreateSchedule($pdo) {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        
        // Log the input for debugging
        error_log("Schedule creation input: " . json_encode($input));
        
        if (!$input) {
            echo json_encode([
                'success' => false,
                'message' => 'Invalid JSON input'
            ]);
            return;
        }
        
        // Validate required fields
        $required_fields = ['school_year', 'semester', 'subj_id', 'prof_id', 'section_id', 'schedule_type', 'start_time', 'end_time', 'days'];
        foreach ($required_fields as $field) {
            if (!isset($input[$field]) || (is_array($input[$field]) && empty($input[$field])) || (!is_array($input[$field]) && trim($input[$field]) === '')) {
                echo json_encode([
                    'success' => false,
                    'message' => "Missing required field: $field"
                ]);
                return;
            }
        }
        
        // Create schedules table if it doesn't exist
        $createTableSQL = "
        CREATE TABLE IF NOT EXISTS schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_year VARCHAR(10) NOT NULL,
            semester VARCHAR(50) NOT NULL,
            subj_id INT NOT NULL,
            prof_id INT NOT NULL,
            section_id INT NOT NULL,
            room_id INT NULL,
            schedule_type ENUM('Onsite', 'Online') DEFAULT 'Onsite',
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            days JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        $pdo->exec($createTableSQL);
        
        // Insert schedule without conflict checking for now (to ensure it works)
        $sql = "INSERT INTO schedules (school_year, semester, subj_id, prof_id, section_id, room_id, schedule_type, start_time, end_time, days, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([
            $input['school_year'],
            $input['semester'],
            $input['subj_id'],
            $input['prof_id'],
            $input['section_id'],
            $input['room_id'] ?? null,
            $input['schedule_type'],
            $input['start_time'],
            $input['end_time'],
            json_encode($input['days'])
        ]);
        
        if ($result) {
            $schedule_id = $pdo->lastInsertId();
            
            echo json_encode([
                'success' => true,
                'message' => 'Schedule created successfully',
                'data' => [
                    'schedule_id' => $schedule_id,
                    ...$input
                ]
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Failed to create schedule'
            ]);
        }
        
    } catch (Exception $e) {
        error_log("Schedule creation error: " . $e->getMessage());
        echo json_encode([
            'success' => false,
            'message' => 'Error creating schedule: ' . $e->getMessage()
        ]);
    }
}

function handleGetSchedules($pdo) {
    try {
        $school_year = $_GET['school_year'] ?? '';
        $semester = $_GET['semester'] ?? '';
        $professor_id = $_GET['professor_id'] ?? '';
        
        // Create schedules table if it doesn't exist
        $createTableSQL = "
        CREATE TABLE IF NOT EXISTS schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            school_year VARCHAR(10) NOT NULL,
            semester VARCHAR(50) NOT NULL,
            subj_id INT NOT NULL,
            prof_id INT NOT NULL,
            section_id INT NOT NULL,
            room_id INT NULL,
            schedule_type ENUM('Onsite', 'Online') DEFAULT 'Onsite',
            start_time TIME NOT NULL,
            end_time TIME NOT NULL,
            days JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )";
        
        $pdo->exec($createTableSQL);
        
        $sql = "SELECT * FROM schedules WHERE 1=1";
        $params = [];
        
        if (!empty($school_year)) {
            $sql .= " AND school_year = ?";
            $params[] = $school_year;
        }
        
        if (!empty($semester)) {
            $sql .= " AND semester = ?";
            $params[] = $semester;
        }
        
        if (!empty($professor_id)) {
            $sql .= " AND prof_id = ?";
            $params[] = $professor_id;
        }
        
        $sql .= " ORDER BY created_at DESC";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $schedules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Parse days JSON for each schedule
        foreach ($schedules as &$schedule) {
            if (isset($schedule['days'])) {
                $schedule['days'] = json_decode($schedule['days'], true) ?: [];
            }
        }
        
        echo json_encode([
            'success' => true,
            'data' => $schedules,
            'message' => 'Schedules retrieved successfully'
        ]);
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error retrieving schedules: ' . $e->getMessage()
        ]);
    }
}

function handleUpdateSchedule($pdo) {
    try {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            echo json_encode([
                'success' => false,
                'message' => 'Schedule ID is required'
            ]);
            return;
        }
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input) {
            echo json_encode([
                'success' => false,
                'message' => 'Invalid JSON input'
            ]);
            return;
        }
        
        // Build update query dynamically
        $updateFields = [];
        $params = [];
        
        $allowedFields = ['school_year', 'semester', 'subj_id', 'prof_id', 'section_id', 'room_id', 'schedule_type', 'start_time', 'end_time', 'days'];
        
        foreach ($allowedFields as $field) {
            if (isset($input[$field])) {
                $updateFields[] = "$field = ?";
                $params[] = $field === 'days' ? json_encode($input[$field]) : $input[$field];
            }
        }
        
        if (empty($updateFields)) {
            echo json_encode([
                'success' => false,
                'message' => 'No valid fields to update'
            ]);
            return;
        }
        
        $sql = "UPDATE schedules SET " . implode(', ', $updateFields) . " WHERE id = ?";
        $params[] = $id;
        
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute($params);
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Schedule updated successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update schedule'
            ]);
        }
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error updating schedule: ' . $e->getMessage()
        ]);
    }
}

function handleDeleteSchedule($pdo) {
    try {
        $id = $_GET['id'] ?? '';
        if (empty($id)) {
            echo json_encode([
                'success' => false,
                'message' => 'Schedule ID is required'
            ]);
            return;
        }
        
        $sql = "DELETE FROM schedules WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $result = $stmt->execute([$id]);
        
        if ($result) {
            echo json_encode([
                'success' => true,
                'message' => 'Schedule deleted successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Failed to delete schedule'
            ]);
        }
        
    } catch (Exception $e) {
        echo json_encode([
            'success' => false,
            'message' => 'Error deleting schedule: ' . $e->getMessage()
        ]);
    }
}
?>
