// assets/js/main.js
import { api } from '../../services/apiService.js';
import { loadComponent, showAlert } from '../../utils/helpers.js';
import { dashboardModule } from '../../modules/dashboard.js';
import { accountsModule } from '../../modules/accounts.js';
import { incomeModule } from '../../modules/income.js';
import { expenseModule } from '../../modules/expense.js';
import { statementsModule } from '../../modules/statements.js';
import { reportsModule } from '../../modules/reports.js';
import { loginModule } from '../../modules/login.js';
import { companiesModule } from '../../modules/companies.js';
import { usersModule } from '../../modules/users.js';
import { currenciesModule } from '../../modules/currencies.js';
import { exchangeRatesModule } from '../../modules/exchange-rates.js';
import { banksModule } from '../../modules/banks.js';
import { bankAccountsModule } from '../../modules/bank-accounts.js';

// Map of routes to modules
const routes = {
    'login': loginModule,
    'dashboard': dashboardModule,
    'companies': companiesModule,
    'users': usersModule,
    'accounts': accountsModule,
    'currencies': currenciesModule,
    'exchange-rates': exchangeRatesModule,
    'banks': banksModule,
    'bank-accounts': bankAccountsModule,
    'income': incomeModule,
    'expense': expenseModule,
    'statements': statementsModule,
    'reports': reportsModule
};

// Módulos que requieren autenticación
const protectedRoutes = [
    'accounts',
    'income',
    'expense',
    'statements',
    'reports',
    'currencies',
    'exchange-rates',
    'banks',
    'bank-accounts',
    'companies',
    'users'
];

// Módulos que solo super_admin puede ver
const superAdminRoutes = ['companies', 'users', 'banks', 'accounts', 'bank-accounts'];

// Elementos del DOM
let loginModal, registerModal;
let publicMenu, privateMenu;
let publicNavbar, privateNavbar;

// ============================================
// FUNCIONES DE AUTENTICACIÓN Y PERMISOS
// ============================================

// Función para verificar autenticación y permisos
function checkAuth() {
    const hash = window.location.hash.substring(1) || 'dashboard';

    // Verificar autenticación para rutas protegidas
    if (protectedRoutes.includes(hash) && !api.isAuthenticated()) {
        window.location.hash = 'login';
        return false;
    }

    // Verificar permisos para rutas de super_admin
    if (superAdminRoutes.includes(hash)) {
        const user = api.getUser();
        const userRole = user?.role || 'user';
        if (userRole !== 'super_admin') {
            showAlert('No tienes permisos para acceder a esta sección', 'warning');
            window.location.hash = 'dashboard';
            return false;
        }
    }

    return true;
}

// Función para actualizar la interfaz según autenticación
function updateUIForAuth() {
    // Obtener información de autenticación
    const isAuthenticated = api.isAuthenticated();
    const user = api.getUser();
    const userRole = user?.role || 'user';

    // Si no hay usuario en localStorage pero estamos autenticados, intentar obtenerlo
    if (isAuthenticated && !user) {
        // Intentar obtener usuario del token o hacer una petición
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                // Decodificar token para obtener información básica
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload && payload.user_id) {
                    user = {
                        id: payload.user_id,
                        role: payload.role || 'user',
                        username: payload.username,
                        email: payload.email
                    };
                    localStorage.setItem('user_data', JSON.stringify(user));
                }
            } catch (e) {
                console.error('Error decoding token:', e);
            }
        }
    }

    console.log('updateUIForAuth - isAuthenticated:', isAuthenticated, 'userRole:', userRole);

    // El sidebar y navbar deben actualizarse, pero el contenido del dashboard no debe ocultarse
    if (publicMenu) publicMenu.style.display = isAuthenticated ? 'none' : 'block';
    if (privateMenu) privateMenu.style.display = isAuthenticated ? 'block' : 'none';
    if (publicNavbar) publicNavbar.style.display = isAuthenticated ? 'none' : 'block';
    if (privateNavbar) privateNavbar.style.display = isAuthenticated ? 'block' : 'none';

    // Actualizar visibilidad de elementos según rol
    if (typeof window.updateMenuByRole === 'function') {
        window.updateMenuByRole(userRole);
    }

    if (user) {
        const userNameSpan = document.getElementById('userName');
        const userEmailSpan = document.getElementById('userEmail');
        if (userNameSpan) userNameSpan.textContent = user.full_name || user.username || 'Usuario';
        if (userEmailSpan) userEmailSpan.textContent = user.email || '';
    }

    // Actualizar visibilidad de elementos según rol
    /* const superAdminItems = document.querySelectorAll('.super-admin-only');
    if (userRole === 'super_admin') {
        superAdminItems.forEach(item => item.style.display = 'block');
    } else {
        superAdminItems.forEach(item => item.style.display = 'none');
    }

    if (user) {
        const userNameSpan = document.getElementById('userName');
        const userEmailSpan = document.getElementById('userEmail');
        if (userNameSpan) userNameSpan.textContent = user.full_name || user.username || 'Usuario';
        if (userEmailSpan) userEmailSpan.textContent = user.email || '';
    } */
}

// Función para cerrar sesión
async function logout() {
    try {
        if (api.isAuthenticated()) {
            await api.post('api/auth/logout', {}, true);
        }
    } catch (error) {
        console.error('Error en logout:', error);
    } finally {
        api.logout();
        showAlert('Sesión cerrada exitosamente', 'success');
        updateUIForAuth();
        // ✅ Solo actualizar la UI, no recargar el dashboard
        // Si estamos en una ruta protegida, redirigir al dashboard
        const currentHash = window.location.hash.substring(1) || 'dashboard';
        if (protectedRoutes.includes(currentHash)) {
            window.location.hash = 'dashboard';
        }
    }
}

// Función para mostrar modal de login
function showLoginModal() {
    if (loginModal) {
        document.getElementById('modalUsername').value = '';
        document.getElementById('modalPassword').value = '';
        loginModal.show();
    }
}

// Función para mostrar modal de registro
function showRegisterModal() {
    if (registerModal) {
        document.getElementById('modalFullName').value = '';
        document.getElementById('modalRegUsername').value = '';
        document.getElementById('modalRegEmail').value = '';
        document.getElementById('modalRegPassword').value = '';
        document.getElementById('modalRegConfirmPassword').value = '';
        registerModal.show();
    }
}

// Configurar eventos de login modal
function setupLoginModal() {
    const form = document.getElementById('loginFormModal');
    const submitBtn = document.getElementById('modalLoginBtn');

    if (form) {
        // Eliminar event listeners anteriores
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('modalUsername').value.trim();
            const password = document.getElementById('modalPassword').value;

            if (!username || !password) {
                showAlert('Por favor ingrese usuario y contraseña', 'warning');
                return;
            }

            const submitButton = document.getElementById('modalLoginBtn');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Ingresando...';

            try {
                const response = await api.post('api/auth/login', {
                    username_or_email: username,
                    password: password
                }, false);

                if (response.success && response.data && response.data.access_token) {
                    api.setToken(response.data.access_token);
                    if (response.data.refresh_token) {
                        api.setRefreshToken(response.data.refresh_token);
                    }
                    if (response.data.user) {
                        localStorage.setItem('user_data', JSON.stringify(response.data.user));
                    }
                    if (response.data.company) {
                        localStorage.setItem('company_data', JSON.stringify(response.data.company));
                    }

                    // Forzar actualización del menú después del login
                    setTimeout(() => {
                        updateUIForAuth();
                        if (typeof window.updateMenuByRole === 'function') {
                            window.updateMenuByRole(response.data.user.role);
                        }
                    }, 100);

                    showAlert('Inicio de sesión exitoso', 'success');

                    const modalElement = document.getElementById('loginModal');
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();

                    window.location.hash = 'dashboard';
                    await loadRoute('dashboard');
                }
            } catch (error) {
                console.error('Error en login:', error);
                let errorMessage = 'Error al conectar con el servidor';
                if (error.message) {
                    if (error.message.includes('Usuario') || error.message.includes('contraseña')) {
                        errorMessage = 'Usuario o contraseña incorrectos';
                    } else {
                        errorMessage = error.message;
                    }
                }
                showAlert(errorMessage, 'danger');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }

    const registerLink = document.getElementById('modalRegisterLink');
    if (registerLink) {
        const newRegisterLink = registerLink.cloneNode(true);
        registerLink.parentNode.replaceChild(newRegisterLink, registerLink);

        newRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.hide();
            showRegisterModal();
        });
    }
}

// Configurar eventos de registro modal
function setupRegisterModal() {
    const form = document.getElementById('registerFormModal');
    const submitBtn = document.getElementById('modalRegisterBtn');

    if (form) {
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const fullName = document.getElementById('modalFullName').value.trim();
            const username = document.getElementById('modalRegUsername').value.trim();
            const email = document.getElementById('modalRegEmail').value.trim();
            const password = document.getElementById('modalRegPassword').value;
            const confirmPassword = document.getElementById('modalRegConfirmPassword').value;

            if (!fullName || !username || !email || !password) {
                showAlert('Por favor complete todos los campos', 'warning');
                return;
            }

            if (password !== confirmPassword) {
                showAlert('Las contraseñas no coinciden', 'warning');
                return;
            }

            if (password.length < 6) {
                showAlert('La contraseña debe tener al menos 6 caracteres', 'warning');
                return;
            }

            const submitButton = document.getElementById('modalRegisterBtn');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Registrando...';

            try {
                const response = await api.post('api/auth/register', {
                    full_name: fullName,
                    username: username,
                    email: email,
                    password: password
                }, false);

                if (response.success) {
                    showAlert('Usuario registrado exitosamente. Ahora puedes iniciar sesión.', 'success');
                    if (registerModal) registerModal.hide();
                    showLoginModal();
                } else {
                    showAlert(response.message || 'Error al registrar usuario', 'danger');
                }
            } catch (error) {
                console.error('Error en registro:', error);
                showAlert(error.message || 'Error al conectar con el servidor', 'danger');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
            }
        });
    }

    const loginLink = document.getElementById('modalLoginLink');
    if (loginLink) {
        const newLoginLink = loginLink.cloneNode(true);
        loginLink.parentNode.replaceChild(newLoginLink, loginLink);

        newLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerModal) registerModal.hide();
            showLoginModal();
        });
    }
}

// Configurar botones de login en navbar y sidebar
function setupAuthButtons() {
    const navbarLoginBtn = document.getElementById('navbarLoginBtn');
    const sidebarLoginBtn = document.getElementById('showLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (navbarLoginBtn) {
        const newBtn = navbarLoginBtn.cloneNode(true);
        navbarLoginBtn.parentNode.replaceChild(newBtn, navbarLoginBtn);
        newBtn.addEventListener('click', () => showLoginModal());
    }
    if (sidebarLoginBtn) {
        const newBtn = sidebarLoginBtn.cloneNode(true);
        sidebarLoginBtn.parentNode.replaceChild(newBtn, sidebarLoginBtn);
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginModal();
        });
    }
    if (logoutBtn) {
        const newBtn = logoutBtn.cloneNode(true);
        logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logout();
        });
    }
}

// ============================================
// FUNCIONES DE CARGA DE COMPONENTES Y RUTAS
// ============================================

// Cargar layout (sidebar, navbar, footer)
async function loadLayout() {
    console.log('Cargando layout...');

    // Eliminar botón toggle duplicado si existe
    const existingToggle = document.getElementById('mobileMenuToggle');
    if (existingToggle && !existingToggle.hasAttribute('data-keep')) {
        existingToggle.remove();
    }

    await loadComponent('sidebar-container', 'components/sidebar.html');
    await loadComponent('navbar-container', 'components/navbar.html');
    await loadComponent('footer-container', 'components/footer.html');

    console.log('Layout cargado correctamente');

    updateFooterInfo();

    const developerLink = document.getElementById('developerLink');
    if (developerLink) {
        developerLink.addEventListener('click', (e) => {
            e.preventDefault();
            showAlert('FlowControl - Sistema de Flujo de Caja\nVersión 1.0.0\nDesarrollado por CashFlow Team', 'info');
        });
    }

    publicMenu = document.getElementById('publicMenu');
    privateMenu = document.getElementById('privateMenu');
    publicNavbar = document.getElementById('publicNavbar');
    privateNavbar = document.getElementById('privateNavbar');

    // ✅ Esperar a que el DOM se actualice antes de actualizar UI
    setTimeout(() => {
        updateUIForAuth();
        setupAuthButtons();
    }, 100);

    // ✅ Re-inicializar eventos del sidebar después de cargar
    setTimeout(() => {
        if (document.getElementById('sidebar')) {
            const scripts = document.querySelectorAll('#sidebar-container script');
            scripts.forEach(script => {
                // Ejecutar el script que contiene la inicialización del sidebar
                const newScript = document.createElement('script');
                newScript.textContent = script.textContent;
                document.body.appendChild(newScript);
                script.remove();
            });
        }
    }, 150);
}

// Cargar ruta
async function loadRoute(route) {
    const contentDiv = document.getElementById('app-content');
    const module = routes[route];

    if (module) {
        await module.render(contentDiv);

        const navTitle = document.getElementById('page-title');
        if (navTitle) {
            const titles = {
                dashboard: 'Dashboard',
                companies: 'Empresas',
                users: 'Usuarios',
                accounts: 'Cuentas Contables',
                currencies: 'Monedas',
                'exchange-rates': 'Tasas de Cambio',
                banks: 'Bancos',
                'bank-accounts': 'Cuentas Bancarias',
                income: 'Ingresos',
                expense: 'Egresos',
                statements: 'Carga Masiva',
                reports: 'Reportes',
                login: 'Iniciar Sesión'
            };
            navTitle.innerText = titles[route] || route;
        }

        setTimeout(() => {
            document.querySelectorAll('.sidebar .nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${route}`) {
                    link.classList.add('active');
                }
            });
        }, 100);
    } else {
        contentDiv.innerHTML = '<div class="alert alert-danger">Módulo no encontrado</div>';
    }
}

// Función para actualizar la información del footer
function updateFooterInfo() {
    const versionElement = document.getElementById('appVersion');
    if (versionElement) {
        versionElement.textContent = '1.0.0';
    }
}

// Manejar cambio de hash (incluye verificación de autenticación)
async function handleHashChange() {
    // ✅ LLAMAR A checkAuth() AQUÍ
    if (!checkAuth()) return;

    const hash = window.location.hash.substring(1) || 'dashboard';
    await loadRoute(hash);
}

// ============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// ============================================

async function initApp() {
    console.log('Inicializando aplicación...');

    // Cargar layout completo
    await loadLayout();

    // Inicializar modales
    loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    registerModal = new bootstrap.Modal(document.getElementById('registerModal'));

    // Configurar eventos de modales
    setupLoginModal();
    setupRegisterModal();

    // ✅ Forzar actualización del menú después de que todo esté cargado
    setTimeout(() => {
        const user = api.getUser();
        const userRole = user?.role || 'user';
        if (typeof window.updateMenuByRole === 'function') {
            window.updateMenuByRole(userRole);
        }
    }, 200);

    // ✅ VERIFICAR AUTENTICACIÓN AL INICIO
    const initialHash = window.location.hash.substring(1) || 'dashboard';

    // Verificar autenticación antes de cargar la ruta inicial
    if (protectedRoutes.includes(initialHash) && !api.isAuthenticated()) {
        window.location.hash = 'login';
        await loadRoute('login');
    } else if (superAdminRoutes.includes(initialHash)) {
        const user = api.getUser();
        const userRole = user?.role || 'user';
        if (userRole !== 'super_admin') {
            showAlert('No tienes permisos para acceder a esta sección', 'warning');
            window.location.hash = 'dashboard';
            await loadRoute('dashboard');
        } else {
            await loadRoute(initialHash);
        }
    } else {
        await loadRoute(initialHash);
    }

    // ✅ ESCUCHAR CAMBIOS DE HASH
    window.addEventListener('hashchange', handleHashChange);

    // Escuchar evento personalizado para mostrar modal de login
    document.addEventListener('showLoginModal', () => {
        showLoginModal();
    });

    console.log('Aplicación inicializada correctamente');
}

// Iniciar la aplicación
initApp();