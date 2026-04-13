<?php
declare(strict_types=1);

namespace App\Services;

use App\Models\Currency;
use App\Models\ExchangeRate;

class CurrencyService
{
    private Currency $currencyModel;
    private ExchangeRate $exchangeRateModel;
    private ?array $baseCurrency = null;
    
    public function __construct()
    {
        $this->currencyModel = new Currency();
        $this->exchangeRateModel = new ExchangeRate();
        $this->baseCurrency = $this->currencyModel->getBaseCurrency();
    }
    
    /**
     * Obtener moneda base del sistema
     */
    public function getBaseCurrency(): ?array
    {
        if ($this->baseCurrency === null) {
            $this->baseCurrency = $this->currencyModel->getBaseCurrency();
        }
        return $this->baseCurrency;
    }
    
    /**
     * Obtener ID de la moneda base
     */
    public function getBaseCurrencyId(): int
    {
        $base = $this->getBaseCurrency();
        return $base['id'] ?? 1;
    }
    
    /**
     * Obtener todas las monedas activas
     */
    public function getActiveCurrencies(): array
    {
        return $this->currencyModel->getActiveCurrencies();
    }
    
    /**
     * Convertir monto a moneda base
     * 
     * @param float $amount Monto a convertir
     * @param int $fromCurrencyId Moneda de origen
     * @param string|null $date Fecha para la tasa de cambio
     * @return array
     */
    public function convertToBase(float $amount, int $fromCurrencyId, ?string $date = null): array
    {
        $baseCurrency = $this->getBaseCurrency();
        
        if (!$baseCurrency) {
            return [
                'success' => false,
                'amount' => $amount,
                'rate' => null,
                'converted_amount' => $amount,
                'error' => 'No hay moneda base configurada'
            ];
        }
        
        return $this->convert($amount, $fromCurrencyId, $baseCurrency['id'], $date);
    }
    
    /**
     * Convertir monto entre dos monedas
     * 
     * @param float $amount Monto a convertir
     * @param int $fromCurrencyId Moneda de origen
     * @param int $toCurrencyId Moneda de destino
     * @param string|null $date Fecha para la tasa de cambio
     * @return array
     */
    public function convert(float $amount, int $fromCurrencyId, int $toCurrencyId, ?string $date = null): array
    {
        // Si es la misma moneda, no hay conversión
        if ($fromCurrencyId === $toCurrencyId) {
            return [
                'success' => true,
                'amount' => $amount,
                'rate' => 1.0,
                'converted_amount' => $amount,
                'from_currency' => $fromCurrencyId,
                'to_currency' => $toCurrencyId
            ];
        }
        
        // Buscar tasa de cambio
        $rate = $this->exchangeRateModel->getRate($fromCurrencyId, $toCurrencyId, $date);
        
        if (!$rate) {
            return [
                'success' => false,
                'amount' => $amount,
                'rate' => null,
                'converted_amount' => null,
                'error' => "No se encontró tasa de cambio para la fecha {$date}",
                'from_currency' => $fromCurrencyId,
                'to_currency' => $toCurrencyId
            ];
        }
        
        return [
            'success' => true,
            'amount' => $amount,
            'rate' => $rate,
            'converted_amount' => round($amount * $rate, 2),
            'from_currency' => $fromCurrencyId,
            'to_currency' => $toCurrencyId
        ];
    }
    
    /**
     * Obtener tasa de cambio entre dos monedas
     * 
     * @param int $fromCurrencyId
     * @param int $toCurrencyId
     * @param string|null $date
     * @return float|null
     */
    public function getExchangeRate(int $fromCurrencyId, int $toCurrencyId, ?string $date = null): ?float
    {
        return $this->exchangeRateModel->getRate($fromCurrencyId, $toCurrencyId, $date);
    }
    
    /**
     * Formatear monto según moneda
     * 
     * @param float $amount
     * @param int $currencyId
     * @return string
     */
    public function formatAmount(float $amount, int $currencyId): string
    {
        $currency = $this->currencyModel->find($currencyId);
        
        if (!$currency) {
            return number_format($amount, 2, ',', '.');
        }
        
        $formatted = number_format($amount, $currency['decimal_places'], ',', '.');
        
        // Colocar símbolo según posición (antes o después)
        if (in_array($currency['code'], ['USD', 'EUR', 'GBP'])) {
            return $currency['symbol'] . ' ' . $formatted;
        }
        
        return $formatted . ' ' . $currency['symbol'];
    }
    
    /**
     * Validar que una moneda existe y está activa
     * 
     * @param int $currencyId
     * @return bool
     */
    public function validateCurrency(int $currencyId): bool
    {
        $currency = $this->currencyModel->find($currencyId);
        return $currency && $currency['is_active'];
    }
}