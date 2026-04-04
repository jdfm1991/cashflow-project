<?php
declare(strict_types=1);

namespace App\Middleware;

use App\Services\JWTService;
use App\Helpers\Response;

class AuthMiddleware
{
    private JWTService $jwtService;
    
    public function __construct()
    {
        $this->jwtService = new JWTService();
    }
    
    /**
     * Manejar autenticación
     * @return bool
     */
    public function handle(): bool
    {
        // Obtener headers
        $headers = $this->getHeaders();
        
        // Verificar Authorization header
        if (!isset($headers['Authorization'])) {
            Response::unauthorized('Token no proporcionado');
            return false;
        }
        
        $authHeader = $headers['Authorization'];
        
        // Extraer token (Bearer scheme)
        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            Response::unauthorized('Formato de token inválido');
            return false;
        }
        
        $token = $matches[1];
        
        try {
            // Validar token
            $payload = $this->jwtService->validate($token);
            
            if (!$payload || !isset($payload['user_id'])) {
                Response::unauthorized('Token inválido');
                return false;
            }
            
            // ✅ GUARDAR USER_ID EN MÚLTIPLES UBICACIONES
            // 1. En $_REQUEST para que los controladores lo usen
            $_REQUEST['user_id'] = (int) $payload['user_id'];
            
            // 2. En $_POST (para métodos POST)
            $_POST['user_id'] = (int) $payload['user_id'];
            
            // 3. En $_GET (para métodos GET)
            $_GET['user_id'] = (int) $payload['user_id'];
            
            // 4. En $_SERVER para respaldo
            $_SERVER['USER_ID'] = (int) $payload['user_id'];
            
            // 5. En una variable global (último recurso)
            $GLOBALS['current_user_id'] = (int) $payload['user_id'];
            
            // Guardar datos completos del usuario
            $_REQUEST['user_data'] = $payload;
            
            // Log para debugging
            error_log("AuthMiddleware: Usuario autenticado ID: " . $payload['user_id']);
            
            return true;
            
        } catch (\Exception $e) {
            error_log("AuthMiddleware error: " . $e->getMessage());
            Response::unauthorized($e->getMessage());
            return false;
        }
    }
    
    /**
     * Obtener todos los headers
     * @return array
     */
    private function getHeaders(): array
    {
        $headers = [];
        
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
        } else {
            // Fallback para servidores que no soportan getallheaders()
            foreach ($_SERVER as $name => $value) {
                if (substr($name, 0, 5) == 'HTTP_') {
                    $key = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
                    $headers[$key] = $value;
                }
            }
        }
        
        return $headers;
    }
}