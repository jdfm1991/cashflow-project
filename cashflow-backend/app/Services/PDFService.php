<?php
declare(strict_types=1);

/**
 * Servicio de Generación de PDF
 * 
 * Genera documentos PDF a partir de datos del sistema,
 * incluyendo reportes, facturas y estados de cuenta.
 * 
 * @package App\Services
 */

namespace App\Services;

use App\Helpers\Response;

class PDFService
{
    /**
     * Exportar transacciones a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportTransactions(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="transactions_' . date('Y-m-d') . '.pdf"');
        
        // Crear PDF simple con HTML/CSS
        $html = $this->generateTransactionsHTML($reportData);
        
        // En una implementación real, usarías una librería como Dompdf o TCPDF
        // Por ahora, mostramos HTML como fallback
        echo $html;
        exit();
    }
    
    /**
     * Exportar cuentas a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportAccounts(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="accounts_' . date('Y-m-d') . '.pdf"');
        
        $html = $this->generateAccountsHTML($reportData);
        echo $html;
        exit();
    }
    
    /**
     * Exportar categorías a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportCategories(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="categories_' . date('Y-m-d') . '.pdf"');
        
        $html = $this->generateCategoriesHTML($reportData);
        echo $html;
        exit();
    }
    
    /**
     * Exportar resumen diario a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportDailySummary(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="daily_summary_' . date('Y-m-d') . '.pdf"');
        
        $html = $this->generateDailySummaryHTML($reportData);
        echo $html;
        exit();
    }
    
    /**
     * Exportar comparación mensual a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportMonthlyComparison(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="monthly_comparison_' . date('Y-m-d') . '.pdf"');
        
        $html = $this->generateMonthlyComparisonHTML($reportData);
        echo $html;
        exit();
    }
    
    /**
     * Exportar resumen anual a PDF
     * 
     * @param array $reportData
     * @return void
     */
    public function exportYearlySummary(array $reportData): void
    {
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="yearly_summary_' . date('Y-m-d') . '.pdf"');
        
        $html = $this->generateYearlySummaryHTML($reportData);
        echo $html;
        exit();
    }
    
    /**
     * Generar HTML para reporte de transacciones
     * 
     * @param array $reportData
     * @return string
     */
    private function generateTransactionsHTML(array $reportData): string
    {
        $period = $reportData['period'] ?? [];
        $transactions = $reportData['transactions'] ?? [];
        $totals = $reportData['totals'] ?? [];
        
        $html = '<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Reporte de Transacciones</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                h1 { color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; }
                .header { margin-bottom: 30px; }
                .period { color: #666; margin-bottom: 20px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th { background: #3b82f6; color: white; padding: 12px; text-align: left; }
                td { padding: 10px; border-bottom: 1px solid #ddd; }
                .income { color: #28a745; font-weight: bold; }
                .expense { color: #dc3545; font-weight: bold; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
                .summary { background: #f8f9fa; padding: 15px; margin-top: 20px; border-radius: 5px; }
                .summary-item { display: inline-block; margin-right: 30px; }
                .summary-label { font-weight: bold; }
            </style>
        </head>
        <body>
            <h1>Reporte de Transacciones</h1>
            <div class="header">
                <p><strong>Fecha de generación:</strong> ' . date('d/m/Y H:i:s') . '</p>
                <p><strong>Período:</strong> ' . ($period['start_date'] ?? '') . ' al ' . ($period['end_date'] ?? '') . '</p>
            </div>
            
            <div class="summary">
                <div class="summary-item">
                    <span class="summary-label">Total Ingresos:</span>
                    <span class="income">$' . number_format($totals['total_income'] ?? 0, 2) . '</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Egresos:</span>
                    <span class="expense">$' . number_format($totals['total_expense'] ?? 0, 2) . '</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Balance:</span>
                    <span class="' . (($totals['balance'] ?? 0) >= 0 ? 'income' : 'expense') . '">
                        $' . number_format($totals['balance'] ?? 0, 2) . '
                    </span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Total Transacciones:</span>
                    <span>' . ($totals['total_transactions'] ?? 0) . '</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Cuenta</th>
                        <th>Categoría</th>
                        <th>Descripción</th>
                        <th>Monto</th>
                    </tr>
                </thead>
                <tbody>';
        
        foreach ($transactions as $transaction) {
            $html .= '<tr>
                <td>' . date('d/m/Y', strtotime($transaction['date'])) . '</td>
                <td>' . $transaction['type_label'] . '</td>
                <td>' . htmlspecialchars($transaction['account_name']) . '</td>
                <td>' . htmlspecialchars($transaction['category']) . '</td>
                <td>' . htmlspecialchars($transaction['description'] ?? '-') . '</td>
                <td class="' . $transaction['type'] . '">$' . number_format($transaction['amount'], 2) . '</td>
            </tr>';
        }
        
        $html .= '</tbody>
            </table>
            
            <div class="footer">
                <p>CashFlow System - Reporte generado automáticamente</p>
            </div>
        </body>
        </html>';
        
        return $html;
    }
    
    /**
     * Generar HTML