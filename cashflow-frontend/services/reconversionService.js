// services/reconversionService.js
import { api } from './apiService.js';
import { currencyService } from './currencyService.js';

export const reconversionService = {
    /**
     * Obtener estadísticas de transacciones por período
     */
    async getTransactionsStats(type, startDate, endDate, companyId = null) {
        try {
            const params = new URLSearchParams();
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (companyId) params.append('company_id', companyId);
            
            // ✅ Usar la ruta stats que ya existe
            const endpoint = type === 'income' ? 'api/incomes/stats' : 'api/expenses/stats';
            const response = await api.get(`${endpoint}?${params.toString()}`);
            
            if (response.success && response.data) {
                return response.data;
            }
            return { count: 0, total: 0, currencies_count: 0 };
        } catch (error) {
            console.error(`Error getting ${type} stats:`, error);
            return { count: 0, total: 0, currencies_count: 0 };
        }
    },
    
    /**
     * Obtener tasas de cambio históricas para un período
     */
    async getHistoricalRates(fromCurrencyId, toCurrencyId, startDate, endDate) {
        try {
            // ✅ Usar la ruta historical que ya existe
            const response = await api.get(
                `api/exchange-rates/historical?from=${fromCurrencyId}&to=${toCurrencyId}&start=${startDate}&end=${endDate}`
            );
            if (response.success && response.data) {
                return response.data;
            }
            return [];
        } catch (error) {
            console.error('Error getting historical rates:', error);
            return [];
        }
    },
    
    /**
     * Ejecutar reconversión masiva
     */
    async executeReconversion(type, data) {
        try {
            // ✅ Usar la ruta reconvert que ya existe
            const endpoint = type === 'income' ? 'api/incomes/reconvert' : 'api/expenses/reconvert';
            const response = await api.post(endpoint, data);
            return response;
        } catch (error) {
            console.error('Error executing reconversion:', error);
            throw error;
        }
    },
    
    /**
     * Calcular estimación de reconversión (para previsualización)
     * Usa stats + tasa promedio del período
     */
    async calculateEstimation(type, startDate, endDate, targetCurrencyId, companyId = null) {
        try {
            // 1. Obtener estadísticas del período
            const stats = await this.getTransactionsStats(type, startDate, endDate, companyId);
            
            if (stats.count === 0) {
                return {
                    hasData: false,
                    count: 0,
                    total: 0,
                    message: 'No hay transacciones en el período seleccionado'
                };
            }
            
            // 2. Obtener moneda base actual y moneda destino
            const baseCurrency = currencyService.baseCurrency;
            const targetCurrency = currencyService.currencies.find(c => c.id == targetCurrencyId);
            
            if (!baseCurrency || !targetCurrency) {
                return {
                    hasData: false,
                    message: 'No se encontraron las monedas necesarias'
                };
            }
            
            // 3. Si la moneda destino es la misma que la base, no hay conversión
            if (baseCurrency.id === targetCurrencyId) {
                return {
                    hasData: true,
                    count: stats.count,
                    total: stats.total,
                    estimatedTotal: stats.total,
                    rate: 1,
                    message: 'La moneda destino es la misma que la moneda base actual'
                };
            }
            
            // 4. Obtener tasa promedio del período (usando la última tasa disponible)
            const historicalRates = await this.getHistoricalRates(
                baseCurrency.id,
                targetCurrencyId,
                startDate,
                endDate
            );
            
            let averageRate = null;
            if (historicalRates.length > 0) {
                // Calcular tasa promedio
                const sumRates = historicalRates.reduce((sum, r) => sum + parseFloat(r.rate), 0);
                averageRate = sumRates / historicalRates.length;
            } else {
                // Si no hay tasas históricas, intentar obtener la tasa más reciente
                const rateResult = await currencyService.getExchangeRate(
                    baseCurrency.id,
                    targetCurrencyId,
                    endDate
                );
                if (rateResult.success) {
                    averageRate = rateResult.rate;
                }
            }
            
            const estimatedTotal = stats.total / (averageRate || 1);
            
            return {
                hasData: true,
                count: stats.count,
                total: stats.total,
                estimatedTotal: estimatedTotal,
                rate: averageRate,
                hasHistoricalRates: historicalRates.length > 0,
                baseCurrency: baseCurrency,
                targetCurrency: targetCurrency
            };
            
        } catch (error) {
            console.error('Error calculating estimation:', error);
            return {
                hasData: false,
                message: error.message || 'Error al calcular la estimación'
            };
        }
    }
};