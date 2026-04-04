-- ============================================
-- SISTEMA DE FLUJO DE CAJA - MULTIEMPRESA
-- Versión: 2.0.0
-- Fecha: 2026-04-01
-- ============================================

-- Deshabilitar verificación de claves foráneas
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- ELIMINAR TABLAS SI EXISTEN (EN ORDEN INVERSO)
-- ============================================

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS user_preferences;
DROP TABLE IF EXISTS upload_sessions;
DROP TABLE IF EXISTS email_verifications;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS incomes;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS categories;

-- ============================================
-- 1. TABLA DE EMPRESAS (TENANT)
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL COMMENT 'Nombre comercial',
    business_name VARCHAR(200) COMMENT 'Razón social',
    tax_id VARCHAR(50) UNIQUE COMMENT 'NIT / RUC / RFC',
    email VARCHAR(100) COMMENT 'Email corporativo',
    phone VARCHAR(20) COMMENT 'Teléfono',
    address TEXT COMMENT 'Dirección',
    logo VARCHAR(255) COMMENT 'Ruta del logo',
    theme VARCHAR(50) DEFAULT 'light' COMMENT 'Tema visual',
    subscription_plan ENUM('free', 'basic', 'pro', 'enterprise') DEFAULT 'free',
    subscription_expires_at DATETIME NULL COMMENT 'Fecha de expiración de suscripción',
    max_users INT DEFAULT 5 COMMENT 'Límite de usuarios',
    max_accounts INT DEFAULT 50 COMMENT 'Límite de cuentas por empresa (catálogo global)',
    max_transactions_per_month INT DEFAULT 500 COMMENT 'Límite de transacciones mensuales',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_tax_id (tax_id),
    INDEX idx_is_active (is_active),
    INDEX idx_subscription_plan (subscription_plan)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 2. TABLA DE USUARIOS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL COMMENT 'Empresa a la que pertenece',
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    avatar VARCHAR(255) NULL,
    role ENUM('super_admin', 'admin', 'user') DEFAULT 'user' COMMENT 'Rol global',
    role_in_company ENUM('owner', 'admin', 'user') DEFAULT 'user' COMMENT 'Rol dentro de la empresa',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login DATETIME NULL,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_company_id (company_id),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active),
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. TABLA DE CATEGORÍAS (GLOBALES - COMPARTIDAS)
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    icon VARCHAR(50) DEFAULT 'bi-tag',
    color VARCHAR(7) DEFAULT '#6c757d',
    description TEXT NULL,
    is_system BOOLEAN DEFAULT FALSE COMMENT 'Categoría del sistema (no editable)',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_is_active (is_active),
    UNIQUE KEY unique_category_name (name, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 4. TABLA DE CUENTAS (CATÁLOGO GLOBAL - COMPARTIDAS POR TODAS LAS EMPRESAS)
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NULL,
    is_system BOOLEAN DEFAULT FALSE COMMENT 'Cuenta del sistema',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_type (type),
    INDEX idx_category (category),
    INDEX idx_is_active (is_active),
    
    FOREIGN KEY (category) REFERENCES categories(name) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. TABLA DE INGRESOS (POR EMPRESA - AISLADOS)
-- ============================================
CREATE TABLE IF NOT EXISTS incomes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL COMMENT 'Empresa propietaria',
    user_id INT NOT NULL COMMENT 'Usuario que registró',
    account_id INT NOT NULL COMMENT 'Cuenta del catálogo global',
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT NULL,
    reference VARCHAR(100) NULL,
    receipt_path VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_company_id (company_id),
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_date (date),
    INDEX idx_amount (amount),
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. TABLA DE EGRESOS (POR EMPRESA - AISLADOS)
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL COMMENT 'Empresa propietaria',
    user_id INT NOT NULL COMMENT 'Usuario que registró',
    account_id INT NOT NULL COMMENT 'Cuenta del catálogo global',
    amount DECIMAL(15,2) NOT NULL,
    date DATE NOT NULL,
    description TEXT NULL,
    reference VARCHAR(100) NULL,
    receipt_path VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_company_id (company_id),
    INDEX idx_user_id (user_id),
    INDEX idx_account_id (account_id),
    INDEX idx_date (date),
    INDEX idx_amount (amount),
    
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. TABLA DE REFRESH TOKENS
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token (token),
    INDEX idx_expires_at (expires_at),
    INDEX idx_user_id (user_id),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. TABLA DE RECUPERACIÓN DE CONTRASEÑA
-- ============================================
CREATE TABLE IF NOT EXISTS password_resets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token (token),
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. TABLA DE VERIFICACIÓN DE EMAIL
-- ============================================
CREATE TABLE IF NOT EXISTS email_verifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_token (token),
    INDEX idx_user_id (user_id),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 10. TABLA DE SESIONES DE CARGA (UPLOADS)
-- ============================================
CREATE TABLE IF NOT EXISTS upload_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    upload_id VARCHAR(100) NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    type ENUM('income', 'expense') NOT NULL,
    total_rows INT DEFAULT 0,
    processed_rows INT DEFAULT 0,
    failed_rows INT DEFAULT 0,
    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    error_log TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_company_id (company_id),
    INDEX idx_upload_id (upload_id),
    INDEX idx_status (status),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 11. TABLA DE PREFERENCIAS DE USUARIO
-- ============================================
CREATE TABLE IF NOT EXISTS user_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    company_id INT NOT NULL,
    language VARCHAR(10) DEFAULT 'es',
    currency VARCHAR(3) DEFAULT 'COP',
    date_format VARCHAR(20) DEFAULT 'Y-m-d',
    timezone VARCHAR(50) DEFAULT 'America/Bogota',
    notifications_email BOOLEAN DEFAULT TRUE,
    notifications_push BOOLEAN DEFAULT FALSE,
    theme VARCHAR(20) DEFAULT 'light',
    dashboard_layout JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 12. TABLA DE NOTIFICACIONES
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_company_id (company_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 13. TABLA DE AUDITORÍA (LOGS)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    company_id INT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NULL,
    entity_id INT NULL,
    old_data JSON NULL,
    new_data JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_company_id (company_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Insertar categorías del sistema (globales)
INSERT INTO categories (name, type, icon, color, is_system, sort_order) VALUES
('Ventas', 'income', 'bi-cart', '#28a745', TRUE, 1),
('Alquileres', 'income', 'bi-house', '#17a2b8', TRUE, 2),
('Servicios', 'income', 'bi-gear', '#20c997', TRUE, 3),
('Intereses', 'income', 'bi-percent', '#fd7e14', TRUE, 4),
('Otros Ingresos', 'income', 'bi-plus-circle', '#6c757d', TRUE, 5),
('Impuestos', 'expense', 'bi-receipt', '#dc3545', TRUE, 1),
('Nómina', 'expense', 'bi-people', '#fd7e14', TRUE, 2),
('Honorarios', 'expense', 'bi-briefcase', '#6f42c1', TRUE, 3),
('Proveedores', 'expense', 'bi-truck', '#20c997', TRUE, 4),
('Servicios Públicos', 'expense', 'bi-lightbulb', '#ffc107', TRUE, 5),
('Alquileres', 'expense', 'bi-building', '#17a2b8', TRUE, 6),
('Mantenimiento', 'expense', 'bi-tools', '#6c757d', TRUE, 7),
('Publicidad', 'expense', 'bi-megaphone', '#e83e8c', TRUE, 8),
('Transporte', 'expense', 'bi-bus-front', '#20c997', TRUE, 9),
('Otros Egresos', 'expense', 'bi-dash-circle', '#6c757d', TRUE, 10);

-- Insertar cuentas del sistema (catálogo global)
INSERT INTO accounts (name, type, category, is_system, sort_order) VALUES
('Ventas Online', 'income', 'Ventas', TRUE, 1),
('Ventas Físicas', 'income', 'Ventas', TRUE, 2),
('Alquiler Local', 'income', 'Alquileres', TRUE, 3),
('Consultoría', 'income', 'Servicios', TRUE, 4),
('Intereses Bancarios', 'income', 'Intereses', TRUE, 5),
('Impuesto de Renta', 'expense', 'Impuestos', TRUE, 1),
('IVA', 'expense', 'Impuestos', TRUE, 2),
('Nómina Mensual', 'expense', 'Nómina', TRUE, 3),
('Honorarios Profesionales', 'expense', 'Honorarios', TRUE, 4),
('Compra Insumos', 'expense', 'Proveedores', TRUE, 5),
('Energía Eléctrica', 'expense', 'Servicios Públicos', TRUE, 6),
('Agua', 'expense', 'Servicios Públicos', TRUE, 7),
('Internet', 'expense', 'Servicios Públicos', TRUE, 8);

-- Insertar empresa demo
INSERT INTO companies (name, business_name, tax_id, email, subscription_plan, is_active) VALUES
('Demo Company', 'Demo Company S.A.S.', '901234567-1', 'demo@cashflow.com', 'free', 1);

-- Insertar usuario demo (contraseña: demo123)
INSERT INTO users (company_id, username, email, password_hash, full_name, role, role_in_company, is_active, email_verified) VALUES
(1, 'demo', 'demo@cashflow.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Usuario Demo', 'admin', 'owner', 1, 1);

-- Insertar usuario admin global (contraseña: admin123)
INSERT INTO users (company_id, username, email, password_hash, full_name, role, role_in_company, is_active, email_verified) VALUES
(1, 'admin', 'admin@cashflow.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador Global', 'super_admin', 'admin', 1, 1);

-- ============================================
-- REACTIVAR VERIFICACIÓN DE CLAVES FORÁNEAS
-- ============================================
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
SELECT '✅ Base de datos multiempresa creada exitosamente!' as message;