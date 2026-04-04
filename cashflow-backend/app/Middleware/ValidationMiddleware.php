<?php
declare(strict_types=1);

/**
 * Middleware de Validación
 * 
 * Valida los datos de entrada antes de que lleguen al controlador.
 * Soporta validación de JSON, headers, y parámetros de consulta.
 * 
 * @package App\Middleware
 */

namespace App\Middleware;

use App\Helpers\Response;
use App\Services\ValidationService;

class ValidationMiddleware
{
    /**
     * Reglas de validación para diferentes endpoints
     * @var array
     */
    private array $rules;
    
    /**
     * Constructor
     * 
     * @param array $rules Reglas de validación específicas
     */
    public function __construct(array $rules = [])
    {
        $this->rules = $rules;
    }
    
    /**
     * Manejar la petición
     * 
     * @return bool
     */
    public function handle(): bool
    {
        // Obtener datos según el método HTTP
        $data = $this->getRequestData();
        
        // Aplicar reglas de validación
        $errors = $this->validate($data);
        
        if (!empty($errors)) {
            Response::validationError($errors);
            return false;
        }
        
        // Sanitizar datos antes de pasar al controlador
        $this->sanitizeData($data);
        
        return true;
    }
    
    /**
     * Establecer reglas de validación
     * 
     * @param array $rules
     * @return self
     */
    public function setRules(array $rules): self
    {
        $this->rules = $rules;
        return $this;
    }
    
    /**
     * Validar datos contra reglas
     * 
     * @param array $data
     * @return array
     */
    private function validate(array $data): array
    {
        $validator = new ValidationService($data);
        
        foreach ($this->rules as $field => $rules) {
            foreach ($rules as $rule) {
                $this->applyRule($validator, $field, $rule);
            }
        }
        
        return $validator->getFormattedErrors();
    }
    
    /**
     * Aplicar una regla de validación específica
     * 
     * @param ValidationService $validator
     * @param string $field
     * @param string|array $rule
     */
    private function applyRule(ValidationService $validator, string $field, $rule): void
    {
        if (is_string($rule)) {
            $this->applyStringRule($validator, $field, $rule);
        } elseif (is_array($rule)) {
            $this->applyArrayRule($validator, $field, $rule);
        }
    }
    
    /**
     * Aplicar regla en formato string
     * 
     * @param ValidationService $validator
     * @param string $field
     * @param string $rule
     */
    private function applyStringRule(ValidationService $validator, string $field, string $rule): void
    {
        $parts = explode(':', $rule);
        $ruleName = $parts[0];
        $params = array_slice($parts, 1);
        
        switch ($ruleName) {
            case 'required':
                $validator->required($field);
                break;
            case 'email':
                $validator->email($field);
                break;
            case 'numeric':
                $validator->numeric($field);
                break;
            case 'integer':
                $validator->integer($field);
                break;
            case 'date':
                $format = $params[0] ?? 'Y-m-d';
                $validator->date($field, $format);
                break;
            case 'min':
                $validator->min($field, (float) ($params[0] ?? 0));
                break;
            case 'max':
                $validator->max($field, (float) ($params[0] ?? PHP_FLOAT_MAX));
                break;
            case 'min_length':
                $validator->minLength($field, (int) ($params[0] ?? 0));
                break;
            case 'max_length':
                $validator->maxLength($field, (int) ($params[0] ?? 255));
                break;
            case 'between':
                $min = (float) ($params[0] ?? 0);
                $max = (float) ($params[1] ?? PHP_FLOAT_MAX);
                $validator->between($field, $min, $max);
                break;
            case 'in':
                $allowed = explode(',', $params[0] ?? '');
                $validator->in($field, $allowed);
                break;
            case 'boolean':
                $validator->boolean($field);
                break;
            case 'url':
                $validator->url($field);
                break;
            case 'phone':
                $validator->phone($field);
                break;
            case 'array':
                $validator->array($field);
                break;
            case 'json':
                $validator->json($field);
                break;
            case 'confirmed':
                $validator->confirmed($field);
                break;
        }
    }
    
    /**
     * Aplicar regla en formato array
     * 
     * @param ValidationService $validator
     * @param string $field
     * @param array $rule
     */
    private function applyArrayRule(ValidationService $validator, string $field, array $rule): void
    {
        $ruleName = $rule[0] ?? null;
        $params = array_slice($rule, 1);
        
        switch ($ruleName) {
            case 'required':
                $validator->required($field);
                break;
            case 'email':
                $validator->email($field, $params[0] ?? null);
                break;
            case 'numeric':
                $validator->numeric($field, $params[0] ?? null);
                break;
            case 'integer':
                $validator->integer($field, $params[0] ?? null);
                break;
            case 'date':
                $format = $params[0] ?? 'Y-m-d';
                $validator->date($field, $format, $params[1] ?? null);
                break;
            case 'min':
                $validator->min($field, (float) ($params[0] ?? 0), $params[1] ?? null);
                break;
            case 'max':
                $validator->max($field, (float) ($params[0] ?? PHP_FLOAT_MAX), $params[1] ?? null);
                break;
            case 'min_length':
                $validator->minLength($field, (int) ($params[0] ?? 0), $params[1] ?? null);
                break;
            case 'max_length':
                $validator->maxLength($field, (int) ($params[0] ?? 255), $params[1] ?? null);
                break;
            case 'between':
                $min = (float) ($params[0] ?? 0);
                $max = (float) ($params[1] ?? PHP_FLOAT_MAX);
                $validator->between($field, $min, $max, $params[2] ?? null);
                break;
            case 'in':
                $allowed = is_array($params[0]) ? $params[0] : explode(',', (string) ($params[0] ?? ''));
                $validator->in($field, $allowed, $params[1] ?? null);
                break;
            case 'unique':
                $table = $params[0] ?? null;
                $column = $params[1] ?? $field;
                $excludeId = $params[2] ?? null;
                if ($table) {
                    $validator->unique($field, $table, $column, $excludeId, $params[3] ?? null);
                }
                break;
            case 'custom':
                if (isset($params[0]) && is_callable($params[0])) {
                    $validator->custom($field, $params[0], $params[1] ?? null);
                }
                break;
        }
    }
    
    /**
     * Obtener datos de la petición según el método
     * 
     * @return array
     */
    private function getRequestData(): array
    {
        $method = $_SERVER['REQUEST_METHOD'];
        
        switch ($method) {
            case 'GET':
                return $_GET;
            case 'POST':
            case 'PUT':
            case 'PATCH':
            case 'DELETE':
                $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
                
                if (strpos($contentType, 'application/json') !== false) {
                    $data = json_decode(file_get_contents('php://input'), true);
                    return is_array($data) ? $data : [];
                }
                
                if (strpos($contentType, 'multipart/form-data') !== false) {
                    return array_merge($_POST, $_FILES);
                }
                
                return $_POST;
            default:
                return [];
        }
    }
    
    /**
     * Sanitizar datos
     * 
     * @param array &$data
     */
    private function sanitizeData(array &$data): void
    {
        foreach ($data as $key => $value) {
            if (is_string($value)) {
                // Eliminar espacios al inicio y final
                $data[$key] = trim($value);
                
                // Prevenir XSS
                $data[$key] = htmlspecialchars($data[$key], ENT_QUOTES, 'UTF-8');
                
                // Eliminar caracteres nulos
                $data[$key] = str_replace("\0", '', $data[$key]);
            } elseif (is_array($value)) {
                $this->sanitizeData($data[$key]);
            }
        }
        
        // Guardar datos sanitizados para uso posterior
        $_REQUEST = array_merge($_REQUEST, $data);
    }
    
    /**
     * Validar token CSRF
     * 
     * @return bool
     */
    public function validateCsrf(): bool
    {
        // Solo validar para métodos que modifican datos
        $methods = ['POST', 'PUT', 'PATCH', 'DELETE'];
        
        if (!in_array($_SERVER['REQUEST_METHOD'], $methods)) {
            return true;
        }
        
        $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? $_POST['csrf_token'] ?? null;
        
        if (!$token) {
            Response::error('Token CSRF no proporcionado', 403);
            return false;
        }
        
        if (!$this->verifyCsrfToken($token)) {
            Response::error('Token CSRF inválido', 403);
            return false;
        }
        
        return true;
    }
    
    /**
     * Verificar token CSRF
     * 
     * @param string $token
     * @return bool
     */
    private function verifyCsrfToken(string $token): bool
    {
        // Verificar token en sesión
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        $storedToken = $_SESSION['csrf_token'] ?? null;
        
        if (!$storedToken) {
            return false;
        }
        
        return hash_equals($storedToken, $token);
    }
    
    /**
     * Validar límite de tasa (Rate Limiting)
     * 
     * @param string $key
     * @param int $limit
     * @param int $window
     * @return bool
     */
    public function rateLimit(string $key, int $limit = 60, int $window = 60): bool
    {
        // Implementación simple usando archivos temporales
        $ip = $_SERVER['REMOTE_ADDR'];
        $identifier = md5($key . $ip);
        $file = sys_get_temp_dir() . '/rate_limit_' . $identifier;
        
        $current = time();
        $data = [];
        
        if (file_exists($file)) {
            $data = json_decode(file_get_contents($file), true) ?: [];
        }
        
        // Limpiar solicitudes antiguas
        $data = array_filter($data, function($timestamp) use ($current, $window) {
            return $timestamp > ($current - $window);
        });
        
        if (count($data) >= $limit) {
            Response::error('Demasiadas peticiones. Por favor espere.', 429);
            return false;
        }
        
        $data[] = $current;
        file_put_contents($file, json_encode($data));
        
        return true;
    }
}