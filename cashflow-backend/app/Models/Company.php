<?php
// app/Models/Company.php
declare(strict_types=1);

namespace App\Models;

class Company extends BaseModel
{
    protected $table = 'companies';
    protected $fillable = [
        'name',
        'business_name',
        'tax_id',
        'email',
        'phone',
        'address',
        'logo',
        'theme',
        'subscription_plan',
        'subscription_expires_at',
        'max_users',
        'max_accounts',
        'max_transactions_per_month',
        'is_active'
    ];

    /**
     * Buscar empresa por NIT/RUC
     */
    public function findByTaxId(string $taxId): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE tax_id = :tax_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['tax_id' => $taxId]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Contar empresas activas
     */
    public function countActive(): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE is_active = 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    // app/Models/Company.php - Agregar este método

    /**
     * Obtener empresas activas para el dashboard público
     */
    public function getActiveCompanies(): array
    {
        $sql = "SELECT id, name, business_name, tax_id, email, phone, is_active, subscription_plan
            FROM {$this->table} 
            WHERE is_active = 1 
            ORDER BY name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll();
    }
}
