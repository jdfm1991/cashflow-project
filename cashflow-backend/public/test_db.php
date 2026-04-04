<?php
// public/test_db.php
// Script para probar la conexión a la base de datos

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

require_once __DIR__ . '/../app/Config/Constants.php';
require_once __DIR__ . '/../app/Config/Database.php';

use App\Config\Database;

try {
    $db = Database::getInstance()->getConnection();
    echo "✅ Conexión a base de datos exitosa!\n\n";
    
    // Verificar tablas
    $tables = ['users', 'accounts', 'incomes', 'expenses', 'categories'];
    foreach ($tables as $table) {
        $stmt = $db->query("SHOW TABLES LIKE '{$table}'");
        if ($stmt->rowCount() > 0) {
            echo "✅ Tabla {$table} existe\n";
        } else {
            echo "❌ Tabla {$table} NO existe\n";
        }
    }
    
    // Verificar usuarios
    echo "\n📋 Usuarios registrados:\n";
    $stmt = $db->query("SELECT id, username, email, full_name FROM users");
    $users = $stmt->fetchAll();
    
    if (empty($users)) {
        echo "   No hay usuarios registrados\n";
    } else {
        foreach ($users as $user) {
            echo "   - {$user['username']} ({$user['email']})\n";
        }
    }
    
    // Verificar credenciales demo
    echo "\n🔐 Probando credenciales demo:\n";
    $stmt = $db->prepare("SELECT id, username, email, password_hash FROM users WHERE email = 'demo@cashflow.com'");
    $stmt->execute();
    $demo = $stmt->fetch();
    
    if ($demo) {
        echo "   ✅ Usuario demo encontrado\n";
        
        // Probar contraseña
        $password = 'demo123';
        if (password_verify($password, $demo['password_hash'])) {
            echo "   ✅ Contraseña 'demo123' válida\n";
        } else {
            echo "   ❌ Contraseña 'demo123' NO válida\n";
            echo "   Hash almacenado: " . $demo['password_hash'] . "\n";
            
            // Generar nuevo hash
            $newHash = password_hash('demo123', PASSWORD_DEFAULT);
            echo "   Nuevo hash sugerido: {$newHash}\n";
        }
    } else {
        echo "   ❌ Usuario demo NO encontrado\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}