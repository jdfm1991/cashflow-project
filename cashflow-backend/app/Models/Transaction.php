<?php
// app/Models/Transaction.php
declare(strict_types=1);

namespace App\Models;

use DateInterval;
use DatePeriod;
use DateTime;
use PDO;

abstract class Transaction extends BaseModel
{
    /**
     * Obtener transacciones con detalles de cuenta (por empresa)
     */
    public function getWithAccount(int $companyId, array $filters = [], ?int $limit = null): array
    {
        $table = $this->table;
        $sql = "SELECT t.*, a.name as account_name, a.category 
                FROM {$table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id";
        $params = ['company_id' => $companyId];

        if (!empty($filters['start_date'])) {
            $sql .= " AND t.date >= :start_date";
            $params['start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND t.date <= :end_date";
            $params['end_date'] = $filters['end_date'];
        }

        if (!empty($filters['account_id'])) {
            $sql .= " AND t.account_id = :account_id";
            $params['account_id'] = $filters['account_id'];
        }

        if (!empty($filters['category'])) {
            $sql .= " AND a.category = :category";
            $params['category'] = $filters['category'];
        }

        if (!empty($filters['search'])) {
            $sql .= " AND (t.description LIKE :search OR t.reference LIKE :search)";
            $params['search'] = "%{$filters['search']}%";
        }

        $sql .= " ORDER BY t.date DESC, t.created_at DESC";

        if ($limit) {
            $sql .= " LIMIT :limit";
            $params['limit'] = $limit;
        }

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $paramType = $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($key, $value, $paramType);
        }

        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Obtener total por período (por empresa)
     */
    public function getTotalByPeriod(int $companyId, string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount), 0) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                    AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Obtener total por cuenta (global, pero filtrado por empresa)
     */
    public function getTotalByAccount(int $companyId, int $accountId, string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount), 0) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                    AND account_id = :account_id
                    AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'account_id' => $accountId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Obtener total por categoría (por empresa)
     */
    public function getTotalByCategory(int $companyId, string $category, string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(t.amount), 0) as total 
                FROM {$this->table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id 
                    AND a.category = :category
                    AND t.date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'category' => $category,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Contar transacciones por cuenta (global, para verificar si se puede eliminar)
     */
    public function countByAccount(int $accountId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} 
                WHERE account_id = :account_id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['account_id' => $accountId]);

        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Contar transacciones por cuenta y empresa
     */
    public function countByAccountAndCompany(int $companyId, int $accountId, string $startDate, string $endDate): int
    {
        $sql = "SELECT COUNT(*) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                    AND account_id = :account_id
                    AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'account_id' => $accountId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Contar transacciones por categoría y empresa
     */
    public function countByCategoryAndCompany(int $companyId, string $category, string $startDate, string $endDate): int
    {
        $sql = "SELECT COUNT(*) as total 
                FROM {$this->table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id 
                    AND a.category = :category
                    AND t.date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'category' => $category,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Contar transacciones por empresa en un período
     */
    public function countByCompanyAndPeriod(int $companyId, string $startDate, string $endDate): int
    {
        $sql = "SELECT COUNT(*) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                    AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Obtener resumen mensual por empresa
     */
    public function getMonthlySummary(int $companyId, int $year): array
    {
        $sql = "SELECT 
                    MONTH(date) as month,
                    SUM(amount) as total,
                    COUNT(*) as count
                FROM {$this->table}
                WHERE company_id = :company_id 
                    AND YEAR(date) = :year
                GROUP BY MONTH(date)
                ORDER BY month ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'year' => $year
        ]);

        $results = $stmt->fetchAll();

        $monthlyData = [];
        for ($i = 1; $i <= 12; $i++) {
            $monthlyData[$i] = [
                'month' => $i,
                'total' => 0,
                'count' => 0
            ];
        }

        foreach ($results as $row) {
            $monthlyData[(int) $row['month']] = [
                'month' => (int) $row['month'],
                'total' => (float) $row['total'],
                'count' => (int) $row['count']
            ];
        }

        return array_values($monthlyData);
    }

    /**
     * Verificar que la transacción pertenece a una empresa
     */
    public function belongsToCompany(int $transactionId, int $companyId): bool
    {
        $sql = "SELECT COUNT(*) as count FROM {$this->table} 
                WHERE id = :id AND company_id = :company_id";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'id' => $transactionId,
            'company_id' => $companyId
        ]);

        $result = $stmt->fetch();
        return ($result['count'] ?? 0) > 0;
    }

    /**
     * Contar transacciones por cuenta bancaria
     */
    public function countByBankAccount(int $bankAccountId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE bank_account_id = :bank_account_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['bank_account_id' => $bankAccountId]);
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Contar transacciones por cuenta bancaria y empresa
     */
    public function countByBankAccountAndCompany(int $companyId, int $bankAccountId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} 
                WHERE company_id = :company_id AND bank_account_id = :bank_account_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'bank_account_id' => $bankAccountId
        ]);
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Obtener transacciones por cuenta bancaria
     */
    public function getByBankAccount(int $companyId, int $bankAccountId, array $filters = [], ?int $limit = null): array
    {
        $table = $this->table;
        $sql = "SELECT t.*, a.name as account_name, a.category 
                FROM {$table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id AND t.bank_account_id = :bank_account_id";
        $params = [
            'company_id' => $companyId,
            'bank_account_id' => $bankAccountId
        ];

        if (!empty($filters['start_date'])) {
            $sql .= " AND t.date >= :start_date";
            $params['start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND t.date <= :end_date";
            $params['end_date'] = $filters['end_date'];
        }

        if (!empty($filters['account_id'])) {
            $sql .= " AND t.account_id = :account_id";
            $params['account_id'] = $filters['account_id'];
        }

        $sql .= " ORDER BY t.date DESC, t.created_at DESC";

        if ($limit) {
            $sql .= " LIMIT :limit";
            $params['limit'] = $limit;
        }

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $paramType = $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($key, $value, $paramType);
        }

        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Obtener total por cuenta bancaria
     */
    public function getTotalByBankAccount(int $companyId, int $bankAccountId, string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount), 0) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                    AND bank_account_id = :bank_account_id
                    AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'bank_account_id' => $bankAccountId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    public function countByCurrency(int $currencyId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE currency_id = :currency_id";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue(':currency_id', $currencyId, PDO::PARAM_INT);
        $stmt->execute();
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Obtener total por empresa en un período
     */
    public function getTotalByCompany(int $companyId, string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount_base_currency), 0) as total 
                FROM {$this->table} 
                WHERE company_id = :company_id 
                AND date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Obtener transacciones recientes por empresa
     */
    public function getRecentByCompany(int $companyId, int $limit): array
    {
        $type = $this->table === 'incomes' ? 'income' : 'expense';
        $typeLabel = $this->table === 'incomes' ? 'Ingreso' : 'Egreso';

        $sql = "SELECT t.*, a.name as account_name, a.category, '{$type}' as type, '{$typeLabel}' as type_label
                FROM {$this->table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id
                ORDER BY t.date DESC, t.created_at DESC
                LIMIT :limit";

        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('company_id', $companyId, PDO::PARAM_INT);
        $stmt->bindValue('limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = $stmt->fetchAll();

        // Asegurar que amount sea float
        foreach ($results as &$row) {
            $row['amount'] = (float) $row['amount'];
            $row['amount_base_currency'] = (float) ($row['amount_base_currency'] ?? $row['amount']);
        }

        return $results;
    }

    /**
     * Obtener datos mensuales por empresa
     */
    public function getMonthlyDataByCompany(int $companyId, DateTime $startDate, DateTime $endDate): array
    {
        $labels = [];
        $data = [];

        $interval = new DateInterval('P1M');
        $period = new DatePeriod($startDate, $interval, $endDate->modify('+1 month'));

        foreach ($period as $date) {
            $monthStart = $date->format('Y-m-01');
            $monthEnd = $date->format('Y-m-t');

            $labels[] = $date->format('M Y');
            $data[] = $this->getTotalByCompany($companyId, $monthStart, $monthEnd);
        }

        return [
            'labels' => $labels,
            'data' => $data
        ];
    }

    /**
     * Obtener distribución por categorías por empresa
     */
    public function getCategoryDistributionByCompany(int $companyId, string $startDate, string $endDate): array
    {
        $sql = "SELECT a.category, a.name as account_name, SUM(t.amount_base_currency) as total
                FROM {$this->table} t
                INNER JOIN accounts a ON t.account_id = a.id
                WHERE t.company_id = :company_id
                    AND t.date BETWEEN :start_date AND :end_date
                GROUP BY a.category, a.name
                ORDER BY total DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $results = $stmt->fetchAll();
        $total = array_sum(array_column($results, 'total'));

        $distribution = [];
        foreach ($results as $row) {
            $distribution[] = [
                'category' => $row['category'],
                'account_name' => $row['account_name'],
                'total' => (float) $row['total'],
                'percentage' => $total > 0 ? round(($row['total'] / $total) * 100, 2) : 0
            ];
        }

        return $distribution;
    }

    /**
     * Obtener primera fecha de transacción por empresa
     */
    public function getFirstDateByCompany(int $companyId): ?string
    {
        $sql = "SELECT MIN(date) as first_date FROM {$this->table} WHERE company_id = :company_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        $result = $stmt->fetch();
        return $result['first_date'] ?? null;
    }

    /**
     * Obtener última fecha de transacción por empresa
     */
    public function getLastDateByCompany(int $companyId): ?string
    {
        $sql = "SELECT MAX(date) as last_date FROM {$this->table} WHERE company_id = :company_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        $result = $stmt->fetch();
        return $result['last_date'] ?? null;
    }

    // app/Models/Transaction.php - Agregar estos métodos

    /**
     * Obtener todas las transacciones (global - sin filtro de empresa)
     * Para super_admin y admin
     */
    public function getAllGlobal(): array
    {
        $type = $this->table === 'incomes' ? 'income' : 'expense';
        $typeLabel = $this->table === 'incomes' ? 'Ingreso' : 'Egreso';

        $sql = "SELECT t.*, a.name as account_name, a.category, c.name as company_name, '{$type}' as type, '{$typeLabel}' as type_label
            FROM {$this->table} t
            INNER JOIN accounts a ON t.account_id = a.id
            INNER JOIN companies c ON t.company_id = c.id
            ORDER BY t.date DESC, t.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Obtener transacciones por empresa
     * Para usuarios normales
     */
    public function getByCompany(int $companyId): array
    {
        $type = $this->table === 'incomes' ? 'income' : 'expense';
        $typeLabel = $this->table === 'incomes' ? 'Ingreso' : 'Egreso';

        $sql = "SELECT t.*, a.name as account_name, a.category, '{$type}' as type, '{$typeLabel}' as type_label
            FROM {$this->table} t
            INNER JOIN accounts a ON t.account_id = a.id
            WHERE t.company_id = :company_id
            ORDER BY t.date DESC, t.created_at DESC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);

        return $stmt->fetchAll();
    }

    // En app/Models/Transaction.php (ya deberían existir estos métodos)

    /**
     * Obtener transacciones globales con filtros (para super_admin)
     */
    public function getGlobalWithFilters(array $filters = [], ?int $limit = null): array
    {
        $type = $this->table === 'incomes' ? 'income' : 'expense';
        $typeLabel = $this->table === 'incomes' ? 'Ingreso' : 'Egreso';

        $sql = "SELECT t.*, a.name as account_name, a.category, c.name as company_name, 
                   '{$type}' as type, '{$typeLabel}' as type_label
            FROM {$this->table} t
            INNER JOIN accounts a ON t.account_id = a.id
            INNER JOIN companies c ON t.company_id = c.id
            WHERE 1=1";
        $params = [];

        if (!empty($filters['start_date'])) {
            $sql .= " AND t.date >= :start_date";
            $params['start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND t.date <= :end_date";
            $params['end_date'] = $filters['end_date'];
        }

        if (!empty($filters['account_id'])) {
            $sql .= " AND t.account_id = :account_id";
            $params['account_id'] = $filters['account_id'];
        }

        $sql .= " ORDER BY t.date DESC, t.created_at DESC";

        if ($limit) {
            $sql .= " LIMIT :limit";
            $params['limit'] = $limit;
        }

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $paramType = $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($key, $value, $paramType);
        }

        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Obtener transacciones por empresa con filtros
     */
    public function getByCompanyWithFilters(int $companyId, array $filters = [], ?int $limit = null): array
    {
        $type = $this->table === 'incomes' ? 'income' : 'expense';
        $typeLabel = $this->table === 'incomes' ? 'Ingreso' : 'Egreso';

        $sql = "SELECT t.*, a.name as account_name, a.category, 
                   '{$type}' as type, '{$typeLabel}' as type_label
            FROM {$this->table} t
            INNER JOIN accounts a ON t.account_id = a.id
            WHERE t.company_id = :company_id";
        $params = ['company_id' => $companyId];

        if (!empty($filters['start_date'])) {
            $sql .= " AND t.date >= :start_date";
            $params['start_date'] = $filters['start_date'];
        }

        if (!empty($filters['end_date'])) {
            $sql .= " AND t.date <= :end_date";
            $params['end_date'] = $filters['end_date'];
        }

        if (!empty($filters['account_id'])) {
            $sql .= " AND t.account_id = :account_id";
            $params['account_id'] = $filters['account_id'];
        }

        $sql .= " ORDER BY t.date DESC, t.created_at DESC";

        if ($limit) {
            $sql .= " LIMIT :limit";
            $params['limit'] = $limit;
        }

        $stmt = $this->db->prepare($sql);

        foreach ($params as $key => $value) {
            $paramType = $key === 'limit' ? PDO::PARAM_INT : PDO::PARAM_STR;
            $stmt->bindValue($key, $value, $paramType);
        }

        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Obtener total global por período (sin filtrar por empresa)
     */
    public function getTotalByPeriodGlobal(string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount_base_currency), 0) as total 
            FROM {$this->table} 
            WHERE date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }

    public function getTotalGlobal(string $startDate, string $endDate): float
    {
        $sql = "SELECT COALESCE(SUM(amount_base_currency), 0) as total 
            FROM {$this->table} 
            WHERE date BETWEEN :start_date AND :end_date";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $result = $stmt->fetch();
        return (float) ($result['total'] ?? 0);
    }
}
