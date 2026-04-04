<?php
/**
 * API CashFlow - Punto de entrada principal
 * Versión de prueba para diagnóstico
 */

// ============================================
// 1. CONFIGURACIÓN DE ERRORES
// ============================================
error_reporting(E_ALL);
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);

// ============================================
// 2. CONFIGURACIÓN CORS
// ============================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');
header('Content-Type: application/json; charset=utf-8');

// ============================================
// 3. MANEJO DE PREFLIGHT (OPTIONS)
// ============================================
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// ============================================
// 4. FUNCIÓN DE RESPUESTA JSON
// ============================================
function jsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit();
}

// ============================================
// 5. OBTENER Y LIMPIAR LA URI
// ============================================
$requestUri = $_SERVER['REQUEST_URI'];
$requestMethod = $_SERVER['REQUEST_METHOD'];

// Eliminar query string (todo después de ?)
if (($pos = strpos($requestUri, '?')) !== false) {
    $requestUri = substr($requestUri, 0, $pos);
}

// Eliminar la parte base de la URL si existe
$scriptName = $_SERVER['SCRIPT_NAME'];
$scriptDir = dirname($scriptName);

// Eliminar el directorio base de la URL
if ($scriptDir !== '/' && $scriptDir !== '\\') {
    $requestUri = str_replace($scriptDir, '', $requestUri);
}

// Eliminar barras escapadas (problema específico)
$requestUri = stripslashes($requestUri);

// Asegurar que la URI comienza con /
if (substr($requestUri, 0, 1) !== '/') {
    $requestUri = '/' . $requestUri;
}

// Eliminar la primera barra para facilitar el matching
$requestUri = ltrim($requestUri, '/');

// Log para debugging
error_log("========================================");
error_log("Method: {$requestMethod}");
error_log("Original URI: {$_SERVER['REQUEST_URI']}");
error_log("Processed URI: {$requestUri}");
error_log("========================================");

// ============================================
// 6. OBTENER DATOS DEL BODY PARA POST
// ============================================
$input = [];
if ($requestMethod === 'POST' || $requestMethod === 'PUT' || $requestMethod === 'PATCH') {
    $rawInput = file_get_contents('php://input');
    if (!empty($rawInput)) {
        $input = json_decode($rawInput, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $input = [];
        }
    }
}

// ============================================
// 7. DEFINIR RUTAS
// ============================================

// Ruta raíz
if ($requestUri === '' || $requestUri === '/') {
    jsonResponse([
        'success' => true,
        'message' => 'API CashFlow funcionando',
        'timestamp' => date('Y-m-d H:i:s'),
        'php_version' => PHP_VERSION,
        'request_uri' => $requestUri,
        'original_uri' => $_SERVER['REQUEST_URI']
    ]);
}
// Health check
elseif ($requestUri === 'api/health') {
    jsonResponse([
        'success' => true,
        'message' => 'Health check OK',
        'timestamp' => date('Y-m-d H:i:s'),
        'status' => 'healthy'
    ]);
}
// Version
elseif ($requestUri === 'api/version') {
    jsonResponse([
        'success' => true,
        'version' => '1.0.0',
        'name' => 'CashFlow API',
        'php_version' => PHP_VERSION
    ]);
}
// Login
elseif ($requestUri === 'api/auth/login' && $requestMethod === 'POST') {
    // Verificar que hay datos
    if (empty($input)) {
        jsonResponse([
            'success' => false,
            'message' => 'No se recibieron datos',
            'received_data' => $input
        ], 400);
    }
    
    // Credenciales de prueba
    $testUser = 'demo@cashflow.com';
    $testPass = 'demo123';
    
    $username = $input['username_or_email'] ?? '';
    $password = $input['password'] ?? '';
    
    if ($username === $testUser && $password === $testPass) {
        jsonResponse([
            'success' => true,
            'message' => 'Login exitoso',
            'data' => [
                'access_token' => 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImRlbW8iLCJlbWFpbCI6ImRlbW9AY2FzaGZsb3cuY29tIiwicm9sZSI6InVzZXIiLCJpYXQiOjE3NDI4OTYwMDAsImV4cCI6MTc0Mjg5OTYwMH0.test_signature',
                'refresh_token' => 'refresh_token_test_12345',
                'token_type' => 'Bearer',
                'expires_in' => 3600,
                'user' => [
                    'id' => 1,
                    'username' => 'demo',
                    'email' => 'demo@cashflow.com',
                    'full_name' => 'Usuario Demo',
                    'role' => 'user',
                    'avatar' => null
                ]
            ]
        ]);
    } else {
        jsonResponse([
            'success' => false,
            'message' => 'Credenciales inválidas',
            'debug' => [
                'received_username' => $username,
                'expected_username' => $testUser,
                'received_password_length' => strlen($password),
                'input' => $input
            ]
        ], 401);
    }
}
// Dashboard stats (requiere token, pero para prueba devolvemos datos)
elseif ($requestUri === 'api/dashboard/stats' && $requestMethod === 'GET') {
    // Verificar token (simulado)
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    
    if (empty($authHeader) || !str_starts_with($authHeader, 'Bearer ')) {
        jsonResponse([
            'success' => false,
            'message' => 'Token no proporcionado'
        ], 401);
    }
    
    jsonResponse([
        'success' => true,
        'data' => [
            'current_period' => [
                'total_income' => 12500.00,
                'total_expense' => 8750.00,
                'balance' => 3750.00
            ],
            'comparison' => [
                'income_change' => 15.5,
                'expense_change' => -5.2,
                'balance_change' => 45.8
            ],
            'trends' => [
                'labels' => ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
                'income_data' => [12000, 12500, 13000, 12800, 13500, 14000],
                'expense_data' => [9000, 8750, 8500, 8200, 8300, 8100]
            ]
        ]
    ]);
}
// Accounts
elseif ($requestUri === 'api/accounts' && $requestMethod === 'GET') {
    jsonResponse([
        'success' => true,
        'data' => [
            [
                'id' => 1,
                'name' => 'Ventas Online',
                'type' => 'income',
                'category' => 'ventas',
                'balance' => 5000.00,
                'is_active' => true
            ],
            [
                'id' => 2,
                'name' => 'Alquileres',
                'type' => 'income',
                'category' => 'alquileres',
                'balance' => 2000.00,
                'is_active' => true
            ],
            [
                'id' => 3,
                'name' => 'Impuestos',
                'type' => 'expense',
                'category' => 'impuestos',
                'balance' => -1500.00,
                'is_active' => true
            ]
        ]
    ]);
}
// Incomes
elseif ($requestUri === 'api/incomes' && $requestMethod === 'GET') {
    jsonResponse([
        'success' => true,
        'data' => [
            [
                'id' => 1,
                'date' => '2024-03-01',
                'account_name' => 'Ventas Online',
                'category' => 'ventas',
                'description' => 'Venta producto A',
                'amount' => 1500.00
            ],
            [
                'id' => 2,
                'date' => '2024-03-05',
                'account_name' => 'Ventas Online',
                'category' => 'ventas',
                'description' => 'Venta producto B',
                'amount' => 2200.00
            ]
        ]
    ]);
}
// Expenses
elseif ($requestUri === 'api/expenses' && $requestMethod === 'GET') {
    jsonResponse([
        'success' => true,
        'data' => [
            [
                'id' => 1,
                'date' => '2024-03-02',
                'account_name' => 'Impuestos',
                'category' => 'impuestos',
                'description' => 'Pago IVA',
                'amount' => 500.00
            ],
            [
                'id' => 2,
                'date' => '2024-03-10',
                'account_name' => 'Proveedores',
                'category' => 'proveedores',
                'description' => 'Compra insumos',
                'amount' => 1200.00
            ]
        ]
    ]);
}
// Ruta para depuración - muestra todas las rutas disponibles
elseif ($requestUri === 'api/debug/routes') {
    jsonResponse([
        'success' => true,
        'routes' => [
            '/' => 'GET - Root',
            'api/health' => 'GET - Health check',
            'api/version' => 'GET - Version',
            'api/auth/login' => 'POST - Login',
            'api/dashboard/stats' => 'GET - Dashboard stats (requiere token)',
            'api/accounts' => 'GET - List accounts',
            'api/incomes' => 'GET - List incomes',
            'api/expenses' => 'GET - List expenses',
            'api/debug/routes' => 'GET - This route'
        ],
        'current_request' => [
            'method' => $requestMethod,
            'uri' => $requestUri,
            'original_uri' => $_SERVER['REQUEST_URI']
        ]
    ]);
}
// Ruta no encontrada
else {
    jsonResponse([
        'success' => false,
        'message' => 'Ruta no encontrada',
        'uri' => $requestUri,
        'method' => $requestMethod,
        'available_endpoints' => [
            'GET /' => 'Root',
            'GET /api/health' => 'Health check',
            'GET /api/version' => 'Version',
            'POST /api/auth/login' => 'Login',
            'GET /api/dashboard/stats' => 'Dashboard (requiere token)',
            'GET /api/accounts' => 'Accounts',
            'GET /api/incomes' => 'Incomes',
            'GET /api/expenses' => 'Expenses',
            'GET /api/debug/routes' => 'Debug routes'
        ]
    ], 404);
}