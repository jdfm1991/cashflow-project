// services/companyService.js
import { api } from './apiService.js';

export const companyService = {
    /**
     * Obtener todas las empresas (solo super_admin)
     * @param {Object} filters - Filtros opcionales
     * @param {string} filters.status - 'active' o 'inactive'
     * @param {string} filters.search - Búsqueda por nombre
     */
    async getAll(filters = {}) {
        try {
            const params = new URLSearchParams();

            if (filters.status) params.append('status', filters.status);
            if (filters.search) params.append('search', filters.search);

            const url = `api/companies${params.toString() ? '?' + params.toString() : ''}`;
            const response = await api.get(url);
            return response;
        } catch (error) {
            console.error('Error en companyService.getAll:', error);
            throw error;
        }
    },

    /**
     * Obtener la empresa del usuario autenticado
     * Útil para usuarios normales y admins que solo ven su empresa
     */
    async getMyCompany() {
        try {
            const response = await api.get('api/companies/me');
            return response;
        } catch (error) {
            console.error('Error en companyService.getMyCompany:', error);
            throw error;
        }
    },

    /**
     * Obtener empresa por ID
     * @param {number} id - ID de la empresa
     */
    async getById(id) {
        try {
            const response = await api.get(`api/companies/${id}`);
            return response;
        } catch (error) {
            console.error(`Error en companyService.getById(${id}):`, error);
            throw error;
        }
    },

    /**
     * Crear nueva empresa (solo super_admin)
     * @param {Object} companyData - Datos de la empresa
     * @param {string} companyData.name - Nombre (requerido)
     * @param {string} companyData.business_name - Razón social (opcional)
     * @param {string} companyData.tax_id - RUC/NIT (opcional)
     * @param {string} companyData.email - Email (opcional)
     * @param {string} companyData.phone - Teléfono (opcional)
     * @param {string} companyData.address - Dirección (opcional)
     * @param {string} companyData.subscription_plan - 'free', 'basic', 'pro', 'enterprise'
     * @param {boolean} companyData.is_active - Estado activo/inactivo
     */
    async create(companyData) {
        try {
            const response = await api.post('api/companies', companyData);
            return response;
        } catch (error) {
            console.error('Error en companyService.create:', error);
            throw error;
        }
    },

    /**
     * Actualizar empresa
     * @param {number} id - ID de la empresa
     * @param {Object} companyData - Datos a actualizar
     */
    async update(id, companyData) {
        try {
            const response = await api.put(`api/companies/${id}`, companyData);
            return response;
        } catch (error) {
            console.error(`Error en companyService.update(${id}):`, error);
            throw error;
        }
    },

    /**
     * Eliminar empresa (solo owner o super_admin)
     * @param {number} id - ID de la empresa
     */
    async delete(id) {
        try {
            const response = await api.delete(`api/companies/${id}`);
            return response;
        } catch (error) {
            console.error(`Error en companyService.delete(${id}):`, error);
            throw error;
        }
    },

    /**
     * Obtener empresas activas para el dashboard público
     * No requiere autenticación
     */
    async getPublicCompanies() {
        try {
            const response = await api.get('api/public/companies');
            return response;
        } catch (error) {
            console.error('Error en companyService.getPublicCompanies:', error);
            throw error;
        }
    },

    /**
     * Obtener empresas activas (alias útil para selects)
     * Para super_admin que quieren filtrar solo empresas activas
     */
    async getActiveCompanies() {
        try {
            // Usar el endpoint público o el normal con filtro
            // Dependiendo de si el usuario está autenticado o no
            const user = api.getUser();

            if (user?.role === 'super_admin') {
                return await this.getAll({ status: 'active' });
            } else {
                // Para usuarios no super_admin, obtener solo su empresa
                const response = await this.getMyCompany();
                if (response.success && response.data) {
                    return {
                        success: true,
                        data: [response.data] // Devolver como array para consistencia
                    };
                }
                return response;
            }
        } catch (error) {
            console.error('Error en companyService.getActiveCompanies:', error);
            throw error;
        }
    },

    /**
     * Formatear empresas para usar en selects (dropdowns)
     * @param {Array} companies - Array de empresas
     * @returns {Array} - Array con id y name
     */
    formatForSelect(companies) {
        if (!Array.isArray(companies)) return [];
        return companies.map(company => ({
            id: company.id,
            name: company.name,
            business_name: company.business_name,
            tax_id: company.tax_id
        }));
    },

    /**
     * Obtener URL del logo de la empresa
     */
    getLogoUrl(companyId) {
        if (!companyId) return null;
        return `${api.baseUrl}/api/companies/${companyId}/logo?t=${Date.now()}`; // timestamp para evitar caché
    },

    /**
     * Subir logo de empresa
     */
    async uploadLogo(companyId, file) {
        const formData = new FormData();
        formData.append('logo', file);

        const response = await api.uploadFile(`api/companies/${companyId}/logo`, formData);
        return response;
    },

    /**
     * Eliminar logo
     */
    async deleteLogo(companyId) {
        const response = await api.delete(`api/companies/${companyId}/logo`);
        return response;
    }
};