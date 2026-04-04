<?php
namespace App\Config;

use PDO;
use PDOException;

class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $host = $_ENV['DB_HOST'];
            $port = $_ENV['DB_PORT'];
            $database = $_ENV['DB_NAME'];
            $username = $_ENV['DB_USER'];
            $password = $_ENV['DB_PASS'];
            $charset = $_ENV['DB_CHARSET'];
            
            $dsn = "mysql:host={$host};port={$port};dbname={$database};charset={$charset}";
            
            $this->connection = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]);
        } catch (PDOException $e) {
            die("Error de conexión: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function beginTransaction() {
        return $this->connection->beginTransaction();
    }
    
    public function commit() {
        return $this->connection->commit();
    }
    
    public function rollback() {
        return $this->connection->rollback();
    }
}