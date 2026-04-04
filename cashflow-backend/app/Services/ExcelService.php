<?php
declare(strict_types=1);

namespace App\Services;

use App\Helpers\Response;

class ExcelService
{
    /**
     * Exportar transacciones a Excel
     */
    public function exportTransactions(array $reportData): void
    {
        // Implementación con PhpSpreadsheet
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="transactions_' . date('Y-m-d') . '.xlsx"');
        
        // Por ahora, redirigir a CSV como fallback
        $this->exportTransactionsAsCsv($reportData);
    }
    
    /**
     * Exportar cuentas a Excel
     */
    public function exportAccounts(array $reportData): void
    {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="accounts_' . date('Y-m-d') . '.xlsx"');
        
        $this->exportAccountsAsCsv($reportData);
    }
    
    /**
     * Exportar categorías a Excel
     */
    public function exportCategories(array $reportData): void
    {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="categories_' . date('Y-m-d') . '.xlsx"');
        
        $this->exportCategoriesAsCsv($reportData);
    }
    
    /**
     * Exportar resumen diario a Excel
     */
    public function exportDailySummary(array $report