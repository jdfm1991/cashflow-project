<?php
declare(strict_types=1);

/**
 * Servicio de Validación
 * 
 * Proporciona métodos para validar diferentes tipos de datos
 * utilizados en el sistema de flujo de caja. Incluye validaciones
 * para fechas, montos, emails, documentos y reglas de negocio.
 * 
 * @package App\Services
 */

namespace App\Services;

use DateTime;
use DateTimeZone;

class ValidationService
{
    /**
     * Errores de validación acumulados
     * @var array
     */
    private array $errors = [];
    
    /**
     * Datos que se están validando
     * @var array
     */
    private array $data = [];
    
    /**
     * Constructor
     * 
     * @param array $data Datos a validar
     */
    public function __construct(array $data = [])
    {
        $this->data = $data;
        $this->errors = [];
    }
    
    /**
     * Establecer datos a validar
     * 
     * @param array $data
     * @return self
     */
    public function setData(array $data): self
    {
        $this->data = $data;
        $this->errors = [];
        return $this;
    }
    
    /**
     * Obtener todos los errores
     * 
     * @return array
     */
    public function getErrors(): array
    {
        return $this->errors;
    }
    
    /**
     * Verificar si hay errores
     * 
     * @return bool
     */
    public function hasErrors(): bool
    {
        return !empty($this->errors);
    }
    
    /**
     * Validar que un campo es requerido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function required(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
            $this->addError($field, $message ?? "El campo {$field} es requerido");
        }
        
        return $this;
    }
    
    /**
     * Validar múltiples campos requeridos
     * 
     * @param array $fields
     * @return self
     */
    public function requiredMultiple(array $fields): self
    {
        foreach ($fields as $field) {
            $this->required($field);
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un email válido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function email(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un email válido");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es numérico
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function numeric(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!is_numeric($value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser numérico");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un número entero
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function integer(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_INT)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un número entero");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un número decimal con ciertos decimales
     * 
     * @param string $field
     * @param int $decimals
     * @param string $message
     * @return self
     */
    public function decimal(string $field, int $decimals = 2, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!is_numeric($value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un número decimal");
            } else {
                $parts = explode('.', (string) $value);
                if (isset($parts[1]) && strlen($parts[1]) > $decimals) {
                    $this->addError($field, $message ?? "El campo {$field} no puede tener más de {$decimals} decimales");
                }
            }
        }
        
        return $this;
    }
    
    /**
     * Validar longitud mínima de un campo
     * 
     * @param string $field
     * @param int $min
     * @param string $message
     * @return self
     */
    public function minLength(string $field, int $min, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (strlen((string) $value) < $min) {
                $this->addError($field, $message ?? "El campo {$field} debe tener al menos {$min} caracteres");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar longitud máxima de un campo
     * 
     * @param string $field
     * @param int $max
     * @param string $message
     * @return self
     */
    public function maxLength(string $field, int $max, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (strlen((string) $value) > $max) {
                $this->addError($field, $message ?? "El campo {$field} no puede exceder los {$max} caracteres");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar rango de longitud
     * 
     * @param string $field
     * @param int $min
     * @param int $max
     * @param string $message
     * @return self
     */
    public function lengthBetween(string $field, int $min, int $max, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $length = strlen((string) $value);
            if ($length < $min || $length > $max) {
                $this->addError($field, $message ?? "El campo {$field} debe tener entre {$min} y {$max} caracteres");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar valor mínimo numérico
     * 
     * @param string $field
     * @param float $min
     * @param string $message
     * @return self
     */
    public function min(string $field, float $min, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '' && is_numeric($value)) {
            if ((float) $value < $min) {
                $this->addError($field, $message ?? "El campo {$field} debe ser mayor o igual a {$min}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar valor máximo numérico
     * 
     * @param string $field
     * @param float $max
     * @param string $message
     * @return self
     */
    public function max(string $field, float $max, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '' && is_numeric($value)) {
            if ((float) $value > $max) {
                $this->addError($field, $message ?? "El campo {$field} debe ser menor o igual a {$max}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar rango numérico
     * 
     * @param string $field
     * @param float $min
     * @param float $max
     * @param string $message
     * @return self
     */
    public function between(string $field, float $min, float $max, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '' && is_numeric($value)) {
            $floatValue = (float) $value;
            if ($floatValue < $min || $floatValue > $max) {
                $this->addError($field, $message ?? "El campo {$field} debe estar entre {$min} y {$max}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es una fecha válida
     * 
     * @param string $field
     * @param string $format
     * @param string $message
     * @return self
     */
    public function date(string $field, string $format = 'Y-m-d', string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $date = DateTime::createFromFormat($format, (string) $value);
            if (!$date || $date->format($format) !== (string) $value) {
                $this->addError($field, $message ?? "El campo {$field} debe ser una fecha válida en formato {$format}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que una fecha no sea futura
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function notFutureDate(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $date = DateTime::createFromFormat('Y-m-d', (string) $value);
            if ($date && $date > new DateTime()) {
                $this->addError($field, $message ?? "El campo {$field} no puede ser una fecha futura");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que una fecha no sea pasada
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function notPastDate(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $date = DateTime::createFromFormat('Y-m-d', (string) $value);
            if ($date && $date < new DateTime()) {
                $this->addError($field, $message ?? "El campo {$field} no puede ser una fecha pasada");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que una fecha esté dentro de un rango
     * 
     * @param string $field
     * @param string $startDate
     * @param string $endDate
     * @param string $message
     * @return self
     */
    public function dateBetween(string $field, string $startDate, string $endDate, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $date = DateTime::createFromFormat('Y-m-d', (string) $value);
            $start = DateTime::createFromFormat('Y-m-d', $startDate);
            $end = DateTime::createFromFormat('Y-m-d', $endDate);
            
            if ($date && ($date < $start || $date > $end)) {
                $this->addError($field, $message ?? "El campo {$field} debe estar entre {$startDate} y {$endDate}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un teléfono válido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function phone(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $pattern = '/^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/';
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un teléfono válido");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un URL válido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function url(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_URL)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser una URL válida");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un número de identificación válido
     * 
     * @param string $field
     * @param string $type
     * @param string $message
     * @return self
     */
    public function identification(string $field, string $type = 'cedula', string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $value = preg_replace('/[^0-9]/', '', (string) $value);
            
            if ($type === 'cedula') {
                if (!$this->validateCedula($value)) {
                    $this->addError($field, $message ?? "El campo {$field} debe ser una cédula válida");
                }
            } elseif ($type === 'nit') {
                if (!$this->validateNIT($value)) {
                    $this->addError($field, $message ?? "El campo {$field} debe ser un NIT válido");
                }
            }
        }
        
        return $this;
    }
    
    /**
     * Validar cédula (Venezuela)
     * 
     * @param string $cedula
     * @return bool
     */
    private function validateCedula(string $cedula): bool
    {
        // Algoritmo de validación de cédula venezolana
        if (strlen($cedula) < 6 || strlen($cedula) > 8) {
            return false;
        }
        
        // Verificar que solo contenga números
        if (!ctype_digit($cedula)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validar NIT (Colombia/Venezuela)
     * 
     * @param string $nit
     * @return bool
     */
    private function validateNIT(string $nit): bool
    {
        // Longitud básica
        if (strlen($nit) < 6 || strlen($nit) > 10) {
            return false;
        }
        
        // Verificar que solo contenga números
        if (!ctype_digit($nit)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Validar que un campo es un monto de dinero válido
     * 
     * @param string $field
     * @param float $min
     * @param float $max
     * @param string $message
     * @return self
     */
    public function amount(string $field, float $min = 0.01, float $max = 999999999.99, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!is_numeric($value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un monto válido");
            } else {
                $amount = (float) $value;
                if ($amount < $min) {
                    $this->addError($field, $message ?? "El monto mínimo es {$min}");
                }
                if ($amount > $max) {
                    $this->addError($field, $message ?? "El monto máximo es {$max}");
                }
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un código válido (alfanumérico con guiones)
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function code(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $pattern = '/^[A-Za-z0-9\-_]+$/';
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un código válido (solo letras, números, guiones)");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un UUID válido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function uuid(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $pattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un UUID válido");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un color hexadecimal
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function hexColor(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $pattern = '/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/';
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un color hexadecimal válido (ej: #FF0000)");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo está en una lista de valores permitidos
     * 
     * @param string $field
     * @param array $allowedValues
     * @param string $message
     * @return self
     */
    public function in(string $field, array $allowedValues, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!in_array($value, $allowedValues, true)) {
                $allowedList = implode(', ', $allowedValues);
                $this->addError($field, $message ?? "El campo {$field} debe ser uno de: {$allowedList}");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es único en una tabla
     * 
     * @param string $field
     * @param string $table
     * @param string $column
     * @param int|null $excludeId
     * @param string $message
     * @return self
     */
    public function unique(string $field, string $table, string $column, ?int $excludeId = null, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $db = \App\Config\Database::getInstance()->getConnection();
            
            $sql = "SELECT COUNT(*) as count FROM {$table} WHERE {$column} = :value";
            $params = ['value' => $value];
            
            if ($excludeId !== null) {
                $sql .= " AND id != :id";
                $params['id'] = $excludeId;
            }
            
            $stmt = $db->prepare($sql);
            $stmt->execute($params);
            $result = $stmt->fetch();
            
            if (($result['count'] ?? 0) > 0) {
                $this->addError($field, $message ?? "El valor del campo {$field} ya está registrado");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que dos campos coinciden
     * 
     * @param string $field
     * @param string $confirmField
     * @param string $message
     * @return self
     */
    public function confirmed(string $field, string $confirmField = null, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        $confirmValue = $this->getFieldValue($confirmField ?? $field . '_confirmation');
        
        if ($value !== null && $confirmValue !== null) {
            if ($value !== $confirmValue) {
                $this->addError($field, $message ?? "Los campos {$field} y {$confirmField} no coinciden");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un booleano
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function boolean(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            $valid = in_array($value, [true, false, 1, 0, '1', '0', 'true', 'false', 'yes', 'no'], true);
            if (!$valid) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un valor booleano");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un array
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function array(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!is_array($value)) {
                $this->addError($field, $message ?? "El campo {$field} debe ser un array");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar que un campo es un objeto JSON válido
     * 
     * @param string $field
     * @param string $message
     * @return self
     */
    public function json(string $field, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (is_string($value)) {
                json_decode($value);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->addError($field, $message ?? "El campo {$field} debe ser un JSON válido");
                }
            }
        }
        
        return $this;
    }
    
    /**
     * Validar expresión regular
     * 
     * @param string $field
     * @param string $pattern
     * @param string $message
     * @return self
     */
    public function regex(string $field, string $pattern, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, $message ?? "El campo {$field} no tiene el formato correcto");
            }
        }
        
        return $this;
    }
    
    /**
     * Validar regla de negocio personalizada
     * 
     * @param string $field
     * @param callable $callback
     * @param string $message
     * @return self
     */
    public function custom(string $field, callable $callback, string $message = null): self
    {
        $value = $this->getFieldValue($field);
        
        if ($value !== null && $value !== '') {
            if (!$callback($value, $this->data)) {
                $this->addError($field, $message ?? "El campo {$field} no cumple con la validación personalizada");
            }
        }
        
        return $this;
    }
    
    /**
     * Obtener el valor de un campo
     * 
     * @param string $field
     * @return mixed
     */
    private function getFieldValue(string $field): mixed
    {
        return $this->data[$field] ?? null;
    }
    
    /**
     * Agregar un error
     * 
     * @param string $field
     * @param string $message
     */
    private function addError(string $field, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }
    
    /**
     * Validar todos los campos y retornar resultado
     * 
     * @return bool
     */
    public function validate(): bool
    {
        return !$this->hasErrors();
    }
    
    /**
     * Obtener primer error de un campo
     * 
     * @param string $field
     * @return string|null
     */
    public function getFirstError(string $field): ?string
    {
        return $this->errors[$field][0] ?? null;
    }
    
    /**
     * Obtener todos los errores formateados para respuesta JSON
     * 
     * @return array
     */
    public function getFormattedErrors(): array
    {
        $formatted = [];
        foreach ($this->errors as $field => $messages) {
            $formatted[$field] = implode(', ', $messages);
        }
        return $formatted;
    }
}