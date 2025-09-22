<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Database connection
    $host = 'localhost';
    $dbname = 'spcc_database';
    $dbuser = 'root';
    $dbpass = 'nchsrgs2803';
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $dbuser, $dbpass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Get sections that have rooms assigned
    $stmt = $pdo->prepare("
        SELECT DISTINCT 
            s.section_id,
            s.section_name,
            s.grade_level,
            s.strand,
            s.number_of_students,
            r.id as room_id,
            r.number as room_number,
            r.type as room_type,
            r.capacity as room_capacity
        FROM sections s
        INNER JOIN rooms r ON FIND_IN_SET(r.id, s.room_ids) > 0
        WHERE s.room_ids IS NOT NULL AND s.room_ids != ''
        ORDER BY s.grade_level, s.section_name
    ");
    
    $stmt->execute();
    $sections = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group sections by section_id and collect their rooms
    $groupedSections = [];
    foreach ($sections as $section) {
        $sectionId = $section['section_id'];
        
        if (!isset($groupedSections[$sectionId])) {
            $groupedSections[$sectionId] = [
                'id' => $section['section_id'],
                'name' => $section['section_name'],
                'grade_level' => $section['grade_level'],
                'strand' => $section['strand'],
                'number_of_students' => $section['number_of_students'],
                'rooms' => []
            ];
        }
        
        $groupedSections[$sectionId]['rooms'][] = [
            'id' => $section['room_id'],
            'number' => $section['room_number'],
            'type' => $section['room_type'],
            'capacity' => $section['room_capacity']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => array_values($groupedSections),
        'message' => 'Room-assigned sections retrieved successfully'
    ]);
    
} catch (PDOException $e) {
    error_log("Database error in get_room_assigned_sections.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database connection error. Please try again later.',
        'error' => $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("General error in get_room_assigned_sections.php: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'An error occurred. Please try again later.',
        'error' => $e->getMessage()
    ]);
}
?>
