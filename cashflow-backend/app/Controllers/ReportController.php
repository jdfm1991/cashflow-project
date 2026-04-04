<?php
declare(strict_types=1);

/**
 * Controlador de Reportes
 * 
 * Maneja la generación de reportes en diferentes formatos (Excel, PDF, CSV)
 * para el análisis de datos financieros del sistema de flujo de caja.
 * 
 * @package App\Controllers
 */

namespace App\Controllers;

use App\Helpers\Response;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Models\Category;
use App\Services\ExcelService;
use App\Services\PDFService;
use DateTime;
use DateInterval;
use DatePeriod;

class ReportController
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
     * Modelo de categorías
     * @var Category
     */
    private Category $categoryModel;
    
    /**
     * Servicio de Excel
     * @var ExcelService
     */
    private ExcelService $excelService;
    
    /**
     * Servicio de PDF
     * @var PDFService
     */
    private PDFService $pdfService;
    
    /**
     * Constructor - Inicializa modelos y servicios
     */
    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
        $this->categoryModel = new Category();
        $this->excelService = new ExcelService();
        $this->pdfService = new PDFService();
    }
    
    /**
     * GET /api/reports/cash-flow
     * 
     * Generar reporte de flujo de caja en formato JSON
     * 
     * @return void
     */
    public function cashFlow(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $groupBy = $_GET['group_by'] ?? 'month'; // day, week, month, year
        
        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');
        
        // Obtener datos de flujo de caja
        $cashFlow = $this->getCashFlowData($userId, $startDate, $endDate, $groupBy);
        
        // Calcular resumen
        $summary = $this->calculateCashFlowSummary($userId, $startDate, $endDate);
        
        Response::success([
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'group_by' => $groupBy
            ],
            'summary' => $summary,
            'data' => $cashFlow,
            'generated_at' => date('Y-m-d H:i:s')
        ]);
    }
    
    /**
     * GET /api/reports/transactions
     * 
     * Generar reporte detallado de transacciones
     * 
     * @return void
     */
    public function transactionReport(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $type = $_GET['type'] ?? 'all'; // all, income, expense
        $accountId = $_GET['account_id'] ?? null;
        $category = $_GET['category'] ?? null;
        $format = $_GET['format'] ?? 'json'; // json, excel, pdf, csv
        
        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');
        
        // Obtener transacciones
        $transactions = $this->getFilteredTransactions($userId, $startDate, $endDate, $type, $accountId, $category);
        
        // Calcular totales
        $totals = $this->calculateTransactionTotals($transactions);
        
        $reportData = [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'filters' => [
                'type' => $type,
                'account_id' => $accountId,
                'category' => $category
            ],
            'totals' => $totals,
            'transactions' => $transactions,
            'total_records' => count($transactions),
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportTransactions($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportTransactions($reportData);
                break;
            case 'csv':
                $this->exportAsCsv($transactions);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/accounts
     * 
     * Generar reporte de cuentas con movimientos
     * 
     * @return void
     */
    public function accountReport(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $accountType = $_GET['account_type'] ?? 'all'; // all, income, expense
        $format = $_GET['format'] ?? 'json';
        
        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');
        
        // Obtener cuentas con movimientos
        $accounts = $this->getAccountsWithMovements($userId, $startDate, $endDate, $accountType);
        
        $reportData = [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'accounts' => $accounts,
            'total_accounts' => count($accounts),
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportAccounts($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportAccounts($reportData);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/categories
     * 
     * Generar reporte por categorías
     * 
     * @return void
     */
    public function categoryReport(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $type = $_GET['type'] ?? 'all'; // all, income, expense
        $format = $_GET['format'] ?? 'json';
        
        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');
        
        // Obtener datos por categoría
        $categories = $this->getCategoryData($userId, $startDate, $endDate, $type);
        
        $reportData = [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'categories' => $categories,
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportCategories($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportCategories($reportData);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/daily-summary
     * 
     * Generar resumen diario de movimientos
     * 
     * @return void
     */
    public function dailySummary(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startDate = $_GET['start_date'] ?? date('Y-m-01');
        $endDate = $_GET['end_date'] ?? date('Y-m-t');
        $format = $_GET['format'] ?? 'json';
        
        // Validar fechas
        $startDate = $this->validateDate($startDate) ? $startDate : date('Y-m-01');
        $endDate = $this->validateDate($endDate) ? $endDate : date('Y-m-t');
        
        // Obtener resumen diario
        $dailySummary = $this->getDailySummary($userId, $startDate, $endDate);
        
        $reportData = [
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate
            ],
            'daily_summary' => $dailySummary,
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportDailySummary($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportDailySummary($reportData);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/monthly-comparison
     * 
     * Comparación mensual de ingresos y egresos
     * 
     * @return void
     */
    public function monthlyComparison(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $year = (int) ($_GET['year'] ?? date('Y'));
        $months = (int) ($_GET['months'] ?? 12);
        $format = $_GET['format'] ?? 'json';
        
        // Limitar meses
        $months = min(max($months, 1), 24);
        
        // Obtener comparación mensual
        $comparison = $this->getMonthlyComparison($userId, $year, $months);
        
        $reportData = [
            'year' => $year,
            'months_compared' => $months,
            'comparison' => $comparison,
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportMonthlyComparison($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportMonthlyComparison($reportData);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/yearly-summary
     * 
     * Resumen anual por año
     * 
     * @return void
     */
    public function yearlySummary(): void
    {
        $userId = $this->getUserId();
        
        // Obtener parámetros
        $startYear = (int) ($_GET['start_year'] ?? date('Y') - 5);
        $endYear = (int) ($_GET['end_year'] ?? date('Y'));
        $format = $_GET['format'] ?? 'json';
        
        // Validar años
        $startYear = min(max($startYear, 2000), date('Y'));
        $endYear = min(max($endYear, $startYear), date('Y'));
        
        // Obtener resumen anual
        $yearlySummary = $this->getYearlySummary($userId, $startYear, $endYear);
        
        $reportData = [
            'period' => [
                'start_year' => $startYear,
                'end_year' => $endYear
            ],
            'yearly_summary' => $yearlySummary,
            'generated_at' => date('Y-m-d H:i:s')
        ];
        
        // Exportar según formato solicitado
        switch ($format) {
            case 'excel':
                $this->excelService->exportYearlySummary($reportData);
                break;
            case 'pdf':
                $this->pdfService->exportYearlySummary($reportData);
                break;
            default:
                Response::success($reportData);
        }
    }
    
    /**
     * GET /api/reports/export-excel
     * 
     * Exportar reporte completo a Excel (formato antiguo, mantener compatibilidad)
     * 
     * @return void
     */
    public function exportExcel(): void
    {
        $this->transactionReport();
    }
    
    /**
     * GET /api/reports/export-pdf
     * 
     * Exportar reporte completo a PDF (formato antiguo, mantener compatibilidad)
     * 
     * @return void
     */
    public function exportPdf(): void
    {
        $this->transactionReport();
    }
    
    /**
     * Obtener datos de flujo de caja agrupados
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $groupBy
     * @return array
     */
    private function getCashFlowData(int $userId, string $startDate, string $endDate, string $groupBy): array
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
                'income' => (float) $income,
                'expense' => (float) $expense,
                'balance' => (float) ($income - $expense),
                'cash_flow' => (float) ($income - $expense)
            ];
        }
        
        return $data;
    }
    
    /**
     * Calcular resumen de flujo de caja
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @return array
     */
    private function calculateCashFlowSummary(int $userId, string $startDate, string $endDate): array
    {
        $totalIncome = $this->incomeModel->getTotalByPeriod($userId, $startDate, $endDate);
        $totalExpense = $this->expenseModel->getTotalByPeriod($userId, $startDate, $endDate);
        
        // Calcular promedio diario
        $days = (strtotime($endDate) - strtotime($startDate)) / 86400 + 1;
        $avgDailyIncome = $totalIncome / $days;
        $avgDailyExpense = $totalExpense / $days;
        
        return [
            'total_income' => (float) $totalIncome,
            'total_expense' => (float) $totalExpense,
            'net_cash_flow' => (float) ($totalIncome - $totalExpense),
            'avg_daily_income' => round($avgDailyIncome, 2),
            'avg_daily_expense' => round($avgDailyExpense, 2),
            'transaction_days' => $days
        ];
    }
    
    /**
     * Obtener transacciones filtradas
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $type
     * @param int|null $accountId
     * @param string|null $category
     * @return array
     */
    private function getFilteredTransactions(int $userId, string $startDate, string $endDate, string $type, ?int $accountId, ?string $category): array
    {
        $transactions = [];
        
        if ($type === 'all' || $type === 'income') {
            $incomes = $this->incomeModel->getWithAccount($userId, [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'account_id' => $accountId
            ]);
            
            foreach ($incomes as $income) {
                if (!$category || $income['category'] === $category) {
                    $transactions[] = [
                        'id' => $income['id'],
                        'date' => $income['date'],
                        'type' => 'income',
                        'type_label' => 'Ingreso',
                        'account_id' => $income['account_id'],
                        'account_name' => $income['account_name'],
                        'category' => $income['category'],
                        'description' => $income['description'],
                        'amount' => (float) $income['amount'],
                        'reference' => $income['reference'] ?? null
                    ];
                }
            }
        }
        
        if ($type === 'all' || $type === 'expense') {
            $expenses = $this->expenseModel->getWithAccount($userId, [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'account_id' => $accountId
            ]);
            
            foreach ($expenses as $expense) {
                if (!$category || $expense['category'] === $category) {
                    $transactions[] = [
                        'id' => $expense['id'],
                        'date' => $expense['date'],
                        'type' => 'expense',
                        'type_label' => 'Egreso',
                        'account_id' => $expense['account_id'],
                        'account_name' => $expense['account_name'],
                        'category' => $expense['category'],
                        'description' => $expense['description'],
                        'amount' => (float) $expense['amount'],
                        'reference' => $expense['reference'] ?? null
                    ];
                }
            }
        }
        
        // Ordenar por fecha descendente
        usort($transactions, function($a, $b) {
            return strtotime($b['date']) - strtotime($a['date']);
        });
        
        return $transactions;
    }
    
    /**
     * Calcular totales de transacciones
     * 
     * @param array $transactions
     * @return array
     */
    private function calculateTransactionTotals(array $transactions): array
    {
        $totalIncome = 0;
        $totalExpense = 0;
        
        foreach ($transactions as $transaction) {
            if ($transaction['type'] === 'income') {
                $totalIncome += $transaction['amount'];
            } else {
                $totalExpense += $transaction['amount'];
            }
        }
        
        return [
            'total_income' => round($totalIncome, 2),
            'total_expense' => round($totalExpense, 2),
            'balance' => round($totalIncome - $totalExpense, 2),
            'transaction_count' => count($transactions)
        ];
    }
    
    /**
     * Obtener cuentas con movimientos
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $accountType
     * @return array
     */
    private function getAccountsWithMovements(int $userId, string $startDate, string $endDate, string $accountType): array
    {
        $accounts = $this->accountModel->getByUser($userId);
        $result = [];
        
        foreach ($accounts as $account) {
            if ($accountType !== 'all' && $account['type'] !== $accountType) {
                continue;
            }
            
            $totalIncome = 0;
            $totalExpense = 0;
            
            if ($account['type'] === 'income') {
                $totalIncome = $this->incomeModel->getTotalByAccount($userId, $account['id'], $startDate, $endDate);
            } else {
                $totalExpense = $this->expenseModel->getTotalByAccount($userId, $account['id'], $startDate, $endDate);
            }
            
            $result[] = [
                'id' => $account['id'],
                'name' => $account['name'],
                'type' => $account['type'],
                'type_label' => $account['type'] === 'income' ? 'Ingreso' : 'Egreso',
                'category' => $account['category'],
                'total_income' => round($totalIncome, 2),
                'total_expense' => round($totalExpense, 2),
                'balance' => round($totalIncome - $totalExpense, 2),
                'transaction_count' => $this->getTransactionCountByAccount($userId, $account['id'], $startDate, $endDate)
            ];
        }
        
        // Filtrar cuentas sin movimientos si se solicita
        if (isset($_GET['show_inactive']) && $_GET['show_inactive'] === 'false') {
            $result = array_filter($result, function($account) {
                return $account['transaction_count'] > 0;
            });
        }
        
        return array_values($result);
    }
    
    /**
     * Obtener conteo de transacciones por cuenta
     * 
     * @param int $userId
     * @param int $accountId
     * @param string $startDate
     * @param string $endDate
     * @return int
     */
    private function getTransactionCountByAccount(int $userId, int $accountId, string $startDate, string $endDate): int
    {
        $incomeCount = $this->incomeModel->countByAccount($userId, $accountId, $startDate, $endDate);
        $expenseCount = $this->expenseModel->countByAccount($userId, $accountId, $startDate, $endDate);
        
        return $incomeCount + $expenseCount;
    }
    
    /**
     * Obtener datos por categoría
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @param string $type
     * @return array
     */
    private function getCategoryData(int $userId, string $startDate, string $endDate, string $type): array
    {
        $categories = $this->categoryModel->getAll($userId);
        $result = [];
        
        foreach ($categories as $category) {
            if ($type !== 'all' && $category['type'] !== $type) {
                continue;
            }
            
            $totalAmount = 0;
            $transactionCount = 0;
            
            if ($category['type'] === 'income') {
                $totalAmount = $this->incomeModel->getTotalByCategory($userId, $category['name'], $startDate, $endDate);
                $transactionCount = $this->incomeModel->countByCategory($userId, $category['name'], $startDate, $endDate);
            } else {
                $totalAmount = $this->expenseModel->getTotalByCategory($userId, $category['name'], $startDate, $endDate);
                $transactionCount = $this->expenseModel->countByCategory($userId, $category['name'], $startDate, $endDate);
            }
            
            if ($totalAmount > 0 || $transactionCount > 0) {
                $result[] = [
                    'id' => $category['id'],
                    'name' => $category['name'],
                    'type' => $category['type'],
                    'type_label' => $category['type'] === 'income' ? 'Ingreso' : 'Egreso',
                    'icon' => $category['icon'],
                    'color' => $category['color'],
                    'total_amount' => round($totalAmount, 2),
                    'transaction_count' => $transactionCount,
                    'is_system' => (bool) $category['is_system']
                ];
            }
        }
        
        // Ordenar por total_amount descendente
        usort($result, function($a, $b) {
            return $b['total_amount'] <=> $a['total_amount'];
        });
        
        return $result;
    }
    
    /**
     * Obtener resumen diario
     * 
     * @param int $userId
     * @param string $startDate
     * @param string $endDate
     * @return array
     */
    private function getDailySummary(int $userId, string $startDate, string $endDate): array
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
                'income' => (float) $income,
                'expense' => (float) $expense,
                'balance' => (float) ($income - $expense)
            ];
            
            $current->modify('+1 day');
        }
        
        return $summary;
    }
    
    /**
     * Obtener comparación mensual
     * 
     * @param int $userId
     * @param int $year
     * @param int $months
     * @return array
     */
    private function getMonthlyComparison(int $userId, int $year, int $months): array
    {
        $comparison = [];
        $startMonth = max(1, 13 - $months);
        
        for ($month = $startMonth; $month <= 12; $month++) {
            $monthStart = sprintf('%04d-%02d-01', $year, $month);
            $monthEnd = date('Y-m-t', strtotime($monthStart));
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $monthStart, $monthEnd);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $monthStart, $monthEnd);
            
            // Obtener datos del mismo mes del año anterior para comparación
            $prevYear = $year - 1;
            $prevMonthStart = sprintf('%04d-%02d-01', $prevYear, $month);
            $prevMonthEnd = date('Y-m-t', strtotime($prevMonthStart));
            
            $prevIncome = $this->incomeModel->getTotalByPeriod($userId, $prevMonthStart, $prevMonthEnd);
            $prevExpense = $this->expenseModel->getTotalByPeriod($userId, $prevMonthStart, $prevMonthEnd);
            
            $comparison[] = [
                'month' => $month,
                'month_name' => date('F', mktime(0, 0, 0, $month, 1)),
                'year' => $year,
                'income' => (float) $income,
                'expense' => (float) $expense,
                'balance' => (float) ($income - $expense),
                'previous_year' => [
                    'income' => (float) $prevIncome,
                    'expense' => (float) $prevExpense,
                    'balance' => (float) ($prevIncome - $prevExpense)
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
     * Obtener resumen anual
     * 
     * @param int $userId
     * @param int $startYear
     * @param int $endYear
     * @return array
     */
    private function getYearlySummary(int $userId, int $startYear, int $endYear): array
    {
        $summary = [];
        
        for ($year = $startYear; $year <= $endYear; $year++) {
            $yearStart = sprintf('%04d-01-01', $year);
            $yearEnd = sprintf('%04d-12-31', $year);
            
            $income = $this->incomeModel->getTotalByPeriod($userId, $yearStart, $yearEnd);
            $expense = $this->expenseModel->getTotalByPeriod($userId, $yearStart, $yearEnd);
            
            $summary[] = [
                'year' => $year,
                'income' => (float) $income,
                'expense' => (float) $expense,
                'balance' => (float) ($income - $expense),
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
    
    /**
     * Exportar como CSV
     * 
     * @param array $transactions
     * @return void
     */
    private function exportAsCsv(array $transactions): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="transactions_' . date('Y-m-d') . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Escribir encabezados
        fputcsv($output, ['Fecha', 'Tipo', 'Cuenta', 'Categoría', 'Descripción', 'Monto']);
        
        // Escribir datos
        foreach ($transactions as $transaction) {
            fputcsv($output, [
                $transaction['date'],
                $transaction['type_label'],
                $transaction['account_name'],
                $transaction['category'],
                $transaction['description'],
                number_format($transaction['amount'], 2)
            ]);
        }
        
        fclose($output);
        exit();
    }
    
    /**
     * Validar formato de fecha
     * 
     * @param string $date
     * @return bool
     */
    private function validateDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    /**
     * Obtener ID de usuario autenticado
     * 
     * @return int
     */
    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 1);
    }
}