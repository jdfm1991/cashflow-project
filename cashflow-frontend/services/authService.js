import { api } from './apiService.js';

export const authService = {
    async login(usernameOrEmail, password) {
        const response = await api.post('api/auth/login', {
            username_or_email: usernameOrEmail,
            password: password
        }, false);

        if (response.success && response.data) {
            if (response.data.access_token) {
                api.setToken(response.data.access_token);
            }
            if (response.data.refresh_token) {
                api.setRefreshToken(response.data.refresh_token);
            }
            if (response.data.user) {
                localStorage.setItem('user_data', JSON.stringify(response.data.user));
            }
            if (response.data.company) {
                localStorage.setItem('company_data', JSON.stringify(response.data.company));
            }
        }

        return response;
    },

    async register(userData) {
        return await api.post('api/auth/register', userData, false);
    },

    async logout() {
        try {
            await api.post('api/auth/logout');
        } catch (error) {
            console.error('Error en logout:', error);
        } finally {
            api.logout();
        }
    },

    async getCurrentUser() {
        const response = await api.get('api/auth/me');
        if (response.success && response.data) {
            if (response.data.user) {
                localStorage.setItem('user_data', JSON.stringify(response.data.user));
            }
            if (response.data.company) {
                localStorage.setItem('company_data', JSON.stringify(response.data.company));
            }
        }
        return response;
    },

    async changePassword(currentPassword, newPassword) {
        return await api.post('api/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: newPassword
        });
    },

    getUser() {
        return api.getUser();
    },

    getCompany() {
        return api.getCompany();
    },

    isAuthenticated() {
        return api.isAuthenticated();
    }
};