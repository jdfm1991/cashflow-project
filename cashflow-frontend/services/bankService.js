import { api } from './apiService.js';

export const bankService = {
    async getAll() {
        const response = await api.get('api/banks');
        return response;
    },

    async getById(id) {
        const response = await api.get(`api/banks/${id}`);
        return response;
    },

    async create(bankData) {
        const response = await api.post('api/banks', bankData);
        return response;
    },

    async update(id, bankData) {
        const response = await api.put(`api/banks/${id}`, bankData);
        return response;
    },

    async delete(id) {
        const response = await api.delete(`api/banks/${id}`);
        return response;
    }
};