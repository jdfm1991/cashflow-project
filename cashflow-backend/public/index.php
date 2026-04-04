<?php
// Configuración CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Manejar OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    echo json_encode(['message' => 'OK']);
    exit();
}

// Resto del código (aquí va tu enrutamiento)
try {
    require_once __DIR__ . '/../vendor/autoload.php';

    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
    $dotenv->load();

    require_once __DIR__ . '/../app/Config/Constants.php';
    require_once __DIR__ . '/../app/Config/Database.php';

    // Obtener la URI
    $requestUri = $_SERVER['REQUEST_URI'];
    $requestMethod = $_SERVER['REQUEST_METHOD'];

    // Limpiar URI
    $requestUri = strtok($requestUri, '?');
    $requestUri = trim($requestUri, '/');

    // Crear directorios necesarios si no existen
    $directories = [
        LOGS_PATH,
        UPLOADS_PATH,
        BANK_STATEMENTS_PATH,
        TEMP_PATH,
        EXPORTS_PATH,
        CACHE_PATH
    ];

    foreach ($directories as $dir) {
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
            error_log("Directorio creado: {$dir}");
        }
    }


    // Cargar rutas
    $routes = require_once __DIR__ . '/../app/Config/Routes.php';

    $routeFound = false;
    foreach ($routes as $route) {
        if ($route['method'] === $requestMethod && preg_match($route['pattern'], $requestUri, $matches)) {
            $routeFound = true;
            $controllerClass = $route['controller'];
            $action = $route['action'];

            if (class_exists($controllerClass)) {
                $controller = new $controllerClass();

                if (isset($route['middleware'])) {
                    foreach ($route['middleware'] as $middlewareName) {
                        $middlewareClass = "App\\Middleware\\{$middlewareName}";
                        if (class_exists($middlewareClass)) {
                            $middleware = new $middlewareClass();
                            if (method_exists($middleware, 'handle')) {
                                if (!$middleware->handle()) {
                                    exit();
                                }
                            }
                        }
                    }
                }

                array_shift($matches);
                call_user_func_array([$controller, $action], $matches);
            } else {
                http_response_code(500);
                echo json_encode(['success' => false, 'message' => "Controlador no encontrado: {$controllerClass}"]);
                exit();
            }
            break;
        }
    }

    if (!$routeFound) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Ruta no encontrada']);
        exit();
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
    exit();
}
