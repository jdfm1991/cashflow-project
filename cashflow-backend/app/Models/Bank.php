<?php
// app/Models/Bank.php
declare(strict_types=1);

namespace App\Models;

class Bank extends BaseModel
{
    protected $table = 'banks';
    protected $fillable = [
        'name', 'code', 'country', 'website', 'phone', 'logo', 'is_active'
    ];
    
    /**
     * Obtener bancos activos (catálogo global)
     */
    public function getActiveBanks(): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE is_active = 1 ORDER BY name ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }
    
    /**
     * Buscar banco por código
     */
    public function findByCode(string $code): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE code = :code";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['code' => $code]);
        $result = $stmt->fetch();
        return $result ?: null;
    }
}