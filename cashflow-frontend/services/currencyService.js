import { api } from './apiService.js';

export const currencyService = {
    async getAll() {
        const response = await api.get('api/currencies');
        return response;
    },

    async getBase() {
        const response = await api.get('api/currencies/base');
        return response;
    },

    async getById(id) {
        const response = await api.get(`api/currencies/${id}`);
        return response;
    }
};