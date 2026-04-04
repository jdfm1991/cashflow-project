<?php
// app/Helpers/Response.php
declare(strict_types=1);

namespace App\Helpers;

class Response
{
    /**
     * Enviar respuesta exitosa (200)
     */
    public static function success($data = null, string $message = 'Success', int $code = 200): void
    {
        http_response_code($code);
        
        $response = [
            'success' => true,
            'message' => $message,
            'data' => $data,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        if (defined('APP_DEBUG') && APP_DEBUG) {
            $response['debug'] = [
                'memory' => memory_get_usage(),
                'time' => microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']
            ];
        }
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit();
    }
    
    /**
     * Enviar respuesta de error (400 por defecto)
     */
    public static function error(string $message = 'Error', int $code = 400, $details = null): void
    {
        http_response_code($code);
        
        $response = [
            'success' => false,
            'message' => $message,
            'code' => $code,
            'timestamp' => date('Y-m-d H:i:s')
        ];
        
        if ($details !== null) {
            $response['details'] = $details;
        }
        
        if (defined('APP_DEBUG') && APP_DEBUG) {
            $trace = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 2);
            $response['debug'] = [
                'file' => $trace[0]['file'] ?? null,
                'line' => $trace[0]['line'] ?? null
            ];
        }
        
        echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit();
    }
    
    /**
     * Enviar respuesta de error de validación (422)
     */
    public static function validationError(array $errors, string $message = 'Error de validación'): void
    {
        self::error($message, 422, $errors);
    }
    
    /**
     * Enviar respuesta de no autorizado (401)
     */
    public static function unauthorized(string $message = 'No autorizado'): void
    {
        self::error($message, 401);
    }
    
    /**
     * Enviar respuesta de prohibido (403)
     */
    public static function forbidden(string $message = 'Acceso prohibido'): void
    {
        self::error($message, 403);
    }
    
    /**
     * Enviar respuesta de no encontrado (404)
     */
    public static function notFound(string $message = 'Recurso no encontrado'): void
    {
        self::error($message, 404);
    }
    
    /**
     * Enviar respuesta de conflicto (409) - PARA DATOS DUPLICADOS
     */
    public static function conflict(string $message = 'Conflicto con el estado actual del recurso', $details = null): void
    {
        self::error($message, 409, $details);
    }
    
    /**
     * Enviar respuesta de método no permitido (405)
     */
    public static function methodNotAllowed(string $message = 'Método no permitido', array $allowedMethods = []): void
    {
        if (!empty($allowedMethods)) {
            header('Allow: ' . implode(', ', $allowedMethods));
        }
        self::error($message, 405);
    }
    
    /**
     * Enviar respuesta de error interno del servidor (500)
     */
    public static function internalError(string $message = 'Error interno del servidor', ?\Throwable $exception = null): void
    {
        $errors = null;
        
        if (defined('APP_DEBUG') && APP_DEBUG && $exception) {
            $errors = [
                'exception' => get_class($exception),
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine()
            ];
        }
        
        self::error($message, 500, $errors);
    }
    
    /**
     * Enviar respuesta de creado exitosamente (201)
     */
    public static function created($data = null, string $message = 'Recurso creado exitosamente'): void
    {
        self::success($data, $message, 201);
    }
    
    /**
     * Enviar respuesta sin contenido (204)
     */
    public static function noContent(): void
    {
        http_response_code(204);
        header('Content-Length: 0');
        exit();
    }
}