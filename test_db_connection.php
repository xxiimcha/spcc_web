<?php
// Add CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:5174');
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
    
    // Test query to check if school_heads table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'school_heads'");
    $tableExists = $stmt->rowCount() > 0;
    
    if ($tableExists) {
        // Check if there are any school heads
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM school_heads");
        $count = $stmt->fetch(PDO::FETCH_ASSOC)['count'];
        
        echo json_encode([
            'status' => 'success',
            'message' => 'Database connection successful',
            'table_exists' => true,
            'school_heads_count' => $count
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'school_heads table does not exist',
            'table_exists' => false
        ]);
    }
    
} catch (PDOException $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'Database connection failed: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    echo json_encode([
        'status' => 'error',
        'message' => 'General error: ' . $e->getMessage()
    ]);
}
?>
