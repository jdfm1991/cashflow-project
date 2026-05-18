<?php
// app/Models/Currency.php
declare(strict_types=1);

namespace App\Models;

class Currency extends BaseModel
{
    protected $table = 'currencies';
    protected $fillable = [
        'code',
        'name',
        'symbol',
        'decimal_places',
        'is_base',
        'is_default',
        'is_active'
    ];

    /**
     * Obtener moneda base del sistema (para reportes y almacenamiento)
     */
    public function getBaseCurrency(): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE is_base = 1 AND is_active = 1 LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Obtener moneda por defecto para conversión/visualización
     */
    public function getDefaultCurrency(): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE is_default = 1 AND is_active = 1 LIMIT 1";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetch();

        // Si no hay moneda default configurada, usar la base como fallback
        if (!$result) {
            return $this->getBaseCurrency();
        }

        return $result;
    }

    /**
     * Obtener monedas activas
     */
    public function getActiveCurrencies(): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE is_active = 1 ORDER BY is_default DESC, is_base DESC, code ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Obtener todas las monedas
     */
    public function getAllCurrencies(): array
    {
        $sql = "SELECT * FROM {$this->table} ORDER BY is_default DESC, is_base DESC, code ASC";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Buscar moneda por código
     */
    public function findByCode(string $code): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE code = :code";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['code' => $code]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Verificar si existe moneda base
     */
    public function hasBaseCurrency(): bool
    {
        return $this->getBaseCurrency() !== null;
    }

    /**
     * Verificar si existe moneda default
     */
    public function hasDefaultCurrency(): bool
    {
        return $this->getDefaultCurrency() !== null;
    }

    /**
     * Establecer moneda base (quitar base de otras y establecer esta)
     */
    public function setAsBaseCurrency(int $currencyId): bool
    {
        try {
            // Quitar base de todas las monedas
            $sql = "UPDATE {$this->table} SET is_base = 0 WHERE is_base = 1";
            $this->db->prepare($sql)->execute();

            // Establecer nueva moneda base
            $sql = "UPDATE {$this->table} SET is_base = 1 WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute(['id' => $currencyId]);
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Establecer moneda por defecto (quitar default de otras y establecer esta)
     */
    public function setAsDefaultCurrency(int $currencyId): bool
    {
        try {
            // Quitar default de todas las monedas
            $sql = "UPDATE {$this->table} SET is_default = 0 WHERE is_default = 1";
            $this->db->prepare($sql)->execute();

            // Establecer nueva moneda default
            $sql = "UPDATE {$this->table} SET is_default = 1 WHERE id = :id";
            $stmt = $this->db->prepare($sql);
            return $stmt->execute(['id' => $currencyId]);
        } catch (\Exception $e) {
            return false;
        }
    }

}
