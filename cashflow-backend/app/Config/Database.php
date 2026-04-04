<?php
// app/Config/Database.php - Versión final recomendada

namespace App\Config;

use PDO;
use PDOException;

class Database
{
    private static $instance = null;
    private $connection;
    
    private function __construct()
    {
        try {
            $host = $_ENV['DB_HOST'] ?? 'localhost';
            $port = $_ENV['DB_PORT'] ?? 3306;
            $database = $_ENV['DB_NAME'] ?? 'cashflow_db';
            $username = $_ENV['DB_USER'] ?? 'root';
            $password = $_ENV['DB_PASS'] ?? '';
            $charset = $_ENV['DB_CHARSET'] ?? 'utf8mb4';
            
            // DSN con charset incluido
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";
            
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $this->connection = new PDO($dsn, $username, $password, $options);
            
        } catch (PDOException $e) {
            // En desarrollo, mostrar error detallado
            if (defined('APP_DEBUG') && APP_DEBUG) {
                die("Error de conexión a base de datos: " . $e->getMessage());
            }
            // En producción, mostrar mensaje genérico
            die("Error de conexión a base de datos. Por favor contacte al administrador.");
        }
    }
    
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection(): PDO
    {
        return $this->connection;
    }
    
    public function beginTransaction(): bool
    {
        return $this->connection->beginTransaction();
    }
    
    public function commit(): bool
    {
        return $this->connection->commit();
    }
    
    public function rollback(): bool
    {
        return $this->connection->rollback();
    }
    
    public function lastInsertId(): string
    {
        return $this->connection->lastInsertId();
    }
    
    public function quote(string $value): string
    {
        return $this->connection->quote($value);
    }
}