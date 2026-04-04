<?php
declare(strict_types=1);

/**
 * Clase Helper de Logging
 * 
 * Proporciona métodos para registrar eventos, errores y actividades
 * en el sistema. Soporta múltiples niveles de log y diferentes
 * destinos (archivo, base de datos, etc.).
 * 
 * @package App\Helpers
 */

namespace App\Helpers;

class Logger
{
    /**
     * Niveles de log
     */
    public const LEVEL_DEBUG = 'debug';
    public const LEVEL_INFO = 'info';
    public const LEVEL_WARNING = 'warning';
    public const LEVEL_ERROR = 'error';
    public const LEVEL_CRITICAL = 'critical';
    
    /**
     * Archivo de log actual
     * @var string
     */
    private string $logFile;
    
    /**
     * Nivel mínimo de log
     * @var string
     */
    private string $minLevel;
    
    /**
     * Niveles con orden de prioridad
     * @var array
     */
    private array $levels = [
        self::LEVEL_DEBUG => 0,
        self::LEVEL_INFO => 1,
        self::LEVEL_WARNING => 2,
        self::LEVEL_ERROR => 3,
        self::LEVEL_CRITICAL => 4
    ];
    
    /**
     * Constructor
     * 
     * @param string|null $logFile Archivo de log personalizado
     * @param string $minLevel Nivel mínimo a registrar
     */
    public function __construct(?string $logFile = null, string $minLevel = self::LEVEL_INFO)
    {
        $this->logFile = $logFile ?? LOGS_PATH . '/app_' . date('Y-m-d') . '.log';
        $this->minLevel = $minLevel;
        
        // Crear directorio si no existe
        $logDir = dirname($this->logFile);
        if (!is_dir($logDir)) {
            mkdir($logDir, 0777, true);
        }
    }
    
    /**
     * Registrar mensaje de debug
     * 
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function debug(string $message, array $context = []): bool
    {
        return $this->log(self::LEVEL_DEBUG, $message, $context);
    }
    
    /**
     * Registrar mensaje informativo
     * 
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function info(string $message, array $context = []): bool
    {
        return $this->log(self::LEVEL_INFO, $message, $context);
    }
    
    /**
     * Registrar mensaje de advertencia
     * 
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function warning(string $message, array $context = []): bool
    {
        return $this->log(self::LEVEL_WARNING, $message, $context);
    }
    
    /**
     * Registrar mensaje de error
     * 
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function error(string $message, array $context = []): bool
    {
        return $this->log(self::LEVEL_ERROR, $message, $context);
    }
    
    /**
     * Registrar mensaje crítico
     * 
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function critical(string $message, array $context = []): bool
    {
        return $this->log(self::LEVEL_CRITICAL, $message, $context);
    }
    
    /**
     * Registrar un log
     * 
     * @param string $level
     * @param string $message
     * @param array $context
     * @return bool
     */
    public function log(string $level, string $message, array $context = []): bool
    {
        // Verificar si el nivel debe ser registrado
        if ($this->levels[$level] < $this->levels[$this->minLevel]) {
            return false;
        }
        
        // Formatear mensaje
        $logEntry = $this->formatLogEntry($level, $message, $context);
        
        // Escribir en archivo
        try {
            $handle = fopen($this->logFile, 'a');
            if ($handle) {
                fwrite($handle, $logEntry . PHP_EOL);
                fclose($handle);
                return true;
            }
        } catch (\Exception $e) {
            error_log("Error writing log: " . $e->getMessage());
        }
        
        return false;
    }
    
    /**
     * Formatear entrada de log
     * 
     * @param string $level
     * @param string $message
     * @param array $context
     * @return string
     */
    private function formatLogEntry(string $level, string $message, array $context): string
    {
        $timestamp = date('Y-m-d H:i:s');
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'CLI';
        $userId = $_REQUEST['user_id'] ?? 'anonymous';
        
        // Formato JSON para facilitar parseo
        $logData = [
            'timestamp' => $timestamp,
            'level' => strtoupper($level),
            'ip' => $ip,
            'user_id' => $userId,
            'message' => $message,
            'context' => $context
        ];
        
        // Agregar información de depuración en modo debug
        if (APP_DEBUG && in_array($level, [self::LEVEL_DEBUG, self::LEVEL_INFO])) {
            $logData['file'] = debug_backtrace()[2]['file'] ?? null;
            $logData['line'] = debug_backtrace()[2]['line'] ?? null;
        }
        
        return json_encode($logData, JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * Registrar excepción
     * 
     * @param \Throwable $exception
     * @param string $level
     * @return bool
     */
    public function exception(\Throwable $exception, string $level = self::LEVEL_ERROR): bool
    {
        $context = [
            'exception' => get_class($exception),
            'code' => $exception->getCode(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString()
        ];
        
        return $this->log($level, $exception->getMessage(), $context);
    }
    
    /**
     * Registrar actividad de usuario
     * 
     * @param int $userId
     * @param string $action
     * @param array $details
     * @return bool
     */
    public function activity(int $userId, string $action, array $details = []): bool
    {
        return $this->info("Usuario {$userId} realizó: {$action}", [
            'user_id' => $userId,
            'action' => $action,
            'details' => $details
        ]);
    }
    
    /**
     * Registrar operación de base de datos
     * 
     * @param string $operation
     * @param string $table
     * @param array $data
     * @return bool
     */
    public function database(string $operation, string $table, array $data = []): bool
    {
        return $this->debug("DB {$operation} en {$table}", [
            'operation' => $operation,
            'table' => $table,
            'data' => $data
        ]);
    }
    
    /**
     * Registrar solicitud HTTP
     * 
     * @param string $method
     * @param string $uri
     * @param int $statusCode
     * @param float $duration
     * @return bool
     */
    public function request(string $method, string $uri, int $statusCode, float $duration): bool
    {
        $level = $statusCode >= 500 ? self::LEVEL_ERROR : ($statusCode >= 400 ? self::LEVEL_WARNING : self::LEVEL_INFO);
        
        return $this->log($level, "{$method} {$uri} - {$statusCode}", [
            'method' => $method,
            'uri' => $uri,
            'status_code' => $statusCode,
            'duration_ms' => round($duration * 1000, 2)
        ]);
    }
    
    /**
     * Limpiar logs antiguos
     * 
     * @param int $daysToKeep
     * @return int Número de archivos eliminados
     */
    public function cleanOldLogs(int $daysToKeep = 30): int
    {
        $deleted = 0;
        $logDir = dirname($this->logFile);
        $cutoffDate = strtotime("-{$daysToKeep} days");
        
        $files = glob($logDir . '/*.log');
        foreach ($files as $file) {
            if (filemtime($file) < $cutoffDate) {
                if (unlink($file)) {
                    $deleted++;
                }
            }
        }
        
        return $deleted;
    }
    
    /**
     * Obtener estadísticas de logs
     * 
     * @param string $date
     * @return array
     */
    public function getStats(string $date = null): array
    {
        $date = $date ?? date('Y-m-d');
        $logFile = LOGS_PATH . '/app_' . $date . '.log';
        
        if (!file_exists($logFile)) {
            return [
                'date' => $date,
                'total' => 0,
                'by_level' => [],
                'errors' => 0,
                'warnings' => 0
            ];
        }
        
        $stats = [
            'date' => $date,
            'total' => 0,
            'by_level' => [
                self::LEVEL_DEBUG => 0,
                self::LEVEL_INFO => 0,
                self::LEVEL_WARNING => 0,
                self::LEVEL_ERROR => 0,
                self::LEVEL_CRITICAL => 0
            ],
            'errors' => 0,
            'warnings' => 0
        ];
        
        $lines = file($logFile);
        foreach ($lines as $line) {
            $logData = json_decode($line, true);
            if ($logData && isset($logData['level'])) {
                $level = strtolower($logData['level']);
                if (isset($stats['by_level'][$level])) {
                    $stats['by_level'][$level]++;
                    $stats['total']++;
                    
                    if ($level === self::LEVEL_ERROR || $level === self::LEVEL_CRITICAL) {
                        $stats['errors']++;
                    }
                    if ($level === self::LEVEL_WARNING) {
                        $stats['warnings']++;
                    }
                }
            }
        }
        
        return $stats;
    }
    
    /**
     * Buscar en los logs
     * 
     * @param string $search
     * @param string $date
     * @param int $limit
     * @return array
     */
    public function search(string $search, string $date = null, int $limit = 100): array
    {
        $date = $date ?? date('Y-m-d');
        $logFile = LOGS_PATH . '/app_' . $date . '.log';
        
        if (!file_exists($logFile)) {
            return [];
        }
        
        $results = [];
        $lines = file($logFile);
        
        foreach ($lines as $line) {
            if (stripos($line, $search) !== false) {
                $logData = json_decode($line, true);
                if ($logData) {
                    $results[] = $logData;
                    if (count($results) >= $limit) {
                        break;
                    }
                }
            }
        }
        
        return $results;
    }
}