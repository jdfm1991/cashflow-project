<?php

namespace App\Models;

use App\Config\Database;
use PDO;
use PDOException;

abstract class BaseModel
{
    protected $db;
    protected $table;
    protected $primaryKey = 'id';
    protected $fillable = [];
    protected $hidden = [];

    public function __construct()
    {
        $this->db = Database::getInstance()->getConnection();
    }

    /**
     * Obtener todos los registros con filtros
     */
    public function all($filters = [], $orderBy = null, $limit = null)
    {
        $sql = "SELECT * FROM {$this->table} WHERE 1=1";
        $params = [];

        foreach ($filters as $field => $value) {
            $sql .= " AND {$field} = :{$field}";
            $params[$field] = $value;
        }

        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }

        if ($limit) {
            $sql .= " LIMIT {$limit}";
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        $results = $stmt->fetchAll();

        // Ocultar campos sensibles
        foreach ($results as &$row) {
            foreach ($this->hidden as $field) {
                unset($row[$field]);
            }
        }

        return $results;
    }

    /**
     * Buscar por ID
     */
    public function find($id)
    {
        $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);

        $result = $stmt->fetch();

        if ($result) {
            foreach ($this->hidden as $field) {
                unset($result[$field]);
            }
        }

        return $result;
    }

    /**
     * Crear nuevo registro
     */
    public function create($data)
    {
        try {
            // Filtrar solo campos fillable
            $data = array_intersect_key($data, array_flip($this->fillable));

            if (empty($data)) {
                return null;
            }

            // Convertir valores booleanos a enteros para MySQL
            foreach ($data as $key => $value) {
                if (is_bool($value)) {
                    $data[$key] = $value ? 1 : 0;
                }
            }

            $fields = implode(', ', array_keys($data));
            $placeholders = ':' . implode(', :', array_keys($data));

            $sql = "INSERT INTO {$this->table} ({$fields}) VALUES ({$placeholders})";

            error_log("BaseModel create SQL: " . $sql);
            error_log("BaseModel create data: " . print_r($data, true));

            $stmt = $this->db->prepare($sql);

            // Bind de parámetros con tipos correctos
            foreach ($data as $key => $value) {
                $paramType = PDO::PARAM_STR;
                if (is_int($value)) {
                    $paramType = PDO::PARAM_INT;
                } elseif (is_bool($value)) {
                    $paramType = PDO::PARAM_BOOL;
                } elseif (is_null($value)) {
                    $paramType = PDO::PARAM_NULL;
                }
                $stmt->bindValue(":{$key}", $value, $paramType);
            }

            if ($stmt->execute()) {
                $id = $this->db->lastInsertId();
                return $this->find($id);
            }

            error_log("BaseModel create failed: " . print_r($stmt->errorInfo(), true));
            return null;
        } catch (PDOException $e) {
            error_log("BaseModel create PDOException: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Actualizar registro
     */
    public function update($id, $data)
    {
        // Filtrar solo campos fillable
        $data = array_intersect_key($data, array_flip($this->fillable));

        $setClause = [];
        foreach ($data as $field => $value) {
            $setClause[] = "{$field} = :{$field}";
        }

        $sql = "UPDATE {$this->table} SET " . implode(', ', $setClause) . " WHERE {$this->primaryKey} = :id";
        $data['id'] = $id;

        $stmt = $this->db->prepare($sql);

        if ($stmt->execute($data)) {
            return $this->find($id);
        }

        return false;
    }

    /**
     * Eliminar registro
     */
    public function delete($id)
    {
        $sql = "DELETE FROM {$this->table} WHERE {$this->primaryKey} = :id";
        $stmt = $this->db->prepare($sql);

        return $stmt->execute(['id' => $id]);
    }

    /**
     * Ejecutar query personalizada
     */
    public function query($sql, $params = [])
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    /**
     * Contar registros
     */
    public function count($filters = [])
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE 1=1";
        $params = [];

        foreach ($filters as $field => $value) {
            $sql .= " AND {$field} = :{$field}";
            $params[$field] = $value;
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetch()['total'];
    }

    // Almacenar el company_id actual para filtros automáticos
    protected static $currentCompanyId = null;

    /**
     * Establecer el company_id actual para todas las consultas
     */
    public static function setCurrentCompanyId(int $companyId): void
    {
        self::$currentCompanyId = $companyId;
    }

    /**
     * Obtener el company_id actual
     */
    public static function getCurrentCompanyId(): ?int
    {
        return self::$currentCompanyId;
    }

    /**
     * Agregar filtro de company_id a las consultas
     */
    protected function addCompanyFilter(string &$sql, array &$params): void
    {
        if (self::$currentCompanyId !== null && $this->hasCompanyColumn()) {
            $sql .= " AND company_id = :company_id";
            $params['company_id'] = self::$currentCompanyId;
        }
    }

    /**
     * Verificar si la tabla tiene columna company_id
     */
    protected function hasCompanyColumn(): bool
    {
        // Verificar en la estructura de la tabla o asumir que sí
        return true;
    }
    /**
     * Obtener la conexión PDO
     */
    public function getDb(): PDO
    {
        return $this->db;
    }
}
