// services/uploadService.js
import { api } from './apiService.js';

export const uploadService = {
    async getBanks(companyId = null) {
        let url = 'api/uploads/banks';
        if (companyId) {
            url += `?company_id=${companyId}`;
        }
        const response = await api.get(url);
        return response;
    },

    async getBankAccounts(companyId = null) {
        let url = 'api/uploads/bank-accounts';
        if (companyId) {
            url += `?company_id=${companyId}`;
        }
        const response = await api.get(url);
        return response;
    },

    async uploadStatement(bankId, bankAccountId, file, companyId = null) {
        const formData = new FormData();
        formData.append('bank_id', bankId);
        if (bankAccountId) {
            formData.append('bank_account_id', bankAccountId);
        }
        if (companyId) {
            formData.append('company_id', companyId);
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