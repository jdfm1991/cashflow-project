<?php
// database/create_demo_user.php
// Script para crear usuario demo

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

require_once __DIR__ . '/../app/Config/Constants.php';
require_once __DIR__ . '/../app/Config/Database.php';

use App\Config\Database;

try {
    $db = Database::getInstance()->getConnection();
    
    // Verificar si el usuario ya existe
    $stmt = $db->prepare("SELECT id FROM users WHERE email = 'demo@cashflow.com'");
    $stmt->execute();
    $existing = $stmt->fetch();
    
    if ($existing) {
        echo "✅ El usuario demo ya existe (ID: {$existing['id']})\n";
        
        // Actualizar contraseña por si acaso
        $stmt = $db->prepare("UPDATE users SET password_hash = :password WHERE email = 'demo@cashflow.com'");
        $stmt->execute([
            'password' => password_hash('demo123', PASSWORD_DEFAULT)
        ]);
        echo "✅ Contraseña actualizada a 'demo123'\n";
        
    } else {
        // Crear usuario demo
        $passwordHash = password_hash('demo123', PASSWORD_DEFAULT);
        
        $stmt = $db->prepare("
            INSERT INTO users (username, email, password_hash, full_name, role, email_verified, is_active) 
            VALUES (:username, :email, :password, :full_name, :role, 1, 1)
        ");
        
        $result = $stmt->execute([
            'username' => 'demo',
            'email' => 'demo@cashflow.com',
            'password' => $passwordHash,
            'full_name' => 'Usuario Demo',
            'role' => 'user'
        ]);
        
        if ($result) {
            echo "✅ Usuario demo creado exitosamente!\n";
            echo "   Usuario: demo@cashflow.com\n";
            echo "   Contraseña: demo123\n";
        } else {
            echo "❌ Error al crear usuario demo\n";
        }
    }
    
    // Mostrar todos los usuarios
    echo "\n📋 Usuarios en la base de datos:\n";
    $stmt = $db->query("SELECT id, username, email, full_name, role FROM users");
    $users = $stmt->fetchAll();
    
    foreach ($users as $user) {
        echo "   - ID: {$user['id']}, Usuario: {$user['username']}, Email: {$user['email']}, Rol: {$user['role']}\n";
    }
    
} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}