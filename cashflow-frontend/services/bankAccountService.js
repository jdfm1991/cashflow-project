import { api } from './apiService.js';

export const bankAccountService = {
    async getAll() {
        const response = await api.get('api/bank-accounts');
        return response;
    },

    async getById(id) {
        const response = await api.get(`api/bank-accounts/${id}`);
        return response;
    },

    async create(accountData) {
        const response = await api.post('api/bank-accounts', accountData);
        return response;
    },

    async update(id, accountData) {
        const response = await api.put(`api/bank-accounts/${id}`, accountData);
        return response;
    },

    async delete(id) {
        const response = await api.delete(`api/bank-accounts/${id}`);
        return response;
    }
};