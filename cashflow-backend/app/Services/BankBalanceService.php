<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\BankAccount;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Bank;

class BankBalanceService
{
    private BankAccount $bankAccountModel;
    private Bank $bankModel;
    
    public function __construct()
    {
        $this->bankAccountModel = new BankAccount();
        $this->bankModel = new Bank();
    }
    
    /**
     * Procesar actualización de saldo para un ingreso
     * 
     * @param array $incomeData Datos del ingreso recién creado
     * @return bool
     */
    public function processIncomeBalance(array $incomeData): bool
    {
        // Solo procesar si es pago bancario
        if (($incomeData['payment_method'] ?? 'cash') !== 'bank') {
            error_log("BankBalance: Ingreso no es bancario, omitiendo actualización de saldo");
            return true;
        }
        
        $bankId = $incomeData['bank_id'] ?? null;
        $companyId = $incomeData['company_id'] ?? null;
        $currencyId = $incomeData['currency_id'] ?? null;
        $amount = (float) ($incomeData['amount_base_currency'] ?? 0);
        
        if (!$bankId || !$companyId) {
            error_log("BankBalance: Faltan datos para actualizar saldo (bank_id={$bankId}, company_id={$companyId})");
            return false;
        }
        
        // Buscar la cuenta bancaria correspondiente
        $bankAccount = $this->bankAccountModel->getByBankAndCompany($bankId, $companyId);
        
        if (!$bankAccount) {
            error_log("BankBalance: No se encontró cuenta bancaria para banco {$bankId}, empresa {$companyId}");
            return false;
        }
        
        // Los ingresos aumentan el saldo (monto positivo)
        $result = $this->bankAccountModel->updateCurrentBalance($bankAccount['id'], $amount);
        
        if ($result) {
            error_log("BankBalance: Ingreso ID {$incomeData['id']} - Saldo actualizado para cuenta {$bankAccount['account_number']}: +{$amount}");
        }
        
        return $result;
    }
    
    /**
     * Procesar actualización de saldo para un egreso
     * 
     * @param array $expenseData Datos del egreso recién creado
     * @return bool
     */
    public function processExpenseBalance(array $expenseData): bool
    {
        // Solo procesar si es pago bancario
        if (($expenseData['payment_method'] ?? 'cash') !== 'bank') {
            error_log("BankBalance: Egreso no es bancario, omitiendo actualización de saldo");
            return true;
        }
        
        $bankId = $expenseData['bank_id'] ?? null;
        $companyId = $expenseData['company_id'] ?? null;
        $currencyId = $expenseData['currency_id'] ?? null;
        $amount = (float) ($expenseData['amount_base_currency'] ?? 0);
        
        if (!$bankId || !$companyId) {
            error_log("BankBalance: Faltan datos para actualizar saldo (bank_id={$bankId}, company_id={$companyId})");
            return false;
        }
        
        // Buscar la cuenta bancaria correspondiente
        $bankAccount = $this->bankAccountModel->getByBankAndCompany($bankId, $companyId);
        
        if (!$bankAccount) {
            error_log("BankBalance: No se encontró cuenta bancaria para banco {$bankId}, empresa {$companyId}");
            return false;
        }
        
        // Los egresos disminuyen el saldo (monto negativo)
        $result = $this->bankAccountModel->updateCurrentBalance($bankAccount['id'], -$amount);
        
        if ($result) {
            error_log("BankBalance: Egreso ID {$expenseData['id']} - Saldo actualizado para cuenta {$bankAccount['account_number']}: -{$amount}");
        }
        
        return $result;
    }
    
    /**
     * Revertir actualización de saldo (para eliminaciones)
     * 
     * @param string $type Tipo de transacción ('income' o 'expense')
     * @param array $transactionData Datos de la transacción a revertir
     * @return bool
     */
    public function revertBalance(string $type, array $transactionData): bool
    {
        // Solo procesar si era pago bancario
        if (($transactionData['payment_method'] ?? 'cash') !== 'bank') {
            return true;
        }
        
        $bankId = $transactionData['bank_id'] ?? null;
        $companyId = $transactionData['company_id'] ?? null;
        $currencyId = $transactionData['currency_id'] ?? null;
        $amount = (float) ($transactionData['amount_base_currency'] ?? 0);
        
        if (!$bankId || !$companyId) {
            return false;
        }
        
        $bankAccount = $this->bankAccountModel->getByBankAndCompany($bankId, $companyId);
        
        if (!$bankAccount) {
            return false;
        }
        
        // Revertir: ingreso se resta, egreso se suma
        if ($type === 'income') {
            // Eliminar ingreso → restar el monto que antes se sumó
            $result = $this->bankAccountModel->updateCurrentBalance($bankAccount['id'], -$amount);
        } else {
            // Eliminar egreso → sumar el monto que antes se restó
            $result = $this->bankAccountModel->updateCurrentBalance($bankAccount['id'], $amount);
        }
        
        if ($result) {
            error_log("BankBalance: Reversión de {$type} ID {$transactionData['id']} - Saldo actualizado");
        }
        
        return $result;
    }
}