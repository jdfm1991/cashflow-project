// services/currencyService.js
import { api } from './apiService.js';

export const currencyService = {
    currencies: [],
    baseCurrency: null,
    defaultCurrency: null,
    exchangeRatesCache: new Map(),

    /**
     * Inicializar o refrescar las monedas del sistema
     */
    async init() {
        await this.getAll();
        return this;
    },

    /**
     * Cargar todas las monedas activas
     */
    async getAll() {
        const response = await api.get('api/currencies');
        if (response.success && response.data) {
            this.currencies = response.data;
            this.baseCurrency = this.currencies.find(c => c.is_base === 1);
            this.defaultCurrency = this.currencies.find(c => c.is_default === 1) || this.baseCurrency;
            console.log('💰 Monedas cargadas:', {
                base: this.baseCurrency?.code,
                default: this.defaultCurrency?.code,
                total: this.currencies.length
            });
        }
        return response;
    },

    /**
     * Cargar todas las monedas (incluyendo inactivas - solo admin)
     */
    async getAllWithInactive() {
        const response = await api.get('api/currencies/all');
        return response;
    },

    /**
     * Obtener moneda base
     */
    async getBase() {
        if (this.baseCurrency) return { success: true, data: this.baseCurrency };
        const response = await api.get('api/currencies/base');
        if (response.success && response.data) {
            this.baseCurrency = response.data;
        }
        return response;
    },

    /**
     * Obtener moneda por defecto (para conversión y visualización)
     */
    async getDefault() {
        if (this.defaultCurrency) return { success: true, data: this.defaultCurrency };
        const response = await api.get('api/currencies/default');
        if (response.success && response.data) {
            this.defaultCurrency = response.data;
        } else {
            // Fallback: usar moneda base si no hay default
            await this.getBase();
            this.defaultCurrency = this.baseCurrency;
        }
        return { success: true, data: this.defaultCurrency };
    },

    /**
    * Convertir a moneda por defecto (para visualización)
    */
    async convertToDefault(amount, fromCurrencyId, date = null) {
        if (!this.defaultCurrency) {
            await this.getDefault();
        }
        return this.convertAmount(amount, fromCurrencyId, this.defaultCurrency.id, date);
    },

    /**
     * Convertir desde moneda por defecto
     */
    async convertFromDefault(amount, targetCurrencyId, date = null) {
        if (!this.defaultCurrency) {
            await this.getDefault();
        }
        return this.convertAmount(amount, this.defaultCurrency.id, targetCurrencyId, date);
    },

    /**
     * Obtener moneda por ID
     */
    async getById(id) {
        const cached = this.currencies.find(c => c.id === id);
        if (cached) return { success: true, data: cached };
        const response = await api.get(`api/currencies/${id}`);
        return response;
    },

    /**
     * Obtener moneda por código
     */
    getByCode(code) {
        return this.currencies.find(c => c.code === code);
    },

    /**
     * Obtener tasa de cambio entre dos monedas
     * @param {number} fromCurrencyId - ID de moneda origen
     * @param {number} toCurrencyId - ID de moneda destino
     * @param {string} date - Fecha (opcional, formato YYYY-MM-DD)
     * @returns {Promise<Object>} { rate, success, message }
     */
    async getExchangeRate(fromCurrencyId, toCurrencyId, date = null, signal = null) {
        // Asegurar que las monedas están cargadas
        if (!this.baseCurrency) {
            await this.getAll();
        }

        const fromCurrency = this.currencies.find(c => c.id === fromCurrencyId);
        const toCurrency = this.currencies.find(c => c.id === toCurrencyId);
        const baseCurrency = this.baseCurrency?.id;

        console.log(`🔍 getExchangeRate: ${fromCurrency?.code} (${fromCurrencyId}) → ${toCurrency?.code} (${toCurrencyId})`);
        console.log(`   Moneda base del sistema: ${this.baseCurrency?.code}`);

        // Si es la misma moneda, tasa = 1
        if (fromCurrencyId === toCurrencyId) {
            console.log(`📌 Misma moneda, tasa = 1`);
            return { success: true, rate: 1, source: 'same' };
        }

        // Validar que las monedas existen
        if (!fromCurrency || !toCurrency) {
            console.error(`❌ Moneda no encontrada: from=${fromCurrencyId}, to=${toCurrencyId}`);
            return { success: false, rate: null, message: 'Moneda no encontrada' };
        }

        const cacheKey = `${fromCurrencyId}_${toCurrencyId}_${date || 'latest'}`;

        // Verificar caché
        if (this.exchangeRatesCache.has(cacheKey)) {
            const cached = this.exchangeRatesCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
                console.log(`💾 Usando caché: ${cacheKey} = ${cached.rate}`);
                return { success: true, rate: cached.rate, source: 'cache' };
            }
            this.exchangeRatesCache.delete(cacheKey);
        }

        try {
            const fetchOptions = {};
            if (signal) fetchOptions.signal = signal;

            // ✅ Determinar la mejor estrategia según la moneda base
            const isFromBase = fromCurrencyId === this.baseCurrency?.id;
            const isToBase = toCurrencyId === this.baseCurrency?.id;

            console.log(`   📊 Estrategia: fromEsBase=${isFromBase}, toEsBase=${isToBase}`);
            // ESTRATEGIA 1: Buscar tasa de moneda de forma inversa, de moneda base a moneda la que monneda que escoje el usuario)
            if (fromCurrencyId !== baseCurrency) {
                let url = `api/exchange-rates?from=${baseCurrency}&to=${fromCurrencyId}`;
                if (date) url += `&date=${date}`;

                let response = await api.get(url, true, fetchOptions);

                if (response.success && response.data && response.data.rate) {
                    const rate = parseFloat(response.data.rate);
                    console.log(`✅ Tasa directa encontrada: ${fromCurrency.code} → ${toCurrency.code} = ${rate}`);

                    this.exchangeRatesCache.set(cacheKey, { rate, timestamp: Date.now() });
                    return { success: true, rate, source: 'direct' };
                }

            }

            // ESTRATEGIA 2: Buscar tasa directa 
            let url = `api/exchange-rates?from=${fromCurrencyId}&to=${toCurrencyId}`;
            if (date) url += `&date=${date}`;

            let response = await api.get(url, true, fetchOptions);

            if (response.success && response.data && response.data.rate) {
                const rate = parseFloat(response.data.rate);
                console.log(`✅ Tasa directa encontrada: ${fromCurrency.code} → ${toCurrency.code} = ${rate}`);

                this.exchangeRatesCache.set(cacheKey, { rate, timestamp: Date.now() });
                return { success: true, rate, source: 'direct' };
            }

            // No hay ninguna tasa disponible
            console.warn(`⚠️ No hay tasa disponible para ${fromCurrency.code} → ${toCurrency.code}`);
            return {
                success: false,
                rate: null,
                message: `No se encontró tasa de cambio para ${fromCurrency.code} → ${toCurrency.code} en la fecha ${date || 'actual'}`
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Petición abortada');
                return { success: false, rate: null, aborted: true };
            }
            console.error('Error en getExchangeRate:', error);
            return { success: false, rate: null, message: error.message };
        }
    },

    /**
     * Convertir un monto entre monedas
     * @param {number} amount - Monto a convertir
     * @param {number} fromCurrencyId - ID de moneda origen
     * @param {number} toCurrencyId - ID de moneda destino
     * @param {string} date - Fecha (opcional)
     * @returns {Promise<Object>} { original_amount, converted_amount, rate, success }
     */
    async convertAmount(amount, fromCurrencyId, toCurrencyId, date = null) {
        if (!amount || amount === 0) {
            return {
                success: true,
                original_amount: 0,
                converted_amount: 0,
                rate: 1
            };
        }

        const rateResult = await this.getExchangeRate(fromCurrencyId, toCurrencyId, date);

        if (!rateResult.success) {
            return {
                success: false,
                original_amount: amount,
                converted_amount: null,
                rate: null,
                message: rateResult.message
            };
        }

        return {
            success: true,
            original_amount: amount,
            converted_amount: amount * rateResult.rate,
            rate: rateResult.rate,
            source: rateResult.source
        };
    },

    /**
     * Convertir a moneda base
     */
    async convertToBase(amount, fromCurrencyId, date = null) {
        if (!this.baseCurrency) {
            await this.getAll();
        }
        console.log(`🔄 convertToBase: ${amount} de moneda ${fromCurrencyId} a moneda base ${this.baseCurrency?.id}`);

        if (fromCurrencyId === this.baseCurrency?.id) {
            console.log(`📌 Ya está en moneda base, sin conversión`);
            return { success: true, original_amount: amount, converted_amount: amount, rate: 1 };
        }

        return this.convertAmount(amount, fromCurrencyId, this.baseCurrency.id, date);
    },

    /**
     * Convertir desde moneda base
     */
    async convertFromBase(amount, toCurrencyId, date = null) {
        if (!this.baseCurrency) {
            await this.getAll();
        }
        return this.convertAmount(amount, this.baseCurrency.id, toCurrencyId, date);
    },

    /**
     * Obtener la moneda por defecto para mostrar
     */
    getDefaultDisplayCurrency() {
        return this.defaultCurrency || this.baseCurrency;
    },

    /**
     * Formatear monto según moneda
     */
    formatAmount(amount, currencyId) {
        const currency = this.currencies.find(c => c.id === currencyId);
        if (!currency) return amount.toFixed(2);

        const decimals = currency.decimal_places || 2;
        const formatted = amount.toLocaleString('es-VE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });

        return `${currency.symbol} ${formatted}`;
    },

    /**
     * Formatear monto en moneda base
     */
    formatInBase(amount) {
        if (!this.baseCurrency) return amount.toFixed(2);
        const decimals = this.baseCurrency.decimal_places || 2;
        return `${this.baseCurrency.symbol} ${amount.toLocaleString('es-VE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })}`;
    },

    /** 
     * Formatear monto en moneda por defecto
     */
    formatInDefault(amount) {
        if (!this.defaultCurrency) {
            this.getDefault();
            return amount.toFixed(2);
        }
        const decimals = this.defaultCurrency.decimal_places || 2;
        return `${this.defaultCurrency.symbol} ${amount.toLocaleString('es-VE', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        })}`;
    },

    /**
     * Obtener símbolo de moneda
     */
    getSymbol(currencyId) {
        const currency = this.currencies.find(c => c.id === currencyId);
        return currency?.symbol || '$';
    },

    /**
     * Limpiar caché de tasas de cambio
     */
    clearCache() {
        this.exchangeRatesCache.clear();
    },

    /**
     * Precargar tasas de cambio para un conjunto de monedas
     */
    async preloadRates(currenciesIds, date = null) {
        if (!this.baseCurrency) await this.getBase();

        const promises = currenciesIds.map(async (currencyId) => {
            if (currencyId !== this.baseCurrency?.id) {
                await this.getExchangeRate(currencyId, this.baseCurrency.id, date);
            }
        });

        await Promise.all(promises);
    }
};