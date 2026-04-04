<?php
// public/test-routes.php
require_once __DIR__ . '/../vendor/autoload.php';

// Cargar variables de entorno
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

// Cargar constantes
require_once __DIR__ . '/../app/Config/Constants.php';

echo "<h1>🧪 Prueba de Rutas</h1>";

// Cargar rutas
$routes = require_once __DIR__ . '/../app/Config/Routes.php';

echo "<h2>📋 Listado de rutas registradas:</h2>";
echo "<table border='1' cellpadding='8' cellspacing='0'>";
echo "<tr style='background:#333; color:white;'>";
echo "<th>Método</th><th>Patrón</th><th>Controlador</th><th>Acción</th><th>Middleware</th>";
echo "</tr>";

foreach ($routes as $route) {
    $method = $route['method'];
    $pattern = $route['pattern'];
    $controller = basename(str_replace('\\', '/', $route['controller']));
    $action = $route['action'];
    $middleware = implode(', ', $route['middleware'] ?? ['-']);
    
    $color = match($method) {
        'GET' => '#28a745',
        'POST' => '#007bff',
        'PUT' => '#fd7e14',
        'DELETE' => '#dc3545',
        default => '#6c757d'
    };
    
    echo "<tr>";
    echo "<td style='background:{$color}; color:white; font-weight:bold;'>{$method}</td>";
    echo "<td><code>{$pattern}</code></td>";
    echo "<td>{$controller}</td>";
    echo "<td>{$action}</td>";
    echo "<td>{$middleware}</td>";
    echo "</tr>";
}

echo "</table>";

echo "<h2>🧪 Prueba de matching de rutas:</h2>";

// URLs de prueba
$testUrls = [
    'api/health',
    'api/version',
    'api/accounts',
    'api/accounts/5',
    'api/incomes?start_date=2024-01-01',
    'api/expenses/10',
    'api/categories/income',
    'api/reports/pdf',
    'ruta/inexistente'
];

foreach ($testUrls as $testUrl) {
    echo "<h3>Probando: <code>{$testUrl}</code></h3>";
    $found = false;
    
    foreach ($routes as $route) {
        if (preg_match($route['pattern'], $testUrl, $matches)) {
            echo "<p style='color:green'>✅ Match encontrado: ";
            echo "<strong>{$route['method']}</strong> → ";
            echo "{$route['controller']}::{$route['action']}</p>";
            if (count($matches) > 1) {
                echo "<p style='margin-left:20px'>📌 Parámetros extraídos: ";
                print_r(array_slice($matches, 1));
                echo "</p>";
            }
            $found = true;
            break;
        }
    }
    
    if (!$found) {
        echo "<p style='color:red'>❌ No se encontró ruta para: {$testUrl}</p>";
    }
}

echo "<h2 style='color:green'>✅ Verificación de rutas completada</h2>";