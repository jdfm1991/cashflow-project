// modules/login.js (agregar enlace de registro)
export const loginModule = {
    async render(container) {
        container.innerHTML = `
            <div class="row justify-content-center align-items-center min-vh-100">
                <div class="col-md-5 col-lg-4">
                    <div class="card shadow-lg border-0 rounded-4">
                        <div class="card-header bg-primary text-white text-center py-4 rounded-top-4">
                            <h2 class="mb-0">💰 FlowControl</h2>
                            <p class="mb-0 small">Sistema de Flujo de Caja</p>
                        </div>
                        <div class="card-body p-4">
                            <form id="loginForm">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-envelope"></i> Email o Usuario
                                    </label>
                                    <input type="text" class="form-control form-control-lg" 
                                           id="username" 
                                           placeholder="usuario@ejemplo.com"
                                           required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-lock"></i> Contraseña
                                    </label>
                                    <input type="password" class="form-control form-control-lg" 
                                           id="password" 
                                           placeholder="••••••••"
                                           required>
                                </div>
                                <button type="submit" class="btn btn-primary btn-lg w-100 mb-3" id="loginBtn">
                                    <i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión
                                </button>
                                <hr class="my-3">
                                <div class="text-center">
                                    <small class="text-muted">
                                        ¿No tienes cuenta? 
                                        <a href="#" id="registerLink" class="text-primary">Regístrate aquí</a>
                                    </small>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        const form = document.getElementById('loginForm');
        const submitBtn = document.getElementById('loginBtn');
        const registerLink = document.getElementById('registerLink');
        
        // Evento de login
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            if (!username || !password) {
                showAlert('Por favor ingrese usuario y contraseña', 'warning');
                return;
            }
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Ingresando...';
            
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
                    
                    showAlert('Inicio de sesión exitoso', 'success');
                    window.location.hash = 'dashboard';
                    
                } else {
                    showAlert(response.message || 'Credenciales incorrectas', 'danger');
                }
                
            } catch (error) {
                console.error('Error en login:', error);
                showAlert(error.message || 'Error al conectar con el servidor', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión';
            }
        });
        
        // Evento de registro
        if (registerLink) {
            registerLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegisterForm();
            });
        }
        
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                form.dispatchEvent(new Event('submit'));
            }
        });
    },
    
    showRegisterForm() {
        const container = document.getElementById('app-content');
        container.innerHTML = `
            <div class="row justify-content-center align-items-center min-vh-100">
                <div class="col-md-5 col-lg-4">
                    <div class="card shadow-lg border-0 rounded-4">
                        <div class="card-header bg-success text-white text-center py-4 rounded-top-4">
                            <h2 class="mb-0">📝 Crear Cuenta</h2>
                            <p class="mb-0 small">Regístrate para comenzar</p>
                        </div>
                        <div class="card-body p-4">
                            <form id="registerForm">
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-person"></i> Nombre Completo
                                    </label>
                                    <input type="text" class="form-control" id="fullName" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-person-badge"></i> Usuario
                                    </label>
                                    <input type="text" class="form-control" id="username" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-envelope"></i> Email
                                    </label>
                                    <input type="email" class="form-control" id="email" required>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-lock"></i> Contraseña
                                    </label>
                                    <input type="password" class="form-control" id="password" required>
                                </div>
                                <div class="mb-4">
                                    <label class="form-label fw-semibold">
                                        <i class="bi bi-lock-fill"></i> Confirmar Contraseña
                                    </label>
                                    <input type="password" class="form-control" id="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-success btn-lg w-100 mb-3" id="registerBtn">
                                    <i class="bi bi-person-plus"></i> Registrarse
                                </button>
                                <hr class="my-3">
                                <div class="text-center">
                                    <small class="text-muted">
                                        ¿Ya tienes cuenta? 
                                        <a href="#" id="loginLink" class="text-primary">Iniciar Sesión</a>
                                    </small>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.setupRegisterEvents();
    },
    
    setupRegisterEvents() {
        const form = document.getElementById('registerForm');
        const submitBtn = document.getElementById('registerBtn');
        const loginLink = document.getElementById('loginLink');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const fullName = document.getElementById('fullName').value.trim();
            const username = document.getElementById('username').value.trim();
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
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
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Registrando...';
            
            try {
                const response = await api.post('api/auth/register', {
                    full_name: fullName,
                    username: username,
                    email: email,
                    password: password
                }, false);
                
                if (response.success) {
                    showAlert('Usuario registrado exitosamente. Ahora puedes iniciar sesión.', 'success');
                    // Volver al login
                    window.location.hash = 'login';
                } else {
                    showAlert(response.message || 'Error al registrar usuario', 'danger');
                }
                
            } catch (error) {
                console.error('Error en registro:', error);
                showAlert(error.message || 'Error al conectar con el servidor', 'danger');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="bi bi-person-plus"></i> Registrarse';
            }
        });
        
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.hash = 'login';
            });
        }
    }
};