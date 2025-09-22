<?php
header('Content-Type: text/html; charset=utf-8');

echo "<h2>Database Connection Test</h2>";

try {
    $host = 'localhost';
    $dbname = 'spcc_database';
    $dbuser = 'root';
    $dbpass = 'nchsrgs2803';
    
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $dbuser, $dbpass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "<p style='color: green;'>✅ Database connection successful!</p>";
    
    // Test if schedules table exists
    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'schedules'");
        $result = $stmt->fetch();
        
        if ($result) {
            echo "<p style='color: green;'>✅ Schedules table exists!</p>";
            
            // Check table structure
            $stmt = $pdo->query("DESCRIBE schedules");
            $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo "<h3>Table Structure:</h3>";
            echo "<table border='1' style='border-collapse: collapse;'>";
            echo "<tr><th>Field</th><th>Type</th><th>Null</th><th>Key</th><th>Default</th></tr>";
            foreach ($columns as $column) {
                echo "<tr>";
                echo "<td>{$column['Field']}</td>";
                echo "<td>{$column['Type']}</td>";
                echo "<td>{$column['Null']}</td>";
                echo "<td>{$column['Key']}</td>";
                echo "<td>{$column['Default']}</td>";
                echo "</tr>";
            }
            echo "</table>";
            
            // Count existing schedules
            $stmt = $pdo->query("SELECT COUNT(*) as count FROM schedules");
            $result = $stmt->fetch();
            echo "<p>Current schedules in database: {$result['count']}</p>";
            
        } else {
            echo "<p style='color: orange;'>⚠️ Schedules table does not exist. It will be created automatically when needed.</p>";
        }
    } catch (Exception $e) {
        echo "<p style='color: orange;'>⚠️ Error checking schedules table: " . $e->getMessage() . "</p>";
    }
    
} catch (PDOException $e) {
    echo "<p style='color: red;'>❌ Database connection failed: " . $e->getMessage() . "</p>";
} catch (Exception $e) {
    echo "<p style='color: red;'>❌ Error: " . $e->getMessage() . "</p>";
}
?>

<style>
body { font-family: Arial, sans-serif; margin: 20px; }
table { margin: 10px 0; }
th, td { padding: 8px; text-align: left; }
th { background-color: #f2f2f2; }
</style>



