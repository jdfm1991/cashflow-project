<?php
// Verificar que las dependencias están cargadas
require_once __DIR__ . '/../vendor/autoload.php';

// Verificar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

echo "<h1>Configuración Verificada</h1>";
echo "<h2>PHP Version: " . phpversion() . "</h2>";
echo "<h2>Dependencias Instaladas:</h2>";
echo "<ul>";
echo "<li>phpdotenv: " . (class_exists('Dotenv\Dotenv') ? '✅' : '❌') . "</li>";
echo "<li>JWT: " . (class_exists('Firebase\JWT\JWT') ? '✅' : '❌') . "</li>";
echo "<li>Monolog: " . (class_exists('Monolog\Logger') ? '✅' : '❌') . "</li>";
echo "</ul>";
echo "<h2>Variables de entorno cargadas:</h2>";
echo "<pre>";
print_r(['APP_ENV' => $_ENV['APP_ENV'] ?? 'no cargada', 'DB_HOST' => $_ENV['DB_HOST'] ?? 'no cargada']);
echo "</pre>";