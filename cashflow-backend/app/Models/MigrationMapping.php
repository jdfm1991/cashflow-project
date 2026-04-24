<?php
// app/Models/MigrationMapping.php

namespace App\Models;

use PDO;

class MigrationMapping extends BaseModel
{
    protected $table = 'migration_mappings';
    
    protected $fillable = [
        'company_id',
        'connection_id',
        'source_table',
        'source_field',
        'source_value',
        'target_type',
        'target_id'
    ];
    
    /**
     * Obtener todos los mapeos de una empresa
     */
    public function getByCompany(int $companyId): array
    {
        $sql = "SELECT mm.*, 
                ec.name as connection_name,
                CASE 
                    WHEN mm.target_type = 'account' THEN a.name
                    WHEN mm.target_type = 'bank' THEN b.name
                    WHEN mm.target_type = 'category' THEN c.name
                    ELSE NULL
                END as target_name
                FROM {$this->table} mm
                LEFT JOIN external_connections ec ON mm.connection_id = ec.id
                LEFT JOIN accounts a ON mm.target_type = 'account' AND mm.target_id = a.id
                LEFT JOIN banks b ON mm.target_type = 'bank' AND mm.target_id = b.id
                LEFT JOIN categories c ON mm.target_type = 'category' AND mm.target_id = c.id
                WHERE mm.company_id = :company_id
                ORDER BY mm.source_table, mm.source_field, mm.source_value";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Obtener mapeos por conexión
     */
    public function getByConnection(int $connectionId): array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE connection_id = :connection_id
                ORDER BY source_table, source_field, source_value";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['connection_id' => $connectionId]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Obtener mapeo específico
     */
    public function getMapping(int $connectionId, string $sourceTable, string $sourceField, string $sourceValue): ?array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE connection_id = :connection_id 
                AND source_table = :source_table
                AND source_field = :source_field
                AND source_value = :source_value";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'connection_id' => $connectionId,
            'source_table' => $sourceTable,
            'source_field' => $sourceField,
            'source_value' => $sourceValue
        ]);
        
        $result = $stmt->fetch();
        return $result ?: null;
    }
    
    /**
     * Obtener mapeo por valor (para búsqueda automática)
     */
    public function findMappingByValue(int $connectionId, string $sourceValue, string $targetType): ?array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE connection_id = :connection_id 
                AND source_value = :source_value
                AND target_type = :target_type
                LIMIT 1";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'connection_id' => $connectionId,
            'source_value' => $sourceValue,
            'target_type' => $targetType
        ]);
        
        $result = $stmt->fetch();
        return $result ?: null;
    }
    
    /**
     * Crear o actualizar mapeo
     */
    public function saveMapping(int $companyId, int $connectionId, string $sourceTable, string $sourceField, string $sourceValue, string $targetType, int $targetId): bool
    {
        // Verificar si ya existe
        $existing = $this->getMapping($connectionId, $sourceTable, $sourceField, $sourceValue);
        
        if ($existing) {
            // Actualizar
            $sql = "UPDATE {$this->table} 
                    SET target_type = :target_type, target_id = :target_id, updated_at = NOW()
                    WHERE id = :id";
            
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([
                'target_type' => $targetType,
                'target_id' => $targetId,
                'id' => $existing['id']
            ]);
        } else {
            // Crear nuevo
            $sql = "INSERT INTO {$this->table} 
                    (company_id, connection_id, source_table, source_field, source_value, target_type, target_id, created_at, updated_at)
                    VALUES (:company_id, :connection_id, :source_table, :source_field, :source_value, :target_type, :target_id, NOW(), NOW())";
            
            $stmt = $this->db->prepare($sql);
            return $stmt->execute([
                'company_id' => $companyId,
                'connection_id' => $connectionId,
                'source_table' => $sourceTable,
                'source_field' => $sourceField,
                'source_value' => $sourceValue,
                'target_type' => $targetType,
                'target_id' => $targetId
            ]);
        }
    }
    
    /**
     * Eliminar mapeos por conexión
     */
    public function deleteByConnection(int $connectionId): bool
    {
        $sql = "DELETE FROM {$this->table} WHERE connection_id = :connection_id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['connection_id' => $connectionId]);
    }
    
    /**
     * Eliminar mapeo específico
     */
    public function deleteMapping(int $id): bool
    {
        $sql = "DELETE FROM {$this->table} WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $id]);
    }
    
    /**
     * Obtener estadísticas de mapeos por empresa
     */
    public function getStats(int $companyId): array
    {
        $sql = "SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT connection_id) as connections,
                    target_type,
                    COUNT(*) as count
                FROM {$this->table}
                WHERE company_id = :company_id
                GROUP BY target_type";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        
        $results = $stmt->fetchAll();
        
        $stats = [
            'total' => 0,
            'connections' => 0,
            'by_type' => []
        ];
        
        foreach ($results as $row) {
            $stats['total'] += $row['count'];
            $stats['by_type'][$row['target_type']] = $row['count'];
        }
        
        // Contar conexiones únicas
        $sql = "SELECT COUNT(DISTINCT connection_id) as connections FROM {$this->table} WHERE company_id = :company_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        $result = $stmt->fetch();
        $stats['connections'] = $result['connections'] ?? 0;
        
        return $stats;
    }
    
    /**
     * Exportar mapeos a JSON
     */
    public function exportToJson(int $companyId): string
    {
        $mappings = $this->getByCompany($companyId);
        
        $export = [];
        foreach ($mappings as $mapping) {
            $key = "{$mapping['source_table']}.{$mapping['source_field']}.{$mapping['source_value']}";
            $export[$key] = [
                'target_type' => $mapping['target_type'],
                'target_id' => $mapping['target_id'],
                'target_name' => $mapping['target_name'] ?? null
            ];
        }
        
        return json_encode($export, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
    
    /**
     * Importar mapeos desde JSON
     */
    public function importFromJson(int $companyId, int $connectionId, string $json): array
    {
        $data = json_decode($json, true);
        if (!is_array($data)) {
            return ['success' => false, 'message' => 'JSON inválido'];
        }
        
        $imported = 0;
        $errors = [];
        
        foreach ($data as $key => $value) {
            // Parsear key: "source_table.source_field.source_value"
            $parts = explode('.', $key, 3);
            if (count($parts) !== 3) {
                $errors[] = "Key inválida: {$key}";
                continue;
            }
            
            list($sourceTable, $sourceField, $sourceValue) = $parts;
            
            $result = $this->saveMapping(
                $companyId,
                $connectionId,
                $sourceTable,
                $sourceField,
                $sourceValue,
                $value['target_type'],
                $value['target_id']
            );
            
            if ($result) {
                $imported++;
            } else {
                $errors[] = "Error al guardar: {$key}";
            }
        }
        
        return [
            'success' => empty($errors),
            'imported' => $imported,
            'errors' => $errors
        ];
    }
}