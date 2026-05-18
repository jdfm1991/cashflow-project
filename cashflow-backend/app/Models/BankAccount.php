<?php
// app/Models/BankAccount.php
declare(strict_types=1);

namespace App\Models;

class BankAccount extends BaseModel
{
    protected $table = 'bank_accounts';
    protected $fillable = [
        'company_id',
        'bank_id',
        'account_number',
        'account_type',
        'currency_id',
        'account_holder',
        'opening_balance',
        'current_balance',
        'is_active'
    ];

    /**
     * Obtener cuentas bancarias por empresa
     */
    public function getByCompany(int $companyId, bool $onlyActive = true): array
    {
        $sql = "SELECT ba.*, 
                b.name as bank_name, b.code as bank_code, b.country as bank_country,
                c.code as currency_code, c.symbol as currency_symbol, c.name as currency_name
                FROM bank_accounts ba
                INNER JOIN banks b ON ba.bank_id = b.id
                INNER JOIN currencies c ON ba.currency_id = c.id
                WHERE ba.company_id = :company_id";

        if ($onlyActive) {
            $sql .= " AND ba.is_active = 1";
        }

        $sql .= " ORDER BY b.name ASC, ba.account_number ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        return $stmt->fetchAll();
    }

    /**
     * Actualizar balance de la cuenta bancaria
     */
    public function updateBalance(int $accountId, float $amount): bool
    {
        $sql = "UPDATE {$this->table} SET current_balance = current_balance + :amount WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'amount' => $amount,
            'id' => $accountId
        ]);
    }

    /**
     * Obtener cuenta por número
     */
    public function findByAccountNumber(string $accountNumber, int $companyId): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE account_number = :account_number AND company_id = :company_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'account_number' => $accountNumber,
            'company_id' => $companyId
        ]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Actualizar saldo de una cuenta bancaria
     * 
     * @param int $bankAccountId ID de la cuenta bancaria
     * @param float $amount Monto a sumar (positivo) o restar (negativo)
     * @return bool
     */
    public function updateCurrentBalance(int $bankAccountId, float $amount): bool
    {
        $sql = "UPDATE {$this->table} 
            SET current_balance = current_balance + :amount, 
                updated_at = NOW() 
            WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        $result = $stmt->execute([
            'amount' => $amount,
            'id' => $bankAccountId
        ]);

        if ($result) {
            error_log("✅ Saldo actualizado para cuenta bancaria ID {$bankAccountId}: cambio de {$amount}");
        } else {
            error_log("❌ Error actualizando saldo para cuenta bancaria ID {$bankAccountId}");
        }

        return $result;
    }

    /**
     * Obtener cuenta bancaria por banco, empresa y moneda
     * 
     * @param int $bankId ID del banco
     * @param int $companyId ID de la empresa
     * @param int $currencyId ID de la moneda (opcional)
     * @return array|null
     */
    public function getByBankAndCompany(int $bankId, int $companyId): ?array
    {
        $sql = "SELECT * FROM {$this->table} 
            WHERE bank_id = :bank_id 
            AND company_id = :company_id 
            AND is_active = 1";
        $params = [
            'bank_id' => $bankId,
            'company_id' => $companyId
        ];

        $sql .= " ORDER BY id ASC LIMIT 1";

        error_log("BankAccount::getByBankAndCompany - SQL: " . $sql);
        error_log("BankAccount::getByBankAndCompany - Params: " . json_encode($params));

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();

        if ($result) {
            error_log("BankAccount::getByBankAndCompany - Encontrada: ID {$result['id']}, cuenta {$result['account_number']}");
        } else {
            error_log("BankAccount::getByBankAndCompany - No se encontró cuenta");
        }

        return $result ?: null;
    }
}
