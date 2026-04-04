<?php

namespace App\Models;

class Account extends BaseModel
{
    protected $table = 'accounts';

    protected $fillable = [
        'name',
        'type',
        'category',
        'description',
        'is_system',
        'is_active',
        'sort_order'
    ];

    /**
     * Obtener cuentas por usuario
     */
    public function getByUser($userId, $type = null)
    {
        $sql = "SELECT * FROM {$this->table} WHERE user_id = :user_id";
        $params = ['user_id' => $userId];

        if ($type) {
            $sql .= " AND type = :type";
            $params['type'] = $type;
        }

        $sql .= " ORDER BY name ASC";

        return $this->query($sql, $params);
    }

    /**
     * Obtener resumen por categoría
     */
    public function getSummaryByCategory($userId, $startDate, $endDate, $type = null)
    {
        $sql = "SELECT 
                    a.category,
                    a.name as account_name,
                    SUM(CASE 
                        WHEN t.type = 'income' THEN t.amount 
                        ELSE t.amount 
                    END) as total
                FROM accounts a
                LEFT JOIN (
                    SELECT account_id, amount, 'income' as type, date 
                    FROM incomes WHERE user_id = :user_id AND date BETWEEN :start_date AND :end_date
                    UNION ALL
                    SELECT account_id, amount, 'expense' as type, date 
                    FROM expenses WHERE user_id = :user_id AND date BETWEEN :start_date AND :end_date
                ) t ON a.id = t.account_id
                WHERE a.user_id = :user_id";

        $params = [
            'user_id' => $userId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ];

        if ($type) {
            $sql .= " AND a.type = :type";
            $params['type'] = $type;
        }

        $sql .= " GROUP BY a.id, a.category, a.name ORDER BY total DESC";

        return $this->query($sql, $params);
    }

    public function countByUser(int $userId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    public function find($id)
    {
        // ✅ Seleccionar todas las columnas
        $sql = "SELECT * FROM {$this->table} WHERE {$this->primaryKey} = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);

        $result = $stmt->fetch();

        if ($result) {
            // ✅ No ocultar campos aquí
            return $result;
        }

        return null;
    }

    /**
     * Obtener cuentas globales (catálogo)
     */
    public function getGlobalAccounts(?string $type = null): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE 1=1";
        $params = [];

        if ($type && in_array($type, ['income', 'expense'])) {
            $sql .= " AND type = :type";
            $params['type'] = $type;
        }

        $sql .= " ORDER BY sort_order ASC, name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Obtener cuentas por tipo
     */
    public function getByType(string $type): array
    {
        return $this->getGlobalAccounts($type);
    }

    /**
     * Contar cuentas por categoría
     */
    public function countByCategory(string $category, string $type): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} 
                WHERE category = :category AND type = :type";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'category' => $category,
            'type' => $type
        ]);

        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }
}
