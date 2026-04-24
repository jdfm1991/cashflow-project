<?php
// app/Models/ExternalConnection.php

namespace App\Models;

class ExternalConnection extends BaseModel
{
    protected $table = 'external_connections';

    protected $fillable = [
        'company_id',
        'name',
        'type',
        'host',
        'port',
        'db_name',        // ← Cambiado de 'database' a 'db_name'
        'username',
        'password',
        'table_name',
        'field_mapping',
        'query_template',
        'last_sync_at',
        'is_active'
    ];

    /**
     * Obtener conexiones por empresa
     */
    public function getByCompany(int $companyId): array
    {
        $sql = "SELECT id, company_id, name, type, host, port, db_name, username, 
                       table_name, field_mapping, query_template, last_sync_at, is_active,
                       created_at, updated_at
                FROM {$this->table} 
                WHERE company_id = :company_id 
                AND is_active = 1
                ORDER BY name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);

        $results = $stmt->fetchAll();

        // Ocultar contraseña
        foreach ($results as &$row) {
            unset($row['password']);
        }

        return $results;
    }

    /**
     * Actualizar última sincronización
     */
    public function updateLastSync(int $id): bool
    {
        $sql = "UPDATE {$this->table} SET last_sync_at = NOW(), updated_at = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $id]);
    }

    /**
     * Probar conexión (verificar que los datos son válidos)
     */
    public function testConnection(array $config): array
    {
        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $config['host'],
                $config['port'] ?? 3306,
                $config['db_name']
            );

            $pdo = new \PDO(
                $dsn,
                $config['username'],
                $config['password'],
                [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION]
            );

            $pdo->query("SELECT 1");
            $pdo = null;

            return ['success' => true, 'message' => 'Conexión exitosa'];
        } catch (\Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}
