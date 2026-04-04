<?php
// app/Models/ExchangeRate.php
declare(strict_types=1);

namespace App\Models;

class ExchangeRate extends BaseModel
{
    protected $table = 'exchange_rates';
    protected $fillable = [
        'from_currency_id',
        'to_currency_id',
        'rate',
        'effective_date',
        'source',
        'created_by',
        'notes'
    ];

    /**
     * Obtener tasa de cambio para una fecha específica
     */
    public function getRate(int $fromCurrencyId, int $toCurrencyId, ?string $date = null): ?float
    {
        if ($fromCurrencyId === $toCurrencyId) {
            return 1.0;
        }

        $date = $date ?? date('Y-m-d');

        $sql = "SELECT rate FROM {$this->table} 
                WHERE from_currency_id = :from_id 
                AND to_currency_id = :to_id 
                AND effective_date <= :date
                ORDER BY effective_date DESC
                LIMIT 1";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'from_id' => $fromCurrencyId,
            'to_id' => $toCurrencyId,
            'date' => $date
        ]);

        $result = $stmt->fetch();
        return $result ? (float) $result['rate'] : null;
    }

    /**
     * Obtener todas las tasas de cambio por fecha
     */
    public function getRatesByDate(string $date): array
    {
        $sql = "SELECT er.*, 
                fc.code as from_currency_code, fc.name as from_currency_name,
                tc.code as to_currency_code, tc.name as to_currency_name
                FROM {$this->table} er
                INNER JOIN currencies fc ON er.from_currency_id = fc.id
                INNER JOIN currencies tc ON er.to_currency_id = tc.id
                WHERE er.effective_date = :date
                ORDER BY fc.code, tc.code";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['date' => $date]);
        return $stmt->fetchAll();
    }

    /**
     * Convertir monto entre monedas
     */
    public function convert(float $amount, int $fromCurrencyId, int $toCurrencyId, ?string $date = null): array
    {
        if ($fromCurrencyId === $toCurrencyId) {
            return [
                'amount' => $amount,
                'rate' => 1.0,
                'converted_amount' => $amount
            ];
        }

        $rate = $this->getRate($fromCurrencyId, $toCurrencyId, $date);

        if (!$rate) {
            return [
                'amount' => $amount,
                'rate' => null,
                'converted_amount' => null,
                'error' => 'No se encontró tasa de cambio'
            ];
        }

        return [
            'amount' => $amount,
            'rate' => $rate,
            'converted_amount' => round($amount * $rate, 2)
        ];
    }

    /**
     * Obtener todas las tasas de cambio (la más reciente por cada par de monedas)
     */
    public function getAllLatestRates(): array
    {
        $sql = "SELECT er1.*, 
            fc.code as from_currency_code, fc.name as from_currency_name,
            tc.code as to_currency_code, tc.name as to_currency_name
            FROM exchange_rates er1
            INNER JOIN currencies fc ON er1.from_currency_id = fc.id
            INNER JOIN currencies tc ON er1.to_currency_id = tc.id
            INNER JOIN (
                SELECT from_currency_id, to_currency_id, MAX(effective_date) as max_date
                FROM exchange_rates
                GROUP BY from_currency_id, to_currency_id
            ) er2 ON er1.from_currency_id = er2.from_currency_id 
                AND er1.to_currency_id = er2.to_currency_id 
                AND er1.effective_date = er2.max_date
            ORDER BY fc.code, tc.code";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        return $stmt->fetchAll();
    }
}
