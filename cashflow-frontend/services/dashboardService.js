import { api } from './apiService.js';

export const dashboardService = {
    /**
     * Obtener estadísticas del dashboard (público - sin autenticación)
     */
    async getStats(startDate, endDate) {
        try {
            // Usar endpoint público (no requiere autenticación)
            const response = await api.get(`api/public/dashboard/stats?start_date=${startDate}&end_date=${endDate}`, false);
            return response;
        } catch (error) {
            console.error('Error en dashboardService.getStats:', error);
            throw error;
        }
    },

    /**
     * Obtener datos de tendencias (público)
     */
    async getTrends(months = 12) {
        try {
            const response = await api.get(`api/public/dashboard/trends?months=${months}`, false);
            return response;
        } catch (error) {
            console.error('Error en dashboardService.getTrends:', error);
            throw error;
        }
    },

    /**
     * Obtener transacciones recientes (público)
     */
    async getRecentTransactions(limit = 10) {
        try {
            const response = await api.get(`api/public/dashboard/recent-transactions?limit=${limit}`, false);
            return response;
        } catch (error) {
            console.error('Error en dashboardService.getRecentTransactions:', error);
            throw error;
        }
    },

    /**
     * Obtener distribución por categorías (público)
     */
    async getCategoryDistribution(startDate, endDate, type = 'all') {
        try {
            const response = await api.get(`api/public/dashboard/category-distribution?start_date=${startDate}&end_date=${endDate}&type=${type}`, false);
            return response;
        } catch (error) {
            console.error('Error en dashboardService.getCategoryDistribution:', error);
            throw error;
        }
    }
};