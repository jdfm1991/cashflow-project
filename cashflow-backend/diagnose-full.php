<?php
// public/diagnose-full.php
echo "<h1>🔍 Diagnóstico Completo del Sistema</h1>";

// 1. Verificar estructura de directorios
echo "<h2>📁 Estructura de Directorios:</h2>";
$directories = [
    '../app/Config',
    '../app/Controllers',
    '../app/Models',
    '../app/Services',
    '../app/Middleware',
    '../app/Helpers',
    '../app/Exceptions',
    '../storage/logs',
    '../storage/uploads',
    '../storage/exports'
];

foreach ($directories as $dir) {
    $fullPath = __DIR__ . '/' . $dir;
    if (is_dir($fullPath)) {
        echo "<p style='color:green'>✅ {$dir}</p>";
    } else {
        echo "<p style='color:red'>❌ {$dir} - NO EXISTE</p>";
        mkdir($fullPath, 0777, true);
        echo "<p style='color:orange'>📁 Directorio creado: {$dir}</p>";
    }
}

// 2. Verificar archivos críticos
echo "<h2>📄 Archivos Críticos:</h2>";
$criticalFiles = [
    '../app/Config/Constants.php',
    '../app/Config/Database.php',
    '../app/Config/Routes.php',
    '../app/Helpers/Response.php',
    '../app/Helpers/Validator.php',
    '../app/Helpers/Logger.php',
    '../app/Exceptions/ApiException.php',
    '../app/Exceptions/NotFoundException.php',
    '../vendor/autoload.php'
];

foreach ($criticalFiles as $file) {
    $fullPath = __DIR__ . '/' . $file;
    if (file_exists($fullPath)) {
        echo "<p style='color:green'>✅ {$file}</p>";
    } else {
        echo "<p style='color:red'>❌ {$file} - NO EXISTE</p>";
    }
}

// 3. Verificar autoloader
echo "<h2>📦 Autoloader:</h2>";
require_once __DIR__ . '/../vendor/autoload.php';

$classesToCheck = [
    'App\Config\Database',
    'App\Helpers\Response',
    'App\Helpers\Validator',
    'App\Helpers\Logger',
    'App\Exceptions\ApiException',
    'App\Exceptions\NotFoundException',
    'App\Services\JWTService',
    'App\Services\AuthService',
    'App\Middleware\AuthMiddleware',
    'App\Middleware\CorsMiddleware'
];

foreach ($classesToCheck as $class) {
    if (class_exists($class)) {
        echo "<p style='color:green'>✅ {$class}</p>";
    } else {
        echo "<p style='color:red'>❌ {$class} - NO ENCONTRADA</p>";
    }
}

// 4. Verificar constantes
echo "<h2>⚙️ Constantes:</h2>";
require_once __DIR__ . '/../app/Config/Constants.php';

$constants = ['APP_NAME', 'APP_ENV', 'APP_DEBUG', 'BASE_PATH', 'LOGS_PATH', 'UPLOADS_PATH', 'JWT_SECRET'];
foreach ($constants as $const) {
    if (defined($const)) {
        $value = constant($const);
        $displayValue = $const === 'JWT_SECRET' ? substr($value, 0, 10) . '...' : $value;
        echo "<p style='color:green'>✅ {$const} = {$displayValue}</p>";
    } else {
        echo "<p style='color:red'>❌ {$const} - NO DEFINIDA</p>";
    }
}

// 5. Verificar conexión a base de datos
echo "<h2>🗄️ Base de Datos:</h2>";
try {
    $db = App\Config\Database::getInstance();
    $conn = $db->getConnection();
    echo "<p style='color:green'>✅ Conexión exitosa a la base de datos</p>";
    
    // Verificar tablas
    $tables = ['users', 'accounts', 'incomes', 'expenses', 'categories'];
    foreach ($tables as $table) {
        $stmt = $conn->query("SHOW TABLES LIKE '{$table}'");
        if ($stmt->rowCount() > 0) {
            echo "<p style='color:green'>✅ Tabla {$table} existe</p>";
        } else {
            echo "<p style='color:orange'>⚠️ Tabla {$table} no existe - Ejecuta las migraciones</p>";
        }
    }
} catch (Exception $e) {
    echo "<p style='color:red'>❌ Error de conexión: " . $e->getMessage() . "</p>";
}

// 6. Verificar permisos de escritura
echo "<h2>🔐 Permisos:</h2>";
$writableDirs = ['../storage/logs', '../storage/uploads', '../storage/exports'];
foreach ($writableDirs as $dir) {
    $fullPath = __DIR__ . '/' . $dir;
    if (is_writable($fullPath)) {
        echo "<p style='color:green'>✅ {$dir} - Escribible</p>";
    } else {
        echo "<p style='color:red'>❌ {$dir} - NO ESCRIBIBLE</p>";
        chmod($fullPath, 0777);
        echo "<p style='color:orange'>📁 Permisos corregidos para {$dir}</p>";
    }
}

echo "<h2 style='color:green'>🎉 Diagnóstico completado</h2>";