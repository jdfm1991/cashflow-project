<?php
// app/Controllers/DashboardController.php

declare(strict_types=1);

namespace App\Controllers;

use App\Helpers\Response;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Models\Company;
use DateTime;
use DateInterval;
use DatePeriod;

class DashboardController
{
    private Income $incomeModel;
    private Expense $expenseModel;
    private Account $accountModel;
    private Company $companyModel;

    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
        $this->companyModel = new Company();
    }

    /**
     * GET /api/public/companies
     * Obtener empresas activas para el dashboard público
     * (Ya existe, pero la dejamos para referencia)
     */
    public function getPublicCompanies(): void
    {
        $companies = $this->companyModel->getActiveCompanies();
        
        // Agregar información resumida de cada empresa
        $companiesWithStats = [];
        foreach ($companies as $company) {
            $companiesWithStats[] = [
                'id' => $company['id'],
                'name' => $company['name'],
                'business_name' => $company['business_name'],
                'tax_id' => $company['tax_id'],
                'is_active' => $company['is_active']
            ];
        }
        
        Response::success($companiesWithStats);
    }

    /**
     * GET /api/public/dashboard/stats
     * Estadísticas públicas por empresa (sin autenticación)
     */
    public function getPublicStats(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        // Verificar que la empresa existe y está activa
        $company = $this->companyModel->find($companyId);
        if (!$company || !$company['is_active']) {
            Response::notFound('Empresa no encontrada o inactiva');
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

        // Estadísticas del mes anterior
        $lastMonthStart = date('Y-m-01', strtotime('-1 month', strtotime($startDate)));
        $lastMonthEnd = date('Y-m-t', strtotime('-1 month', strtotime($endDate)));

        $lastMonthIncome = (float) $this->incomeModel->getTotalByCompany($companyId, $lastMonthStart, $lastMonthEnd);
        $lastMonthExpense = (float) $this->expenseModel->getTotalByCompany($companyId, $lastMonthStart, $lastMonthEnd);

        // Totales históricos
        $allTimeIncome = (float) $this->incomeModel->getTotalByCompany($companyId, '1970-01-01', date('Y-m-d'));
        $allTimeExpense = (float) $this->expenseModel->getTotalByCompany($companyId, '1970-01-01', date('Y-m-d'));

        Response::success([
            'company' => [
                'id' => $company['id'],
                'name' => $company['name'],
                'business_name' => $company['business_name']
            ],
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
                'income_change' => $this->calculatePercentageChange($totalIncome, $lastMonthIncome),
                'expense_change' => $this->calculatePercentageChange($totalExpense, $lastMonthExpense),
                'balance_change' => $this->calculatePercentageChange($balance, ($lastMonthIncome - $lastMonthExpense))
            ],
            'all_time' => [
                'total_income' => $allTimeIncome,
                'total_expense' => $allTimeExpense,
                'balance' => $allTimeIncome - $allTimeExpense
            ]
        ]);
    }

    /**
     * GET /api/public/dashboard/trends
     * Tendencias públicas por empresa
     */
    public function getPublicTrends(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $company = $this->companyModel->find($companyId);
        if (!$company || !$company['is_active']) {
            Response::notFound('Empresa no encontrada o inactiva');
            return;
        }

        $months = (int) ($_GET['months'] ?? 12);
        $months = min(max($months, 1), 24);

        $endDate = new DateTime();
        $startDate = (new DateTime())->modify("-$months months");

        $monthlyData = $this->getMonthlyDataByCompany($companyId, $startDate, $endDate);

        Response::success([
            'company' => [
                'id' => $company['id'],
                'name' => $company['name']
            ],
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
     * GET /api/public/dashboard/category-distribution
     * Distribución por categorías pública
     */
    public function getPublicCategoryDistribution(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $company = $this->companyModel->find($companyId);
        if (!$company || !$company['is_active']) {
            Response::notFound('Empresa no encontrada o inactiva');
            return;
        }

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        Response::success([
            'company' => [
                'id' => $company['id'],
                'name' => $company['name']
            ],
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'distribution' => [
                'income' => $this->incomeModel->getCategoryDistributionByCompany($companyId, $startDate, $endDate),
                'expense' => $this->expenseModel->getCategoryDistributionByCompany($companyId, $startDate, $endDate)
            ]
        ]);
    }

    /**
     * GET /api/public/dashboard/recent-transactions
     * Transacciones recientes públicas
     */
    public function getPublicRecentTransactions(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $company = $this->companyModel->find($companyId);
        if (!$company || !$company['is_active']) {
            Response::notFound('Empresa no encontrada o inactiva');
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
            'company' => [
                'id' => $company['id'],
                'name' => $company['name']
            ],
            'transactions' => $transactions,
            'total' => count($transactions),
            'limit' => $limit
        ]);
    }

    /**
     * GET /api/public/dashboard/cashflow
     * Flujo de caja público
     */
    public function getPublicCashFlow(): void
    {
        $companyId = (int) ($_GET['company_id'] ?? 0);

        if ($companyId <= 0) {
            Response::error('Debe seleccionar una empresa', 400);
            return;
        }

        $company = $this->companyModel->find($companyId);
        if (!$company || !$company['is_active']) {
            Response::notFound('Empresa no encontrada o inactiva');
            return;
        }

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $groupBy = $_GET['group_by'] ?? 'month';

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        // Generar períodos
        $periods = $this->getDatePeriods($startDate, $endDate, $groupBy);
        $cashFlowData = [];

        foreach ($periods as $period) {
            $income = (float) $this->incomeModel->getTotalByCompany($companyId, $period['start'], $period['end']);
            $expense = (float) $this->expenseModel->getTotalByCompany($companyId, $period['start'], $period['end']);
            $netCashFlow = $income - $expense;
            
            $cashFlowData[] = [
                'period_label' => $period['label'],
                'start_date' => $period['start'],
                'end_date' => $period['end'],
                'income' => $income,
                'expense' => $expense,
                'net_cash_flow' => $netCashFlow
            ];
        }

        // Calcular acumulado
        $cumulative = 0;
        foreach ($cashFlowData as &$period) {
            $cumulative += $period['net_cash_flow'];
            $period['cumulative'] = $cumulative;
        }

        Response::success([
            'company' => [
                'id' => $company['id'],
                'name' => $company['name']
            ],
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'group_by' => $groupBy
            ],
            'cash_flow' => $cashFlowData,
            'summary' => $this->calculateCashFlowSummary($cashFlowData)
        ]);
    }

    /**
     * GET /api/dashboard/stats (autenticado)
     * Estadísticas para usuarios autenticados
     */
    public function getStats(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $filterCompanyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : null;

        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');

        // Determinar qué empresa mostrar
        $targetCompanyId = null;
        if ($userRole === 'super_admin' && $filterCompanyId) {
            $targetCompanyId = $filterCompanyId;
        } else {
            $targetCompanyId = $companyId;
        }

        if ($targetCompanyId) {
            $company = $this->companyModel->find($targetCompanyId);
            if (!$company) {
                Response::notFound('Empresa no encontrada');
                return;
            }
        }

        // Obtener estadísticas
        if ($userRole === 'super_admin' && !$filterCompanyId) {
            // Super admin viendo todas las empresas
            $totalIncome = (float) $this->incomeModel->getTotalGlobal($startDate, $endDate);
            $totalExpense = (float) $this->expenseModel->getTotalGlobal($startDate, $endDate);
            
            $lastMonthStart = date('Y-m-01', strtotime('-1 month', strtotime($startDate)));
            $lastMonthEnd = date('Y-m-t', strtotime('-1 month', strtotime($endDate)));
            $lastMonthIncome = (float) $this->incomeModel->getTotalGlobal($lastMonthStart, $lastMonthEnd);
            $lastMonthExpense = (float) $this->expenseModel->getTotalGlobal($lastMonthStart, $lastMonthEnd);
            
            $allTimeIncome = (float) $this->incomeModel->getTotalGlobal('1970-01-01', date('Y-m-d'));
            $allTimeExpense = (float) $this->expenseModel->getTotalGlobal('1970-01-01', date('Y-m-d'));
        } else {
            // Empresa específica
            $totalIncome = (float) $this->incomeModel->getTotalByCompany($targetCompanyId, $startDate, $endDate);
            $totalExpense = (float) $this->expenseModel->getTotalByCompany($targetCompanyId, $startDate, $endDate);
            
            $lastMonthStart = date('Y-m-01', strtotime('-1 month', strtotime($startDate)));
            $lastMonthEnd = date('Y-m-t', strtotime('-1 month', strtotime($endDate)));
            $lastMonthIncome = (float) $this->incomeModel->getTotalByCompany($targetCompanyId, $lastMonthStart, $lastMonthEnd);
            $lastMonthExpense = (float) $this->expenseModel->getTotalByCompany($targetCompanyId, $lastMonthStart, $lastMonthEnd);
            
            $allTimeIncome = (float) $this->incomeModel->getTotalByCompany($targetCompanyId, '1970-01-01', date('Y-m-d'));
            $allTimeExpense = (float) $this->expenseModel->getTotalByCompany($targetCompanyId, '1970-01-01', date('Y-m-d'));
        }

        $balance = $totalIncome - $totalExpense;

        Response::success([
            'company' => $targetCompanyId ? [
                'id' => $targetCompanyId,
                'name' => $company['name'] ?? 'Todas las empresas'
            ] : null,
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
                'income_change' => $this->calculatePercentageChange($totalIncome, $lastMonthIncome),
                'expense_change' => $this->calculatePercentageChange($totalExpense, $lastMonthExpense),
                'balance_change' => $this->calculatePercentageChange($balance, ($lastMonthIncome - $lastMonthExpense))
            ],
            'all_time' => [
                'total_income' => $allTimeIncome,
                'total_expense' => $allTimeExpense,
                'balance' => $allTimeIncome - $allTimeExpense
            ]
        ]);
    }

    // Métodos auxiliares (ya existentes)
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

    private function getDatePeriods(string $startDate, string $endDate, string $groupBy): array
    {
        $periods = [];
        $current = new DateTime($startDate);
        $end = new DateTime($endDate);
        
        switch ($groupBy) {
            case 'week':
                while ($current <= $end) {
                    $weekStart = clone $current;
                    $weekEnd = clone $current;
                    $weekEnd->modify('+6 days');
                    if ($weekEnd > $end) $weekEnd = clone $end;
                    
                    $periods[] = [
                        'label' => 'Semana ' . $weekStart->format('W') . ' (' . $weekStart->format('d/m') . ' - ' . $weekEnd->format('d/m') . ')',
                        'start' => $weekStart->format('Y-m-d'),
                        'end' => $weekEnd->format('Y-m-d')
                    ];
                    $current->modify('+7 days');
                }
                break;
                
            case 'month':
                while ($current <= $end) {
                    $monthStart = clone $current;
                    $monthStart->modify('first day of this month');
                    $monthEnd = clone $current;
                    $monthEnd->modify('last day of this month');
                    if ($monthEnd > $end) $monthEnd = clone $end;
                    
                    $periods[] = [
                        'label' => $current->format('M Y'),
                        'start' => $monthStart->format('Y-m-d'),
                        'end' => $monthEnd->format('Y-m-d')
                    ];
                    $current->modify('+1 month');
                }
                break;
                
            case 'quarter':
                while ($current <= $end) {
                    $quarter = ceil($current->format('n') / 3);
                    $year = $current->format('Y');
                    $periods[] = [
                        'label' => "Q{$quarter} {$year}",
                        'start' => date('Y-m-d', strtotime("{$year}-" . (($quarter - 1) * 3 + 1) . "-01")),
                        'end' => date('Y-m-t', strtotime("{$year}-" . ($quarter * 3) . "-01"))
                    ];
                    $current->modify('+3 months');
                }
                break;
                
            case 'year':
                while ($current <= $end) {
                    $year = $current->format('Y');
                    $periods[] = [
                        'label' => "Año {$year}",
                        'start' => "{$year}-01-01",
                        'end' => "{$year}-12-31"
                    ];
                    $current->modify('+1 year');
                }
                break;
                
            default:
                while ($current <= $end) {
                    $periods[] = [
                        'label' => $current->format('d/m/Y'),
                        'start' => $current->format('Y-m-d'),
                        'end' => $current->format('Y-m-d')
                    ];
                    $current->modify('+1 day');
                }
                break;
        }
        
        return $periods;
    }

    private function calculateCashFlowSummary(array $cashFlowData): array
    {
        if (empty($cashFlowData)) {
            return [];
        }

        $totalIncome = array_sum(array_column($cashFlowData, 'income'));
        $totalExpense = array_sum(array_column($cashFlowData, 'expense'));
        $totalNet = $totalIncome - $totalExpense;
        $finalCumulative = end($cashFlowData)['cumulative'] ?? 0;

        // Encontrar mejor y peor período
        $bestPeriod = $cashFlowData[0];
        $worstPeriod = $cashFlowData[0];
        foreach ($cashFlowData as $period) {
            if ($period['net_cash_flow'] > $bestPeriod['net_cash_flow']) $bestPeriod = $period;
            if ($period['net_cash_flow'] < $worstPeriod['net_cash_flow']) $worstPeriod = $period;
        }

        return [
            'total_income' => $totalIncome,
            'total_expense' => $totalExpense,
            'total_net' => $totalNet,
            'final_cumulative' => $finalCumulative,
            'best_period' => [
                'label' => $bestPeriod['period_label'],
                'net_cash_flow' => $bestPeriod['net_cash_flow']
            ],
            'worst_period' => [
                'label' => $worstPeriod['period_label'],
                'net_cash_flow' => $worstPeriod['net_cash_flow']
            ]
        ];
    }

    private function calculatePercentageChange($current, $previous): float
    {
        $current = (float) $current;
        $previous = (float) $previous;

        if ($previous == 0) {
            return $current > 0 ? 100 : 0;
        }

        return round((($current - $previous) / abs($previous)) * 100, 2);
    }

    private function validateDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }

    private function getUserId(): int
    {
        if (isset($_REQUEST['user_id']) && !empty($_REQUEST['user_id'])) {
            return (int) $_REQUEST['user_id'];
        }

        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            try {
                $jwtService = new \App\Services\JWTService();
                $payload = $jwtService->validate($matches[1]);
                if ($payload && isset($payload['user_id'])) {
                    return (int) $payload['user_id'];
                }
            } catch (\Exception $e) {
                // Error al validar token
            }
        }

        return 0;
    }

    private function getCompanyId(int $userId): int
    {
        if ($userId <= 0) {
            return 0;
        }

        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['company_id'] ?? 0;
    }

    private function getUserRole(int $userId): string
    {
        if ($userId <= 0) {
            return 'guest';
        }

        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['role'] ?? 'user';
    }
}