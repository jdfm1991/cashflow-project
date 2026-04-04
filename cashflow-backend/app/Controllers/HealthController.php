<?php
namespace App\Controllers;

use App\Helpers\Response;

class HealthController
{
    /**
     * Verificar estado de la API
     */
    public function check()
    {
        $status = [
            'status' => 'healthy',
            'timestamp' => date('Y-m-d H:i:s'),
            'environment' => APP_ENV,
            'php_version' => PHP_VERSION,
            'database' => $this->checkDatabase()
        ];
        
        Response::success($status, 'API funcionando correctamente');
    }
    
    /**
     * Obtener versión de la API
     */
    public function version()
    {
        Response::success([
            'version' => '1.0.0',
            'name' => APP_NAME,
            'api_version' => 'v1'
        ]);
    }
    
    /**
     * Verificar conexión a base de datos
     */
    private function checkDatabase()
    {
        try {
            $db = \App\Config\Database::getInstance();
            $db->getConnection();
            return ['status' => 'connected', 'message' => 'Conexión exitosa'];
        } catch (\Exception $e) {
            return ['status' => 'error', 'message' => $e->getMessage()];
        }
    }
}