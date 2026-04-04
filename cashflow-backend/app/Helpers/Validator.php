<?php

declare(strict_types=1);

/**
 * Clase Helper de Validación
 * 
 * Proporciona métodos para validar datos de entrada de forma fluida y encadenable.
 * Similar a los validadores de frameworks como Laravel o Symfony.
 * 
 * @package App\Helpers
 */

namespace App\Helpers;

class Validator
{
    /**
     * Datos a validar
     * @var array
     */
    private array $data;

    /**
     * Errores de validación
     * @var array
     */
    private array $errors = [];

    /**
     * Reglas de validación
     * @var array
     */
    private array $rules = [];

    /**
     * Constructor
     * 
     * @param array $data Datos a validar
     */
    public function __construct(array $data = [])
    {
        $this->data = $data;
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
     * Validar que un campo es requerido
     * 
     * @param string $field
     * @return self
     */
    public function required(string $field): self
    {
        $this->rules[$field][] = 'required';
        $value = $this->getValue($field);

        if ($value === null || $value === '' || (is_array($value) && empty($value))) {
            $this->addError($field, 'required', 'El campo es requerido');
        }

        return $this;
    }

    /**
     * Validar que un campo es opcional (no agrega regla, solo permite continuar)
     * 
     * @param string $field
     * @return self
     */
    public function optional(string $field): self
    {
        $this->rules[$field][] = 'optional';
        return $this;
    }

    /**
     * Validar que el campo es un string
     * 
     * @param string $field
     * @return self
     */
    public function string(string $field): self
    {
        $this->rules[$field][] = 'string';
        $value = $this->getValue($field);

        if ($value !== null && !is_string($value)) {
            $this->addError($field, 'string', 'El campo debe ser texto');
        }

        return $this;
    }

    /**
     * Validar longitud mínima
     * 
     * @param string $field
     * @param int $min
     * @return self
     */
    public function minLength(string $field, int $min): self
    {
        $this->rules[$field][] = "min_length:{$min}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (strlen((string) $value) < $min) {
                $this->addError($field, 'min_length', "Debe tener al menos {$min} caracteres");
            }
        }

        return $this;
    }

    /**
     * Validar longitud máxima
     * 
     * @param string $field
     * @param int $max
     * @return self
     */
    public function maxLength(string $field, int $max): self
    {
        $this->rules[$field][] = "max_length:{$max}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (strlen((string) $value) > $max) {
                $this->addError($field, 'max_length', "No puede exceder los {$max} caracteres");
            }
        }

        return $this;
    }

    /**
     * Validar que es un email válido
     * 
     * @param string $field
     * @return self
     */
    public function email(string $field): self
    {
        $this->rules[$field][] = 'email';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $this->addError($field, 'email', 'Debe ser un email válido');
            }
        }

        return $this;
    }

    /**
     * Validar que es un número
     * 
     * @param string $field
     * @return self
     */
    public function numeric(string $field): self
    {
        $this->rules[$field][] = 'numeric';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!is_numeric($value)) {
                $this->addError($field, 'numeric', 'Debe ser un número');
            }
        }

        return $this;
    }

    /**
     * Validar valor mínimo numérico
     * 
     * @param string $field
     * @param float $min
     * @return self
     */
    public function min(string $field, float $min): self
    {
        $this->rules[$field][] = "min:{$min}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && is_numeric($value)) {
            if ((float) $value < $min) {
                $this->addError($field, 'min', "Debe ser mayor o igual a {$min}");
            }
        }

        return $this;
    }

    /**
     * Validar valor máximo numérico
     * 
     * @param string $field
     * @param float $max
     * @return self
     */
    public function max(string $field, float $max): self
    {
        $this->rules[$field][] = "max:{$max}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && is_numeric($value)) {
            if ((float) $value > $max) {
                $this->addError($field, 'max', "Debe ser menor o igual a {$max}");
            }
        }

        return $this;
    }

    /**
     * Validar que el valor está entre un rango
     * 
     * @param string $field
     * @param float $min
     * @param float $max
     * @return self
     */
    public function between(string $field, float $min, float $max): self
    {
        $this->rules[$field][] = "between:{$min},{$max}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '' && is_numeric($value)) {
            $floatValue = (float) $value;
            if ($floatValue < $min || $floatValue > $max) {
                $this->addError($field, 'between', "Debe estar entre {$min} y {$max}");
            }
        }

        return $this;
    }

    /**
     * Validar que es una fecha válida
     * 
     * @param string $field
     * @param string $format
     * @return self
     */
    public function date(string $field, string $format = 'Y-m-d'): self
    {
        $this->rules[$field][] = "date:{$format}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            $date = \DateTime::createFromFormat($format, (string) $value);
            if (!$date || $date->format($format) !== (string) $value) {
                $this->addError($field, 'date', "Debe ser una fecha válida en formato {$format}");
            }
        }

        return $this;
    }

    /**
     * Validar que el valor está en una lista de permitidos
     * 
     * @param string $field
     * @param array $allowed
     * @return self
     */
    public function in(string $field, array $allowed): self
    {
        $this->rules[$field][] = 'in:' . implode(',', $allowed);
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!in_array($value, $allowed, true)) {
                $this->addError($field, 'in', "Debe ser uno de: " . implode(', ', $allowed));
            }
        }

        return $this;
    }

    /**
     * Validar que el valor es un booleano
     * 
     * @param string $field
     * @return self
     */
    public function boolean(string $field): self
    {
        $this->rules[$field][] = 'boolean';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            $valid = in_array($value, [true, false, 1, 0, '1', '0', 'true', 'false'], true);
            if (!$valid) {
                $this->addError($field, 'boolean', 'Debe ser verdadero o falso');
            }
        }

        return $this;
    }

    /**
     * Validar que es una URL válida
     * 
     * @param string $field
     * @return self
     */
    public function url(string $field): self
    {
        $this->rules[$field][] = 'url';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_URL)) {
                $this->addError($field, 'url', 'Debe ser una URL válida');
            }
        }

        return $this;
    }

    /**
     * Validar que es un teléfono válido
     * 
     * @param string $field
     * @return self
     */
    public function phone(string $field): self
    {
        $this->rules[$field][] = 'phone';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            $pattern = '/^[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/';
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, 'phone', 'Debe ser un número de teléfono válido');
            }
        }

        return $this;
    }

    /**
     * Validar que es un array
     * 
     * @param string $field
     * @return self
     */
    public function array(string $field): self
    {
        $this->rules[$field][] = 'array';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!is_array($value)) {
                $this->addError($field, 'array', 'Debe ser un array');
            }
        }

        return $this;
    }

    /**
     * Validar que es un objeto JSON válido
     * 
     * @param string $field
     * @return self
     */
    public function json(string $field): self
    {
        $this->rules[$field][] = 'json';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (is_string($value)) {
                json_decode($value);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $this->addError($field, 'json', 'Debe ser un JSON válido');
                }
            }
        }

        return $this;
    }

    /**
     * Validar que dos campos coinciden
     * 
     * @param string $field
     * @param string $confirmationField
     * @return self
     */
    public function same(string $field, string $confirmationField): self
    {
        $this->rules[$field][] = "same:{$confirmationField}";
        $value = $this->getValue($field);
        $confirmationValue = $this->getValue($confirmationField);

        if ($value !== null && $confirmationValue !== null) {
            if ($value !== $confirmationValue) {
                $this->addError($field, 'same', "El campo no coincide con {$confirmationField}");
            }
        }

        return $this;
    }

    /**
     * Validar expresión regular
     * 
     * @param string $field
     * @param string $pattern
     * @return self
     */
    public function regex(string $field, string $pattern): self
    {
        $this->rules[$field][] = "regex:{$pattern}";
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!preg_match($pattern, (string) $value)) {
                $this->addError($field, 'regex', 'El formato no es válido');
            }
        }

        return $this;
    }

    /**
     * Validar que el campo es único en la base de datos
     * 
     * @param string $field
     * @param string $table
     * @param string $column
     * @param int|null $excludeId
     * @return self
     */
    public function unique(string $field, string $table, string $column, ?int $excludeId = null): self
    {
        $this->rules[$field][] = "unique:{$table},{$column}";
        $value = $this->getValue($field);

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
                $this->addError($field, 'unique', 'El valor ya está registrado');
            }
        }

        return $this;
    }

    /**
     * Validar regla personalizada
     * 
     * @param string $field
     * @param callable $callback
     * @param string $message
     * @return self
     */
    public function custom(string $field, callable $callback, ?string $message = null): self
    {
        $this->rules[$field][] = 'custom';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!$callback($value, $this->data)) {
                $this->addError($field, 'custom', $message ?? 'No cumple con la validación personalizada');
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
    private function getValue(string $field): mixed
    {
        // Soporte para notación de puntos (ej: user.name)
        if (strpos($field, '.') !== false) {
            $keys = explode('.', $field);
            $value = $this->data;
            foreach ($keys as $key) {
                if (!isset($value[$key])) {
                    return null;
                }
                $value = $value[$key];
            }
            return $value;
        }

        return $this->data[$field] ?? null;
    }

    /**
     * Agregar un error
     * 
     * @param string $field
     * @param string $rule
     * @param string $message
     */
    private function addError(string $field, string $rule, string $message): void
    {
        if (!isset($this->errors[$field])) {
            $this->errors[$field] = [];
        }
        $this->errors[$field][] = $message;
    }

    /**
     * Verificar si la validación pasó
     * 
     * @return bool
     */
    public function passes(): bool
    {
        return empty($this->errors);
    }

    /**
     * Verificar si la validación falló
     * 
     * @return bool
     */
    public function fails(): bool
    {
        return !$this->passes();
    }

    /**
     * Obtener todos los errores
     * 
     * @return array
     */
    public function errors(): array
    {
        return $this->errors;
    }

    /**
     * Obtener el primer error de un campo
     * 
     * @param string $field
     * @return string|null
     */
    public function firstError(string $field): ?string
    {
        return $this->errors[$field][0] ?? null;
    }

    /**
     * Obtener errores formateados para respuesta
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

    /**
     * Obtener datos validados (solo los que pasaron)
     * 
     * @return array
     */
    public function validated(): array
    {
        $validated = [];
        foreach (array_keys($this->rules) as $field) {
            $value = $this->getValue($field);
            if ($value !== null) {
                $validated[$field] = $value;
            }
        }
        return $validated;
    }

    /**
     * Validar que el campo es un número entero
     * 
     * @param string $field
     * @return self
     */
    public function integer(string $field): self
    {
        $this->rules[$field][] = 'integer';
        $value = $this->getValue($field);

        if ($value !== null && $value !== '') {
            if (!filter_var($value, FILTER_VALIDATE_INT)) {
                $this->addError($field, 'integer', 'El campo debe ser un número entero');
            }
        }

        return $this;
    }
}
