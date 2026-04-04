<?php
declare(strict_types=1);

/**
 * Excepción Base de la API
 * 
 * Excepción personalizada para manejar errores de la API de forma consistente.
 * Proporciona información adicional como código HTTP, detalles de error,
 * y contexto para ayudar en el debugging.
 * 
 * @package App\Exceptions
 */

namespace App\Exceptions;

use Exception;
use Throwable;

class ApiException extends Exception
{
    /**
     * Código HTTP de la respuesta
     * @var int
     */
    protected int $statusCode;
    
    /**
     * Detalles adicionales del error
     * @var array|null
     */
    protected ?array $details;
    
    /**
     * Código interno del error (para referencia)
     * @var string|null
     */
    protected ?string $errorCode;
    
    /**
     * Contexto adicional para debugging
     * @var array
     */
    protected array $context;
    
    /**
     * Constructor
     * 
     * @param string $message Mensaje de error
     * @param int $statusCode Código HTTP
     * @param array|null $details Detalles adicionales
     * @param string|null $errorCode Código interno de error
     * @param array $context Contexto para debugging
     * @param Throwable|null $previous Excepción anterior
     */
    public function __construct(
        string $message = '',
        int $statusCode = 500,
        ?array $details = null,
        ?string $errorCode = null,
        array $context = [],
        ?Throwable $previous = null
    ) {
        parent::__construct($message, $statusCode, $previous);
        
        $this->statusCode = $statusCode;
        $this->details = $details;
        $this->errorCode = $errorCode ?? $this->generateErrorCode();
        $this->context = $context;
    }
    
    /**
     * Obtener código HTTP
     * 
     * @return int
     */
    public function getStatusCode(): int
    {
        return $this->statusCode;
    }
    
    /**
     * Obtener detalles del error
     * 
     * @return array|null
     */
    public function getDetails(): ?array
    {
        return $this->details;
    }
    
    /**
     * Obtener código interno de error
     * 
     * @return string|null
     */
    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }
    
    /**
     * Obtener contexto
     * 
     * @return array
     */
    public function getContext(): array
    {
        return $this->context;
    }
    
    /**
     * Convertir excepción a array para respuesta JSON
     * 
     * @param bool $includeDebug Incluir información de depuración
     * @return array
     */
    public function toArray(bool $includeDebug = false): array
    {
        $response = [
            'success' => false,
            'error' => [
                'code' => $this->errorCode,
                'message' => $this->getMessage(),
                'status_code' => $this->statusCode
            ]
        ];
        
        if ($this->details) {
            $response['error']['details'] = $this->details;
        }
        
        if ($includeDebug && defined('APP_DEBUG') && APP_DEBUG) {
            $response['debug'] = [
                'file' => $this->getFile(),
                'line' => $this->getLine(),
                'trace' => $this->getTrace(),
                'context' => $this->context
            ];
            
            if ($this->getPrevious()) {
                $response['debug']['previous'] = [
                    'message' => $this->getPrevious()->getMessage(),
                    'file' => $this->getPrevious()->getFile(),
                    'line' => $this->getPrevious()->getLine()
                ];
            }
        }
        
        return $response;
    }
    
    /**
     * Generar código de error único
     * 
     * @return string
     */
    protected function generateErrorCode(): string
    {
        $class = (new \ReflectionClass($this))->getShortName();
        $timestamp = dechex(time());
        $random = substr(md5(uniqid()), 0, 4);
        
        return strtoupper("{$class}_{$timestamp}_{$random}");
    }
    
    /**
     * Crear excepción de validación
     * 
     * @param array $errors Errores de validación
     * @param string $message Mensaje personalizado
     * @return self
     */
    public static function validation(array $errors, string $message = 'Error de validación'): self
    {
        return new self($message, 422, $errors, 'VALIDATION_ERROR');
    }
    
    /**
     * Crear excepción de recurso no encontrado
     * 
     * @param string $resource Recurso no encontrado
     * @param mixed $identifier Identificador
     * @return self
     */
    public static function notFound(string $resource, $identifier = null): self
    {
        $message = "{$resource} no encontrado";
        if ($identifier) {
            $message .= ": {$identifier}";
        }
        
        return new self($message, 404, ['resource' => $resource, 'identifier' => $identifier], 'RESOURCE_NOT_FOUND');
    }
    
    /**
     * Crear excepción de no autorizado
     * 
     * @param string $message Mensaje personalizado
     * @return self
     */
    public static function unauthorized(string $message = 'No autorizado'): self
    {
        return new self($message, 401, null, 'UNAUTHORIZED');
    }
    
    /**
     * Crear excepción de prohibido
     * 
     * @param string $message Mensaje personalizado
     * @return self
     */
    public static function forbidden(string $message = 'Acceso prohibido'): self
    {
        return new self($message, 403, null, 'FORBIDDEN');
    }
    
    /**
     * Crear excepción de conflicto
     * 
     * @param string $message Mensaje personalizado
     * @param array $details Detalles del conflicto
     * @return self
     */
    public static function conflict(string $message, array $details = []): self
    {
        return new self($message, 409, $details, 'CONFLICT');
    }
    
    /**
     * Crear excepción de error interno
     * 
     * @param string $message Mensaje personalizado
     * @param Throwable|null $previous Excepción anterior
     * @return self
     */
    public static function internal(string $message = 'Error interno del servidor', ?Throwable $previous = null): self
    {
        return new self($message, 500, null, 'INTERNAL_ERROR', [], $previous);
    }
    
    /**
     * Crear excepción de método no permitido
     * 
     * @param string $method Método no permitido
     * @param array $allowedMethods Métodos permitidos
     * @return self
     */
    public static function methodNotAllowed(string $method, array $allowedMethods = []): self
    {
        $message = "Método {$method} no permitido";
        $details = ['allowed_methods' => $allowedMethods];
        
        return new self($message, 405, $details, 'METHOD_NOT_ALLOWED');
    }
    
    /**
     * Crear excepción de solicitud incorrecta
     * 
     * @param string $message Mensaje personalizado
     * @param array $details Detalles del error
     * @return self
     */
    public static function badRequest(string $message = 'Solicitud incorrecta', array $details = []): self
    {
        return new self($message, 400, $details, 'BAD_REQUEST');
    }
    
    /**
     * Crear excepción de límite de peticiones excedido
     * 
     * @param int $limit Límite de peticiones
     * @param int $retryAfter Tiempo para reintentar en segundos
     * @return self
     */
    public static function rateLimitExceeded(int $limit, int $retryAfter = 60): self
    {
        $message = "Límite de peticiones excedido. Máximo {$limit} por minuto.";
        $details = [
            'limit' => $limit,
            'retry_after' => $retryAfter
        ];
        
        return new self($message, 429, $details, 'RATE_LIMIT_EXCEEDED');
    }
}