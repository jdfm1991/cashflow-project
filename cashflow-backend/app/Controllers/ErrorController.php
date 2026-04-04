<?php
/**
 * Controlador de errores
 * 
 * Maneja las respuestas de error de la aplicación, incluyendo rutas no encontradas,
 * errores internos, y otros códigos de error HTTP.
 */

namespace App\Controllers;

use App\Helpers\Response;

class ErrorController
{
    /**
     * Manejar rutas no encontradas (404)
     * 
     * Este método se ejecuta cuando ninguna ruta coincide con la URL solicitada
     */
    public function notFound()
    {
        Response::notFound('La ruta solicitada no existe');
    }
    
    /**
     * Manejar errores internos del servidor (500)
     * 
     * @param string $message Mensaje de error
     * @param \Exception|null $exception Excepción opcional
     */
    public function internalError($message = 'Error interno del servidor', $exception = null)
    {
        // Verificar si estamos en modo debug de manera segura
        $isDebug = $this->isDebugMode();
        
        if ($isDebug && $exception) {
            // En desarrollo: mostrar detalles del error
            $errorDetails = [
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
                'trace' => $exception->getTraceAsString()
            ];
            
            Response::error($message . ': ' . $exception->getMessage(), 500, $errorDetails);
        } else {
            // En producción: mensaje genérico
            Response::error($message, 500);
        }
    }
    
    /**
     * Manejar método no permitido (405)
     * 
     * @param string $method Método HTTP no permitido
     */
    public function methodNotAllowed($method = null)
    {
        $message = $method 
            ? "Método {$method} no permitido para esta ruta"
            : "Método no permitido";
        
        Response::error($message, 405);
    }
    
    /**
     * Manejar errores de validación (422)
     * 
     * @param array $errors Errores de validación
     */
    public function validationError(array $errors)
    {
        Response::validationError($errors);
    }
    
    /**
     * Manejar errores de autenticación (401)
     * 
     * @param string $message Mensaje de error
     */
    public function unauthorized($message = 'No autorizado')
    {
        Response::unauthorized($message);
    }
    
    /**
     * Manejar errores de prohibición (403)
     * 
     * @param string $message Mensaje de error
     */
    public function forbidden($message = 'Acceso prohibido')
    {
        Response::forbidden($message);
    }
    
    /**
     * Determinar si estamos en modo debug de manera segura
     * 
     * @return bool
     */
    private function isDebugMode(): bool
    {
        // Verificar si la constante está definida
        if (defined('APP_DEBUG')) {
            return APP_DEBUG;
        }
        
        // Verificar variable de entorno como fallback
        $envDebug = getenv('APP_DEBUG');
        if ($envDebug !== false) {
            return filter_var($envDebug, FILTER_VALIDATE_BOOLEAN);
        }
        
        // Verificar $_ENV como fallback
        if (isset($_ENV['APP_DEBUG'])) {
            return filter_var($_ENV['APP_DEBUG'], FILTER_VALIDATE_BOOLEAN);
        }
        
        // Por defecto, asumir false en producción
        return false;
    }
}