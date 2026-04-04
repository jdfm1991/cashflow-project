// utils/currencyConfig.js - Archivo de configuración de monedas

export const currencyConfig = {
    VENEZUELA: {
        locale: 'es-VE',
        currency: 'VES',
        symbol: 'Bs.',
        decimalPlaces: 2,
        example: 'Bs. 1.234,56'
    },
    COLOMBIA: {
        locale: 'es-CO',
        currency: 'COP',
        symbol: '$',
        decimalPlaces: 0,
        example: '$ 1.235'
    },
    ARGENTINA: {
        locale: 'es-AR',
        currency: 'ARS',
        symbol: '$',
        decimalPlaces: 2,
        example: '$ 1.234,56'
    },
    CHILE: {
        locale: 'es-CL',
        currency: 'CLP',
        symbol: '$',
        decimalPlaces: 0,
        example: '$ 1.235'
    },
    MEXICO: {
        locale: 'es-MX',
        currency: 'MXN',
        symbol: '$',
        decimalPlaces: 2,
        example: '$ 1,234.56'
    },
    PERU: {
        locale: 'es-PE',
        currency: 'PEN',
        symbol: 'S/',
        decimalPlaces: 2,
        example: 'S/ 1,234.56'
    },
    ECUADOR: {
        locale: 'es-EC',
        currency: 'USD',
        symbol: '$',
        decimalPlaces: 2,
        example: '$ 1,234.56'
    },
    BOLIVIA: {
        locale: 'es-BO',
        currency: 'BOB',
        symbol: 'Bs',
        decimalPlaces: 2,
        example: 'Bs 1.234,56'
    }
};

// Función para obtener la configuración por país
export const getCurrencyConfig = (country) => {
    return currencyConfig[country] || currencyConfig.VENEZUELA;
};