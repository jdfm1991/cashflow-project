const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://api.tudominio.com';  // URL de producción

class ApiService {
    constructor() {
        this.baseUrl = API_BASE_URL;
        this.token = localStorage.getItem('access_token');
    }

    getHeaders(requiresAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (requiresAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    async handleResponse(response) {
        const contentType = response.headers.get('content-type');

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();

            if (!response.ok) {
                // Caso 1: Error 401 sin estar autenticado (login fallido)
                if (response.status === 401 && !this.token) {
                    // Esto es un error de autenticación normal (credenciales incorrectas)
                    throw new Error(data.message || 'Credenciales incorrectas');
                }

                // Caso 2: Error 401 estando autenticado (sesión expirada)
                if (response.status === 401 && this.token) {
                    this.logout();
                    window.location.hash = 'login';
                    throw new Error('Sesión expirada. Por favor inicie sesión nuevamente.');
                }

                // Otros errores
                throw new Error(data.message || 'Error en la petición');
            }

            return data;
        }

        return response;
    }

    async get(endpoint, requiresAuth = true) {
        try {
            const response = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'GET',
                headers: this.getHeaders(requiresAuth)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Error GET ${endpoint}:`, error);
            throw error;
        }
    }

    async post(endpoint, data, requiresAuth = true) {
        try {
            const response = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'POST',
                headers: this.getHeaders(requiresAuth),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Error POST ${endpoint}:`, error);
            // Re-lanzar el error para que el componente lo maneje
            throw error;
        }
    }

    async put(endpoint, data, requiresAuth = true) {
        try {
            const response = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'PUT',
                headers: this.getHeaders(requiresAuth),
                body: JSON.stringify(data)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Error PUT ${endpoint}:`, error);
            throw error;
        }
    }

    async delete(endpoint, requiresAuth = true) {
        try {
            const response = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'DELETE',
                headers: this.getHeaders(requiresAuth)
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Error DELETE ${endpoint}:`, error);
            throw error;
        }
    }

    async uploadFile(endpoint, formData, requiresAuth = true) {
        try {
            const headers = {};
            if (requiresAuth && this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(`${this.baseUrl}/${endpoint}`, {
                method: 'POST',
                headers: headers,
                body: formData
            });
            return await this.handleResponse(response);
        } catch (error) {
            console.error(`Error UPLOAD ${endpoint}:`, error);
            throw error;
        }
    }

    setToken(token) {
        this.token = token;
        localStorage.setItem('access_token', token);
        console.log('Token saved, length:', token ? token.length : 0);
    }

    setAuthData(responseData) {
        // Manejar diferentes estructuras de respuesta
        const token = responseData.access_token || responseData.token;

        if (token) {
            this.setToken(token);
        }

        // Guardar refresh token si existe
        if (responseData.refresh_token) {
            localStorage.setItem('refresh_token', responseData.refresh_token);
        }

        // Guardar datos del usuario
        if (responseData.user) {
            localStorage.setItem('user_data', JSON.stringify(responseData.user));
        }

        // Guardar datos de la empresa
        if (responseData.company) {
            localStorage.setItem('company_data', JSON.stringify(responseData.company));
        }

        return !!token;
    }

    setRefreshToken(token) {
        localStorage.setItem('refresh_token', token);
    }

    getRefreshToken() {
        return localStorage.getItem('refresh_token');
    }

    logout() {
        this.token = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('company_data');
    }

    isAuthenticated() {
        return !!this.token;
    }

    getUser() {
        const userData = localStorage.getItem('user_data');
        if (userData) {
            try {
                return JSON.parse(userData);
            } catch (e) {
                return null;
            }
        }

        // Intentar obtener del token
        const token = this.token || localStorage.getItem('access_token');
        if (token) {
            try {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload && payload.user_id) {
                    const user = {
                        id: payload.user_id,
                        username: payload.username,
                        email: payload.email,
                        role: payload.role || 'user',
                        company_id: payload.company_id
                    };
                    localStorage.setItem('user_data', JSON.stringify(user));
                    return user;
                }
            } catch (e) {
                console.error('Error parsing token:', e);
            }
        }

        return null;
    }

    getCompany() {
        const companyData = localStorage.getItem('company_data');
        if (companyData) {
            try {
                return JSON.parse(companyData);
            } catch (e) {
                return null;
            }
        }
        return null;
    }
}

export const api = new ApiService();