<?php
declare(strict_types=1);

/**
 * Servicio de Reportes
 * 
 * Genera reportes en diferentes formatos (Excel, PDF, CSV) y
 * maneja la lógica de negocio para la generación de informes.
 * 
 * @package App\Services
 */

namespace App\Services;

use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use DateTime;
use DateInterval;
use DatePeriod;

class ReportService
{
    /**
     * Modelo de ingresos
     * @var Income
     */
    private Income $incomeModel;
    
    /**
     * Modelo de egresos
     * @var Expense
     */
    private Expense $expenseModel;
    
    /**
     * Modelo de cuentas
     * @var Account
     */
    private Account $accountModel;
    
    /**
     * Constructor - Inicializa modelos
     */
    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
    }
    
    /**
     * Generar reporte de flujo de caja
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $groupBy
     * @return array
     */
    public function generateCashFlowReport(int $userId, string $startDate, string $endDate, string $groupBy = 'month'): array
    {
        $data = [];
        $current = new DateTime($startDate);
        $end = new DateTime($endDate);
        
        $interval = match ($groupBy) {
            'day' => new DateInterval('P1D'),
            'week' => new DateInterval('P1W'),
            'month' => new DateInterval('P1M'),
            'year' => new DateInterval('P1Y'),
            default => new DateInterval('P1M')
        };
        
        $period = new DatePeriod($current, $interval, $end->modify('+1 ' . $groupBy));
        
        foreach ($period as $date) {
            $periodStart = $date->format('Y-m-d');
            $periodEnd = $this->getPeriodEnd($date, $groupBy);
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $periodStart, $periodEnd);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $periodStart, $periodEnd);
            
            $data[] = [
                'period' => $this->formatPeriodLabel($date, $groupBy),
                'start_date' => $periodStart,
                'end_date' => $periodEnd,
                'income' => round($income, 2),
                'expense' => round($expense, 2),
                'balance' => round($income - $expense, 2),
                'cash_flow' => round($income - $expense, 2)
            ];
        }
        
        // Calcular totales
        $totalIncome = array_sum(array_column($data, 'income'));
        $totalExpense = array_sum(array_column($data, 'expense'));
        
        return [
            'data' => $data,
            'summary' => [
                'total_income' => round($totalIncome, 2),
                'total_expense' => round($totalExpense, 2),
                'net_cash_flow' => round($totalIncome - $totalExpense, 2),
                'period_count' => count($data)
            ]
        ];
    }
    
    /**
     * Generar reporte detallado de transacciones
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $type
     * @param int|null $accountId
     * @param string|null $category
     * @return array
     */
    public function generateTransactionReport(int $userId, string $startDate, string $endDate, string $type = 'all', ?int $accountId = null, ?string $category = null): array
    {
        $transactions = [];
        
        if ($type === 'all' || $type === 'income') {
            $incomes = $this->incomeModel->getWithAccount($userId, [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'account_id' => $accountId,
                'category' => $category
            ]);
            
            foreach ($incomes as $income) {
                $transactions[] = [
                    'id' => $income['id'],
                    'date' => $income['date'],
                    'type' => 'income',
                    'type_label' => 'Ingreso',
                    'account_id' => $income['account_id'],
                    'account_name' => $income['account_name'],
                    'category' => $income['category'],
                    'description' => $income['description'],
                    'amount' => round($income['amount'], 2),
                    'reference' => $income['reference'] ?? null
                ];
            }
        }
        
        if ($type === 'all' || $type === 'expense') {
            $expenses = $this->expenseModel->getWithAccount($userId, [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'account_id' => $accountId,
                'category' => $category
            ]);
            
            foreach ($expenses as $expense) {
                $transactions[] = [
                    'id' => $expense['id'],
                    'date' => $expense['date'],
                    'type' => 'expense',
                    'type_label' => 'Egreso',
                    'account_id' => $expense['account_id'],
                    'account_name' => $expense['account_name'],
                    'category' => $expense['category'],
                    'description' => $expense['description'],
                    'amount' => round($expense['amount'], 2),
                    'reference' => $expense['reference'] ?? null
                ];
            }
        }
        
        // Ordenar por fecha descendente
        usort($transactions, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        // Calcular totales
        $totalIncome = array_sum(array_filter(array_column($transactions, 'amount'), function($amount, $key) use ($transactions) {
            return $transactions[$key]['type'] === 'income';
        }, ARRAY_FILTER_USE_BOTH));
        
        $totalExpense = array_sum(array_filter(array_column($transactions, 'amount'), function($amount, $key) use ($transactions) {
            return $transactions[$key]['type'] === 'expense';
        }, ARRAY_FILTER_USE_BOTH));
        
        return [
            'transactions' => $transactions,
            'summary' => [
                'total_income' => round($totalIncome, 2),
                'total_expense' => round($totalExpense, 2),
                'balance' => round($totalIncome - $totalExpense, 2),
                'total_transactions' => count($transactions)
            ]
        ];
    }
    
    /**
     * Generar reporte por categorías
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $type
     * @return array
     */
    public function generateCategoryReport(int $userId, string $startDate, string $endDate, string $type = 'all'): array
    {
        $categories = [];
        
        if ($type === 'all' || $type === 'income') {
            $incomeCategories = $this->incomeModel->getCategorySummary($userId, $startDate, $endDate);
            $categories['income'] = $incomeCategories;
        }
        
        if ($type === 'all' || $type === 'expense') {
            $expenseCategories = $this->expenseModel->getCategorySummary($userId, $startDate, $endDate);
            $categories['expense'] = $expenseCategories;
        }
        
        return $categories;
    }
    
    /**
     * Generar reporte de cuentas
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $accountType
     * @return array
     */
    public function generateAccountReport(int $userId, string $startDate, string $endDate, string $accountType = 'all'): array
    {
        $accounts = $this->accountModel->getByUser($userId);
        $report = [];
        
        foreach ($accounts as $account) {
            if ($accountType !== 'all' && $account['type'] !== $accountType) {
                continue;
            }
            
            if ($account['type'] === 'income') {
                $total = $this->incomeModel->getTotalByAccount($userId, $account['id'], $startDate, $endDate);
                $count = $this->incomeModel->countByAccount($userId, $account['id'], $startDate, $endDate);
            } else {
                $total = $this->expenseModel->getTotalByAccount($userId, $account['id'], $startDate, $endDate);
                $count = $this->expenseModel->countByAccount($userId, $account['id'], $startDate, $endDate);
            }
            
            $report[] = [
                'id' => $account['id'],
                'name' => $account['name'],
                'type' => $account['type'],
                'type_label' => $account['type'] === 'income' ? 'Ingreso' : 'Egreso',
                'category' => $account['category'],
                'total' => round($total, 2),
                'transaction_count' => $count,
                'average' => $count > 0 ? round($total / $count, 2) : 0
            ];
        }
        
        return $report;
    }
    
    /**
     * Generar reporte comparativo mensual
     * 
     * @param int $userId
     * @param int $year
     * @param int $months
     * @return array
     */
    public function generateMonthlyComparison(int $userId, int $year, int $months = 12): array
    {
        $comparison = [];
        $startMonth = max(1, 13 - $months);
        
        for ($month = $startMonth; $month <= 12; $month++) {
            $monthStart = sprintf('%04d-%02d-01', $year, $month);
            $monthEnd = date('Y-m-t', strtotime($monthStart));
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $monthStart, $monthEnd);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $monthStart, $monthEnd);
            
            // Datos del año anterior
            $prevYear = $year - 1;
            $prevMonthStart = sprintf('%04d-%02d-01', $prevYear, $month);
            $prevMonthEnd = date('Y-m-t', strtotime($prevMonthStart));
            
            $prevIncome = $this->incomeModel->getTotalByPeriod($userId, $prevMonthStart, $prevMonthEnd);
            $prevExpense = $this->expenseModel->getTotalByPeriod($userId, $prevMonthStart, $prevMonthEnd);
            
            $comparison[] = [
                'month' => $month,
                'month_name' => date('F', mktime(0, 0, 0, $month, 1)),
                'year' => $year,
                'income' => round($income, 2),
                'expense' => round($expense, 2),
                'balance' => round($income - $expense, 2),
                'previous_year' => [
                    'income' => round($prevIncome, 2),
                    'expense' => round($prevExpense, 2),
                    'balance' => round($prevIncome - $prevExpense, 2)
                ],
                'growth' => [
                    'income' => $this->calculatePercentageChange($income, $prevIncome),
                    'expense' => $this->calculatePercentageChange($expense, $prevExpense),
                    'balance' => $this->calculatePercentageChange($income - $expense, $prevIncome - $prevExpense)
                ]
            ];
        }
        
        return $comparison;
    }
    
    /**
     * Generar resumen diario
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @return array
     */
    public function generateDailySummary(int $userId, string $startDate, string $endDate): array
    {
        $summary = [];
        $current = new DateTime($startDate);
        $end = new DateTime($endDate);
        
        while ($current <= $end) {
            $date = $current->format('Y-m-d');
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $date, $date);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $date, $date);
            
            $summary[] = [
                'date' => $date,
                'day_of_week' => $current->format('l'),
                'day_name' => $this->getDayName($current->format('N')),
                'income' => round($income, 2),
                'expense' => round($expense, 2),
                'balance' => round($income - $expense, 2)
            ];
            
            $current->modify('+1 day');
        }
        
        return $summary;
    }
    
    /**
     * Generar resumen anual
     * 
     * @param int $userId
     * @param int $startYear
     * @param int $endYear
     * @return array
     */
    public function generateYearlySummary(int $userId, int $startYear, int $endYear): array
    {
        $summary = [];
        
        for ($year = $startYear; $year <= $endYear; $year++) {
            $yearStart = sprintf('%04d-01-01', $year);
            $yearEnd = sprintf('%04d-12-31', $year);
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $yearStart, $yearEnd);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $yearStart, $yearEnd);
            
            $summary[] = [
                'year' => $year,
                'income' => round($income, 2),
                'expense' => round($expense, 2),
                'balance' => round($income - $expense, 2),
                'avg_monthly_income' => round($income / 12, 2),
                'avg_monthly_expense' => round($expense / 12, 2)
            ];
        }
        
        return $summary;
    }
    
    /**
     * Obtener el final del período según agrupación
     * 
     * @param DateTime $date
     * @param string $groupBy
     * @return string
     */
    private function getPeriodEnd(DateTime $date, string $groupBy): string
    {
        return match ($groupBy) {
            'day' => $date->format('Y-m-d'),
            'week' => $date->modify('+6 days')->format('Y-m-d'),
            'month' => $date->format('Y-m-t'),
            'year' => $date->format('Y-12-31'),
            default => $date->format('Y-m-t')
        };
    }
    
    /**
     * Formatear etiqueta del período
     * 
     * @param DateTime $date
     * @param string $groupBy
     * @return string
     */
    private function formatPeriodLabel(DateTime $date, string $groupBy): string
    {
        return match ($groupBy) {
            'day' => $date->format('d/m/Y'),
            'week' => 'Semana ' . $date->format('W') . ' (' . $date->format('d/m') . ')',
            'month' => $date->format('F Y'),
            'year' => $date->format('Y'),
            default => $date->format('F Y')
        };
    }
    
    /**
     * Obtener nombre del día
     * 
     * @param string $dayNumber
     * @return string
     */
    private function getDayName(string $dayNumber): string
    {
        $days = [
            '1' => 'Lunes',
            '2' => 'Martes',
            '3' => 'Miércoles',
            '4' => 'Jueves',
            '5' => 'Viernes',
            '6' => 'Sábado',
            '7' => 'Domingo'
        ];
        
        return $days[$dayNumber] ?? '';
    }
    
    /**
     * Calcular cambio porcentual
     * 
     * @param float $current
     * @param float $previous
     * @return float
     */
    private function calculatePercentageChange(float $current, float $previous): float
    {
        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }
        
        return round((($current - $previous) / abs($previous)) * 100, 2);
    }
}