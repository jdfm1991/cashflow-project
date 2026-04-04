// Configuración regional
const LOCALE = 'es-VE';
const CURRENCY = 'VES';

// ============================================
// FORMATO DE MONEDA
// ============================================

/**
 * Formatea un monto con los decimales exactos (sin redondear)
 */
export const formatAmountWithDecimals = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'Bs. 0,00';
    
    const amountStr = amount.toString();
    const decimalMatch = amountStr.match(/\.(\d+)$/);
    const decimalPlaces = decimalMatch ? decimalMatch[1].length : 2;
    
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
    }).format(num);
};

/**
 * Formato de moneda estándar (2 decimales)
 */
export const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return 'Bs. 0,00';
    
    return new Intl.NumberFormat(LOCALE, {
        style: 'currency',
        currency: CURRENCY,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
};

/**
 * Formato de moneda sin símbolo (para cálculos)
 */
export const formatNumber = (number, decimals = 2) => {
    return new Intl.NumberFormat(LOCALE, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(number);
};

// ============================================
// FORMATO DE FECHAS
// ============================================

export const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// ============================================
// COMPONENTES Y ALERTAS
// ============================================

export const loadComponent = async (elementId, url) => {
    try {
        const baseUrl = window.location.origin + '/cashflow-project/cashflow-frontend/';
        const fullUrl = url.startsWith('http') ? url : baseUrl + url.replace(/^\//, '');
        const response = await fetch(fullUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const html = await response.text();
        document.getElementById(elementId).innerHTML = html;
    } catch (error) {
        console.error('Error loading component:', error);
        document.getElementById(elementId).innerHTML = `<div class="alert alert-danger">Error al cargar componente: ${url}</div>`;
    }
};

export const showAlert = (message, type = 'success') => {
    let alertContainer = document.getElementById('alert-container');
    if (!alertContainer) {
        alertContainer = document.createElement('div');
        alertContainer.id = 'alert-container';
        alertContainer.style.position = 'fixed';
        alertContainer.style.top = '20px';
        alertContainer.style.right = '20px';
        alertContainer.style.zIndex = '9999';
        document.body.appendChild(alertContainer);
    }
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.style.minWidth = '300px';
    alertDiv.style.marginBottom = '10px';
    alertDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    alertDiv.style.borderRadius = '8px';
    alertDiv.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${type === 'success' ? 'bi-check-circle-fill' : type === 'danger' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'} me-2"></i>
            <span>${message}</span>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    alertContainer.appendChild(alertDiv);
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
};

export const exportToExcel = (data, filename = 'reporte.xlsx') => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, filename);
};

export const getBaseUrl = () => {
    return window.location.origin + '/cashflow-project/cashflow-frontend/';
};

