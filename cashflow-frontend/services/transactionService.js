// services/transactionService.js
import { api } from './apiService.js';

export const transactionService = {
    // ========== INGRESOS ==========

    /**
     * Obtener ingresos con filtros
     */
    async getIncomes(filters = {}) {
        try {
            const params = new URLSearchParams();

            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.account_id) params.append('account_id', filters.account_id);
            if (filters.limit) params.append('limit', filters.limit);

            const url = `api/incomes${params.toString() ? '?' + params.toString() : ''}`;
            const response = await api.get(url);
            return response;
        } catch (error) {
            console.error('Error en transactionService.getIncomes:', error);
            throw error;
        }
    },

    /**
     * Obtener ingreso por ID
     */
    async getIncomeById(id) {
        try {
            const response = await api.get(`api/incomes/${id}`);
            return response;
        } catch (error) {
            console.error('Error en transactionService.getIncomeById:', error);
            throw error;
        }
    },

    /**
     * Crear ingreso
     */
    async createIncome(incomeData) {
        try {
            const response = await api.post('api/incomes', incomeData);
            return response;
        } catch (error) {
            console.error('Error en transactionService.createIncome:', error);
            throw error;
        }
    },

    /**
     * Actualizar ingreso
     */
    async updateIncome(id, incomeData) {
        try {
            const response = await api.put(`api/incomes/${id}`, incomeData);
            return response;
        } catch (error) {
            console.error('Error en transactionService.updateIncome:', error);
            throw error;
        }
    },

    /**
     * Eliminar ingreso
     */
    async deleteIncome(id) {
        try {
            const response = await api.delete(`api/incomes/${id}`);
            return response;
        } catch (error) {
            console.error('Error en transactionService.deleteIncome:', error);
            throw error;
        }
    },

    // ========== EGRESOS ==========

    /**
     * Obtener egresos con filtros
     */
    async getExpenses(filters = {}) {
        try {
            const params = new URLSearchParams();

            // Filtros existentes
            if (filters.start_date) params.append('start_date', filters.start_date);
            if (filters.end_date) params.append('end_date', filters.end_date);
            if (filters.account_id) params.append('account_id', filters.account_id);

            // NUEVOS FILTROS
            if (filters.company_id) params.append('company_id', filters.company_id);
            if (filters.year) params.append('year', filters.year);
            if (filters.month) params.append('month', filters.month);
            if (filters.limit) params.append('limit', filters.limit);

            const url = `api/expenses${params.toString() ? '?' + params.toString() : ''}`;
            console.log('URL de petición:', url); // Para depurar

            const response = await api.get(url);
            console.log('Respuesta:', response); // Para depurar

            return response;
        } catch (error) {
            console.error('Error en transactionService.getExpenses:', error);
            throw error;
        }
    },

    /**
     * Obtener egreso por ID
     */
    async getExpenseById(id) {
        try {
            const response = await api.get(`api/expenses/${id}`);
            return response;
        } catch (error) {
            console.error('Error en transactionService.getExpenseById:', error);
            throw error;
        }
    },

    /**
     * Crear egreso
     */
    async createExpense(expenseData) {
        try {
            const response = await api.post('api/expenses', expenseData);
            return response;
        } catch (error) {
            console.error('Error en transactionService.createExpense:', error);
            throw error;
        }
    },

    /**
     * Actualizar egreso
     */
    async updateExpense(id, expenseData) {
        try {
            const response = await api.put(`api/expenses/${id}`, expenseData);
            return response;
        } catch (error) {
            console.error('Error en transactionService.updateExpense:', error);
            throw error;
        }
    },

    /**
     * Eliminar egreso
     */
    async deleteExpense(id) {
        try {
            const response = await api.delete(`api/expenses/${id}`);
            return response;
        } catch (error) {
            console.error('Error en transactionService.deleteExpense:', error);
            throw error;
        }
    }
};