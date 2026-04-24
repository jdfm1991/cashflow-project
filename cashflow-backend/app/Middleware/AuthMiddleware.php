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

        // ✅ LOG: Ver todos los headers recibidos
        error_log("=== AUTH MIDDLEWARE ===");
        error_log("Headers recibidos: " . json_encode($headers));

        // Verificar Authorization header
        if (!isset($headers['Authorization'])) {
            Response::unauthorized('Token no proporcionado');
            return false;
        }

        $authHeader = $headers['Authorization'];
        error_log("Authorization header: " . $authHeader);

        // Extraer token (Bearer scheme)
        if (!preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            error_log("❌ Formato de token inválido");
            Response::unauthorized('Formato de token inválido');
            return false;
        }

        $token = $matches[1];
        error_log("Token extraído: " . substr($token, 0, 50) . "...");

        try {
            // Validar token
            $payload = $this->jwtService->validate($token);
            error_log("Payload decodificado: " . json_encode($payload));

            if (!$payload || !isset($payload['user_id']) || $payload['user_id'] <= 0) {
                error_log("❌ user_id inválido o no presente");
                Response::unauthorized('Token inválido');
                return false;
            }

            // ✅ GUARDAR USER_ID
            $userId = (int) $payload['user_id'];
            $_REQUEST['user_id'] = $userId;
            $_POST['user_id'] = $userId;
            $_GET['user_id'] = $userId;
            $_SERVER['USER_ID'] = $userId;
            $GLOBALS['current_user_id'] = $userId;
            

            // ✅ NUEVO: GUARDAR COMPANY_ID
            $companyId = (int) ($payload['company_id'] ?? 0);
            if ($companyId > 0) {
                $_REQUEST['company_id'] = $companyId;
                $_POST['company_id'] = $companyId;
                $_GET['company_id'] = $companyId;
                $_SERVER['COMPANY_ID'] = $companyId;
                $GLOBALS['current_company_id'] = $companyId;
            }

            // ✅ NUEVO: GUARDAR ROL
            $userRole = $payload['role'] ?? 'user';
            $_REQUEST['user_role'] = $userRole;
            $_SERVER['USER_ROLE'] = $userRole;

            // Guardar datos completos del usuario
            $_REQUEST['user_data'] = $payload;

            error_log("✅ Usuario autenticado ID: {$payload['user_id']}");

            // Log para debugging
            error_log("AuthMiddleware: Usuario autenticado ID: {$userId}, Company ID: {$companyId}, Role: {$userRole}");

            return true;
        } catch (\Exception $e) {
            error_log("❌ Error validando token: " . $e->getMessage());
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
