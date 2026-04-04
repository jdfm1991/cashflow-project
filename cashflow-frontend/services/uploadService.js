// services/uploadService.js
import { api } from './apiService.js';

export const uploadService = {
    async getBanks() {
        const response = await api.get('api/uploads/banks');
        return response;
    },

    async getBankAccounts() {
        const response = await api.get('api/uploads/bank-accounts');
        return response;
    },

    async uploadStatement(bankId, bankAccountId, file) {
        const formData = new FormData();
        formData.append('bank_id', bankId);
        if (bankAccountId) {
            formData.append('bank_account_id', bankAccountId);
        }
        formData.append('file', file);

        const response = await api.uploadFile('api/uploads/bank-statement', formData);
        return response;
    },

    async mapTransactions(sessionId, mappings) {
        const response = await api.post('api/uploads/map-transactions', {
            session_id: sessionId,
            mappings: mappings
        });
        return response;
    }
};