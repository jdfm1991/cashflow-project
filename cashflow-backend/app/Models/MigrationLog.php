<?php
// app/Models/MigrationLog.php

namespace App\Models;

// app/Models/MigrationLog.php

namespace App\Models;

class MigrationLog extends BaseModel
{
    protected $table = 'migration_logs';

    protected $fillable = [
        'company_id',
        'connection_id',
        'migration_type',
        'year',
        'month',
        'total_records',
        'imported_records',
        'duplicated_records',
        'failed_records',
        'status',
        'error_log',
        'started_at',
        'completed_at',
        'created_by'
    ];

    /**
     * Sobrescribir el método create para que retorne solo el ID
     * Esto NO afecta a otros modelos
     */
    public function createlog(array $data): ?int
    {
        // ✅ Construir SQL manualmente, sin usar parent::create()
        $sql = "INSERT INTO {$this->table} 
                (company_id, connection_id, migration_type, year, month, status, started_at, created_by) 
                VALUES 
                (:company_id, :connection_id, :migration_type, :year, :month, :status, :started_at, :created_by)";

        $stmt = $this->db->prepare($sql);

        $params = [
            'company_id' => $data['company_id'],
            'connection_id' => $data['connection_id'],
            'migration_type' => $data['migration_type'],
            'year' => $data['year'],
            'month' => $data['month'],
            'status' => $data['status'],
            'started_at' => $data['started_at'],
            'created_by' => $data['created_by']
        ];

        if ($stmt->execute($params)) {
            $id = (int) $this->db->lastInsertId();
            error_log("MigrationLog: Registro creado con ID: " . $id);
            return $id;
        }

        error_log("MigrationLog: Error al crear registro");
        return null;
    }

    /**
     * Obtener logs por empresa
     */
    public function getByCompany(int $companyId, int $limit = 50): array
    {
        $sql = "SELECT ml.*, ec.name as connection_name, u.username as created_by_name
                FROM {$this->table} ml
                LEFT JOIN external_connections ec ON ml.connection_id = ec.id
                LEFT JOIN users u ON ml.created_by = u.id
                WHERE ml.company_id = :company_id
                ORDER BY ml.created_at DESC
                LIMIT :limit";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('company_id', $companyId, \PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Actualizar log
     */
    public function updateLog(int $id, array $data): bool
    {
        $fields = [];
        $params = ['id' => $id];

        $allowedFields = [
            'total_records',
            'imported_records',
            'duplicated_records',
            'failed_records',
            'status',
            'error_log',
            'completed_at'
        ];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $fields[] = "{$field} = :{$field}";
                $params[$field] = $data[$field];
            }
        }

        if (empty($fields)) {
            return false;
        }

        $sql = "UPDATE {$this->table} SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute($params);
    }

    /**
     * Obtener logs por connection_id
     */
    public function getByConnection(int $connectionId): array
    {
        $sql = "SELECT * FROM {$this->table} 
            WHERE connection_id = :connection_id
            ORDER BY created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['connection_id' => $connectionId]);

        return $stmt->fetchAll();
    }

    // app/Models/MigrationLog.php

    /**
     * Obtener todos los logs (para super_admin)
     */
    public function getAll(int $limit = 50): array
    {
        $sql = "SELECT ml.*, ec.name as connection_name, c.name as company_name, u.username as created_by_name
            FROM {$this->table} ml
            LEFT JOIN external_connections ec ON ml.connection_id = ec.id
            LEFT JOIN companies c ON ml.company_id = c.id
            LEFT JOIN users u ON ml.created_by = u.id
            ORDER BY ml.created_at DESC
            LIMIT :limit";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll();
    }
}
