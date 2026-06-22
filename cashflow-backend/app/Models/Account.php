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

    /**
     * Obtener cuentas por empresa
     */
    public function getByCompany(int $companyId, ?string $type = null): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE company_id = :company_id";
        $params = ['company_id' => $companyId];

        if ($type) {
            $sql .= " AND type = :type";
            $params['type'] = $type;
        }

        $sql .= " ORDER BY name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    // app/Models/Account.php - Agregar estos métodos

    /**
     * Obtener distribución de transacciones por categoría
     * 
     * @param int $companyId ID de la empresa
     * @param string $type Tipo de transacción ('income' o 'expense')
     * @param string $startDate Fecha inicio
     * @param string $endDate Fecha fin
     * @return array
     */
    public function getCategoryDistribution(int $companyId, string $type, string $startDate, string $endDate): array
    {
        $table = $type === 'income' ? 'incomes' : 'expenses';

        $sql = "SELECT 
                c.id as category_id,
                c.name as category_name,
                c.color as category_color,
                c.icon as category_icon,
                COALESCE(SUM(t.amount_base_currency), 0) as total
            FROM {$table} t
            INNER JOIN accounts a ON t.account_id = a.id
            INNER JOIN categories c ON a.category = c.name
            WHERE t.company_id = :company_id
                AND t.date BETWEEN :start_date AND :end_date
                AND c.type = :type
                AND c.is_active = 1
            GROUP BY c.id, c.name, c.color, c.icon
            ORDER BY total DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'type' => $type
        ]);

        $results = $stmt->fetchAll();
        $total = array_sum(array_column($results, 'total'));

        $categories = [];
        foreach ($results as $row) {
            $categories[] = [
                'category_id' => (int) $row['category_id'],
                'name' => $row['category_name'],
                'color' => $row['category_color'] ?? '#6c757d',
                'icon' => $row['category_icon'] ?? 'bi-tag',
                'total' => (float) $row['total'],
                'percentage' => $total > 0 ? round(($row['total'] / $total) * 100, 2) : 0
            ];
        }

        return $categories;
    }

    /**
     * Obtener todas las categorías con sus colores
     */
    public function getCategoriesWithColors(): array
    {
        $sql = "SELECT id, name, type, color, icon, is_active 
            FROM categories 
            WHERE is_active = 1 
            ORDER BY type, sort_order, name";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
