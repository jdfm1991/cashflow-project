<?php
declare(strict_types=1);

/**
 * Excepción de Recurso No Encontrado
 * 
 * Excepción especializada para manejar recursos que no existen en la base de datos
 * o en el sistema. Extiende ApiException con funcionalidades específicas para
 * recursos no encontrados.
 * 
 * @package App\Exceptions
 */

namespace App\Exceptions;

use Throwable;

class NotFoundException extends ApiException
{
    /**
     * Tipo de recurso no encontrado
     * @var string
     */
    protected string $resourceType;
    
    /**
     * Identificador del recurso
     * @var mixed
     */
    protected $identifier;
    
    /**
     * Constructor
     * 
     * @param string $resourceType Tipo de recurso (ej: 'Usuario', 'Cuenta')
     * @param mixed $identifier Identificador del recurso
     * @param string $message Mensaje personalizado
     * @param array $context Contexto adicional
     * @param Throwable|null $previous Excepción anterior
     */
    public function __construct(
        string $resourceType,
        $identifier = null,
        string $message = '',
        array $context = [],
        ?Throwable $previous = null
    ) {
        $this->resourceType = $resourceType;
        $this->identifier = $identifier;
        
        if (empty($message)) {
            $message = "{$resourceType} no encontrado";
            if ($identifier) {
                $message .= ": {$identifier}";
            }
        }
        
        $details = [
            'resource_type' => $resourceType,
            'identifier' => $identifier
        ];
        
        parent::__construct($message, 404, $details, 'NOT_FOUND', $context, $previous);
    }
    
    /**
     * Obtener tipo de recurso
     * 
     * @return string
     */
    public function getResourceType(): string
    {
        return $this->resourceType;
    }
    
    /**
     * Obtener identificador del recurso
     * 
     * @return mixed
     */
    public function getIdentifier()
    {
        return $this->identifier;
    }
    
    /**
     * Crear excepción para usuario no encontrado
     * 
     * @param mixed $identifier Identificador (ID, email, etc.)
     * @return self
     */
    public static function user($identifier = null): self
    {
        return new self('Usuario', $identifier);
    }
    
    /**
     * Crear excepción para cuenta no encontrada
     * 
     * @param mixed $identifier Identificador
     * @return self
     */
    public static function account($identifier = null): self
    {
        return new self('Cuenta', $identifier);
    }
    
    /**
     * Crear excepción para transacción no encontrada
     * 
     * @param mixed $identifier Identificador
     * @param string $type Tipo de transacción (income/expense)
     * @return self
     */
    public static function transaction($identifier = null, string $type = 'transacción'): self
    {
        $resourceType = $type === 'income' ? 'Ingreso' : ($type === 'expense' ? 'Egreso' : 'Transacción');
        return new self($resourceType, $identifier);
    }
    
    /**
     * Crear excepción para categoría no encontrada
     * 
     * @param mixed $identifier Identificador
     * @return self
     */
    public static function category($identifier = null): self
    {
        return new self('Categoría', $identifier);
    }
    
    /**
     * Crear excepción para reporte no encontrado
     * 
     * @param mixed $identifier Identificador
     * @return self
     */
    public static function report($identifier = null): self
    {
        return new self('Reporte', $identifier);
    }
    
    /**
     * Crear excepción para archivo no encontrado
     * 
     * @param string $filePath Ruta del archivo
     * @return self
     */
    public static function file(string $filePath): self
    {
        return new self('Archivo', $filePath, "Archivo no encontrado: {$filePath}");
    }
    
    /**
     * Crear excepción para endpoint no encontrado
     * 
     * @param string $endpoint Endpoint solicitado
     * @param string $method Método HTTP
     * @return self
     */
    public static function endpoint(string $endpoint, string $method = 'GET'): self
    {
        return new self('Endpoint', "{$method} {$endpoint}", "Endpoint no encontrado: {$method} {$endpoint}");
    }
    
    /**
     * Crear excepción para sesión no encontrada
     * 
     * @param mixed $identifier Identificador
     * @return self
     */
    public static function session($identifier = null): self
    {
        return new self('Sesión', $identifier);
    }
    
    /**
     * Crear excepción para token no encontrado o inválido
     * 
     * @param string $tokenType Tipo de token (refresh, reset, etc.)
     * @return self
     */
    public static function token(string $tokenType = 'token'): self
    {
        return new self($tokenType, null, "{$tokenType} no encontrado o inválido");
    }
    
    /**
     * Verificar si el recurso no encontrado es de un tipo específico
     * 
     * @param string $resourceType
     * @return bool
     */
    public function isResourceType(string $resourceType): bool
    {
        return strcasecmp($this->resourceType, $resourceType) === 0;
    }
    
    /**
     * Obtener representación en array
     * 
     * @param bool $includeDebug
     * @return array
     */
    public function toArray(bool $includeDebug = false): array
    {
        $array = parent::toArray($includeDebug);
        
        $array['error']['resource'] = [
            'type' => $this->resourceType,
            'identifier' => $this->identifier
        ];
        
        return $array;
    }
}