import { api } from './apiService.js';

export const accountService = {
    async getAll(type = null) {
        const url = type ? `api/accounts?type=${type}` : 'api/accounts';
        const response = await api.get(url);
        return response;
    },

    async getById(id) {
        const response = await api.get(`api/accounts/${id}`);
        return response;
    },

    async create(accountData) {
        const response = await api.post('api/accounts', accountData);
        return response;
    },

    async update(id, accountData) {
        const response = await api.put(`api/accounts/${id}`, accountData);
        return response;
    },

    async delete(id) {
        const response = await api.delete(`api/accounts/${id}`);
        return response;
    }
};