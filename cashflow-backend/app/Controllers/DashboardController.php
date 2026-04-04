<?php
// app/Controllers/DashboardController.php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use DateTime;
use DateInterval;
use DatePeriod;

class DashboardController
{
    private Income $incomeModel;
    private Expense $expenseModel;
    private Account $accountModel;

    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
    }

    /**
     * GET /api/dashboard/stats
     * Obtener estadísticas principales
     */
    public function getStats(): void
    {
        $userId = $this->getUserId();

        // Obtener parámetros de fecha
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');

        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        // Obtener estadísticas - convertir a float
        $totalIncome = (float) $this->incomeModel->getTotalByPeriod($userId, $startDate, $endDate);
        $totalExpense = (float) $this->expenseModel->getTotalByPeriod($userId, $startDate, $endDate);
        $balance = $totalIncome - $totalExpense;

        // Obtener estadísticas del mes anterior
        $lastMonthStart = date('Y-m-01', strtotime('-1 month', strtotime($startDate)));
        $lastMonthEnd = date('Y-m-t', strtotime('-1 month', strtotime($endDate)));

        $lastMonthIncome = (float) $this->incomeModel->getTotalByPeriod($userId, $lastMonthStart, $lastMonthEnd);
        $lastMonthExpense = (float) $this->expenseModel->getTotalByPeriod($userId, $lastMonthStart, $lastMonthEnd);

        // Calcular porcentajes de cambio
        $incomeChange = $this->calculatePercentageChange($totalIncome, $lastMonthIncome);
        $expenseChange = $this->calculatePercentageChange($totalExpense, $lastMonthExpense);
        $balanceChange = $this->calculatePercentageChange($balance, ($lastMonthIncome - $lastMonthExpense));

        // Obtener totales generales
        $allTimeIncome = (float) $this->incomeModel->getTotalByPeriod($userId, '1970-01-01', date('Y-m-d'));
        $allTimeExpense = (float) $this->expenseModel->getTotalByPeriod($userId, '1970-01-01', date('Y-m-d'));

        Response::success([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'previous_start' => $lastMonthStart,
                'previous_end' => $lastMonthEnd
            ],
            'current_period' => [
                'total_income' => $totalIncome,
                'total_expense' => $totalExpense,
                'balance' => $balance
            ],
            'comparison' => [
                'income_change' => $incomeChange,
                'expense_change' => $expenseChange,
                'balance_change' => $balanceChange
            ],
            'all_time' => [
                'total_income' => $allTimeIncome,
                'total_expense' => $allTimeExpense,
                'balance' => $allTimeIncome - $allTimeExpense
            ]
        ]);
    }

    /**
     * GET /api/dashboard/trends
     * Obtener datos de tendencias
     */
    public function getTrends(): void
    {
        $userId = $this->getUserId();

        $months = (int) ($_GET['months'] ?? 12);
        $months = min(max($months, 1), 24);

        $endDate = new DateTime();
        $startDate = (new DateTime())->modify("-$months months");

        $monthlyData = $this->getMonthlyData($userId, $startDate, $endDate);

        Response::success([
            'labels' => $monthlyData['labels'],
            'income_data' => $monthlyData['income'],
            'expense_data' => $monthlyData['expense'],
            'balance_data' => $monthlyData['balance'],
            'period' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'months' => $months
            ]
        ]);
    }

    /**
     * GET /api/dashboard/category-distribution
     * Obtener distribución por categorías
     */
    public function getCategoryDistribution(): void
    {
        $userId = $this->getUserId();

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $type = $_GET['type'] ?? 'all';

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        $distribution = [];

        if ($type === 'all' || $type === 'income') {
            $distribution['income'] = $this->getIncomeDistribution($userId, $startDate, $endDate);
        }

        if ($type === 'all' || $type === 'expense') {
            $distribution['expense'] = $this->getExpenseDistribution($userId, $startDate, $endDate);
        }

        Response::success([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'distribution' => $distribution
        ]);
    }

    /**
     * GET /api/dashboard/recent-transactions
     * Obtener transacciones recientes
     */
    public function getRecentTransactions(): void
    {
        $userId = $this->getUserId();
        $limit = (int) ($_GET['limit'] ?? 10);
        $limit = min(max($limit, 1), 50);

        $incomes = $this->incomeModel->getWithAccount($userId, [], $limit);
        $expenses = $this->expenseModel->getWithAccount($userId, [], $limit);

        $transactions = array_merge($incomes, $expenses);
        usort($transactions, function ($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });

        $transactions = array_slice($transactions, 0, $limit);

        // Convertir montos a float
        foreach ($transactions as &$transaction) {
            $transaction['amount'] = (float) $transaction['amount'];
        }

        Response::success([
            'transactions' => $transactions,
            'total' => count($transactions),
            'limit' => $limit
        ]);
    }

    /**
     * Obtener datos mensuales para gráficas
     */
    private function getMonthlyData(int $userId, DateTime $startDate, DateTime $endDate): array
    {
        $labels = [];
        $incomeData = [];
        $expenseData = [];
        $balanceData = [];

        $interval = new DateInterval('P1M');
        $period = new DatePeriod($startDate, $interval, $endDate->modify('+1 month'));

        foreach ($period as $date) {
            $monthStart = $date->format('Y-m-01');
            $monthEnd = $date->format('Y-m-t');

            $labels[] = $date->format('M Y');

            $income = (float) $this->incomeModel->getTotalByPeriod($userId, $monthStart, $monthEnd);
            $expense = (float) $this->expenseModel->getTotalByPeriod($userId, $monthStart, $monthEnd);

            $incomeData[] = $income;
            $expenseData[] = $expense;
            $balanceData[] = $income - $expense;
        }

        return [
            'labels' => $labels,
            'income' => $incomeData,
            'expense' => $expenseData,
            'balance' => $balanceData
        ];
    }

    /**
     * Obtener distribución de ingresos por categoría
     */
    private function getIncomeDistribution(int $userId, string $startDate, string $endDate): array
    {
        $sql = "SELECT a.category, a.name, SUM(i.amount) as total
                FROM incomes i
                INNER JOIN accounts a ON i.account_id = a.id
                WHERE i.user_id = :user_id 
                    AND i.date BETWEEN :start_date AND :end_date
                    AND a.type = 'income'
                GROUP BY a.category, a.name
                ORDER BY total DESC";

        $results = $this->incomeModel->query($sql, [
            'user_id' => $userId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $distribution = [];
        $total = array_sum(array_column($results, 'total'));

        foreach ($results as $row) {
            $distribution[] = [
                'category' => $row['category'],
                'account_name' => $row['name'],
                'total' => (float) $row['total'],
                'percentage' => $total > 0 ? round(($row['total'] / $total) * 100, 2) : 0
            ];
        }

        return $distribution;
    }

    /**
     * Obtener distribución de egresos por categoría
     */
    private function getExpenseDistribution(int $userId, string $startDate, string $endDate): array
    {
        $sql = "SELECT a.category, a.name, SUM(e.amount) as total
                FROM expenses e
                INNER JOIN accounts a ON e.account_id = a.id
                WHERE e.user_id = :user_id 
                    AND e.date BETWEEN :start_date AND :end_date
                    AND a.type = 'expense'
                GROUP BY a.category, a.name
                ORDER BY total DESC";

        $results = $this->expenseModel->query($sql, [
            'user_id' => $userId,
            'start_date' => $startDate,
            'end_date' => $endDate
        ]);

        $distribution = [];
        $total = array_sum(array_column($results, 'total'));

        foreach ($results as $row) {
            $distribution[] = [
                'category' => $row['category'],
                'account_name' => $row['name'],
                'total' => (float) $row['total'],
                'percentage' => $total > 0 ? round(($row['total'] / $total) * 100, 2) : 0
            ];
        }

        return $distribution;
    }

    /**
     * Calcular cambio porcentual
     * 
     * @param float|string|int $current
     * @param float|string|int $previous
     * @return float
     */
    private function calculatePercentageChange($current, $previous): float
    {
        // Convertir a float
        $current = (float) $current;
        $previous = (float) $previous;

        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }

        return round((($current - $previous) / abs($previous)) * 100, 2);
    }

    /**
     * Validar formato de fecha
     */
    private function validateDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    /**
     * Obtener ID de usuario autenticado
     */
    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 1);
    }

    /**
     * GET /api/dashboard/stats - PÚBLICO
     * Obtener estadísticas públicas (datos de demostración o agregados)
     */
    public function getPublicStats(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        // Obtener estadísticas por empresa
        $totalIncome = (float) $this->incomeModel->getTotalByCompany($companyId, $startDate, $endDate);
        $totalExpense = (float) $this->expenseModel->getTotalByCompany($companyId, $startDate, $endDate);
        $balance = $totalIncome - $totalExpense;

        // Obtener estadísticas del mes anterior
        $lastMonthStart = date('Y-m-01', strtotime('-1 month', strtotime($startDate)));
        $lastMonthEnd = date('Y-m-t', strtotime('-1 month', strtotime($endDate)));

        $lastMonthIncome = (float) $this->incomeModel->getTotalByCompany($companyId, $lastMonthStart, $lastMonthEnd);
        $lastMonthExpense = (float) $this->expenseModel->getTotalByCompany($companyId, $lastMonthStart, $lastMonthEnd);

        // Calcular porcentajes de cambio
        $incomeChange = $this->calculatePercentageChange($totalIncome, $lastMonthIncome);
        $expenseChange = $this->calculatePercentageChange($totalExpense, $lastMonthExpense);
        $balanceChange = $this->calculatePercentageChange($balance, ($lastMonthIncome - $lastMonthExpense));

        Response::success([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'previous_start' => $lastMonthStart,
                'previous_end' => $lastMonthEnd
            ],
            'current_period' => [
                'total_income' => $totalIncome,
                'total_expense' => $totalExpense,
                'balance' => $balance
            ],
            'comparison' => [
                'income_change' => $incomeChange,
                'expense_change' => $expenseChange,
                'balance_change' => $balanceChange
            ],
            'company_id' => $companyId
        ]);
    }

    /**
     * GET /api/dashboard/trends - PÚBLICO
     */
    public function getPublicTrends(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $months = (int) ($_GET['months'] ?? 12);
        $months = min(max($months, 1), 24);

        $endDate = new DateTime();
        $startDate = (new DateTime())->modify("-$months months");

        $monthlyData = $this->getMonthlyDataByCompany($companyId, $startDate, $endDate);

        Response::success([
            'labels' => $monthlyData['labels'],
            'income_data' => $monthlyData['income'],
            'expense_data' => $monthlyData['expense'],
            'balance_data' => $monthlyData['balance'],
            'period' => [
                'start_date' => $startDate->format('Y-m-d'),
                'end_date' => $endDate->format('Y-m-d'),
                'months' => $months
            ],
            'company_id' => $companyId
        ]);
    }

    /**
     * GET /api/dashboard/category-distribution - PÚBLICO
     */
    public function getPublicCategoryDistribution(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        $distribution = [
            'income' => $this->incomeModel->getCategoryDistributionByCompany($companyId, $startDate, $endDate),
            'expense' => $this->expenseModel->getCategoryDistributionByCompany($companyId, $startDate, $endDate)
        ];

        Response::success([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'distribution' => $distribution,
            'company_id' => $companyId
        ]);
    }

    /**
     * GET /api/dashboard/recent-transactions - PÚBLICO
     */
    public function getPublicRecentTransactions(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $limit = (int) ($_GET['limit'] ?? 10);
        $limit = min(max($limit, 1), 50);

        $incomes = $this->incomeModel->getRecentByCompany($companyId, $limit);
        $expenses = $this->expenseModel->getRecentByCompany($companyId, $limit);

        $transactions = array_merge($incomes, $expenses);
        usort($transactions, function ($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });

        $transactions = array_slice($transactions, 0, $limit);

        Response::success([
            'transactions' => $transactions,
            'total' => count($transactions),
            'limit' => $limit,
            'company_id' => $companyId
        ]);
    }

    private function getMonthlyDataByCompany(int $companyId, DateTime $startDate, DateTime $endDate): array
    {
        $labels = [];
        $incomeData = [];
        $expenseData = [];
        $balanceData = [];

        $interval = new DateInterval('P1M');
        $period = new DatePeriod($startDate, $interval, $endDate->modify('+1 month'));

        foreach ($period as $date) {
            $monthStart = $date->format('Y-m-01');
            $monthEnd = $date->format('Y-m-t');

            $labels[] = $date->format('M Y');

            $income = (float) $this->incomeModel->getTotalByCompany($companyId, $monthStart, $monthEnd);
            $expense = (float) $this->expenseModel->getTotalByCompany($companyId, $monthStart, $monthEnd);

            $incomeData[] = $income;
            $expenseData[] = $expense;
            $balanceData[] = $income - $expense;
        }

        return [
            'labels' => $labels,
            'income' => $incomeData,
            'expense' => $expenseData,
            'balance' => $balanceData
        ];
    }
}
