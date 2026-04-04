// services/reportService.js
import { api } from './apiService.js';

export const reportService = {
    /**
     * Exportar reporte de transacciones
     */
    async exportTransactions(startDate, endDate, format = 'excel') {
        // Para descarga de archivos, necesitamos una petición especial
        const token = localStorage.getItem('access_token');
        const url = `http://localhost:8000/api/reports/transactions?start_date=${startDate}&end_date=${endDate}&format=${format}`;
        
        window.open(url, '_blank');
    },

    /**
     * Generar reporte de flujo de caja
     */
    async getCashFlow(startDate, endDate, groupBy = 'month') {
        const response = await api.get(`api/reports/cash-flow?start_date=${startDate}&end_date=${endDate}&group_by=${groupBy}`);
        return response.data;
    },

    /**
     * Generar reporte de cuentas
     */
    async getAccountReport(startDate, endDate, accountType = 'all') {
        const response = await api.get(`api/reports/accounts?start_date=${startDate}&end_date=${endDate}&account_type=${accountType}`);
        return response.data;
    }
};