<?php
// app/Models/ImportedTransaction.php
declare(strict_types=1);

namespace App\Models;

class ImportedTransaction extends BaseModel
{
    protected $table = 'imported_transactions';
    protected $fillable = [
        'company_id',
        'bank_id',
        'bank_account_id',
        'transaction_date',
        'reference',
        'description',
        'amount',
        'transaction_type',
        'original_amount',
        'original_currency',
        'exchange_rate',
        'is_processed',
        'mapped_account_id',
        'mapped_category',
        'import_session_id'
    ];

    public function getBySession(int $companyId, string $sessionId): array
    {
        // ✅ Sin límite, trae todos los registros
        $sql = "SELECT * FROM {$this->table} 
            WHERE company_id = :company_id 
            AND import_session_id = :session_id 
            AND is_processed = 0
            ORDER BY transaction_date ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'session_id' => $sessionId
        ]);

        return $stmt->fetchAll();
    }

    public function markAsProcessed(int $transactionId, int $accountId): bool
    {
        $sql = "UPDATE {$this->table} 
                SET is_processed = 1, mapped_account_id = :account_id 
                WHERE id = :id";

        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'account_id' => $accountId,
            'id' => $transactionId
        ]);
    }
}
