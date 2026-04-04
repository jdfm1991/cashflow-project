<?php
// public/test-jwt.php
require_once __DIR__ . '/../vendor/autoload.php';

use App\Services\JWTService;

echo "<h1>🔐 Prueba de JWT (versión 7.x)</h1>";

try {
    // Cargar variables de entorno
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
    $dotenv->load();
    
    $jwtService = new JWTService();
    
    // 1. Generar token
    $payload = [
        'user_id' => 1,
        'email' => 'admin@cashflow.com',
        'role' => 'admin'
    ];
    
    $token = $jwtService->generate($payload);
    echo "<h2>✅ Token generado:</h2>";
    echo "<pre>" . $token . "</pre>";
    
    // 2. Validar token
    $decoded = $jwtService->validate($token);
    echo "<h2>✅ Token validado:</h2>";
    echo "<pre>";
    print_r($decoded);
    echo "</pre>";
    
    // 3. Parsear token (sin validación)
    $parsed = $jwtService->parse($token);
    echo "<h2>📝 Token parseado (solo payload):</h2>";
    echo "<pre>";
    print_r($parsed);
    echo "</pre>";
    
    echo "<h2 style='color: green'>🎉 Todas las pruebas pasaron correctamente!</h2>";
    
} catch (Exception $e) {
    echo "<h2 style='color: red'>❌ Error: " . $e->getMessage() . "</h2>";
}