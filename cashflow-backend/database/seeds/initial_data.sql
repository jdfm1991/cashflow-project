-- ============================================
-- DATOS INICIALES DEL SISTEMA
-- ============================================

-- Insertar categorías del sistema (INGRESOS)
INSERT INTO categories (name, type, icon, color, is_system, sort_order) VALUES
('Ventas', 'income', 'bi-cart', '#28a745', TRUE, 1),
('Alquileres', 'income', 'bi-house', '#17a2b8', TRUE, 2),
('Servicios', 'income', 'bi-gear', '#20c997', TRUE, 3),
('Intereses', 'income', 'bi-percent', '#fd7e14', TRUE, 4),
('Comisiones', 'income', 'bi-coin', '#6f42c1', TRUE, 5),
('Reembolsos', 'income', 'bi-arrow-return-left', '#0dcaf0', TRUE, 6),
('Otros Ingresos', 'income', 'bi-plus-circle', '#6c757d', TRUE, 7);

-- Insertar categorías del sistema (EGRESOS)
INSERT INTO categories (name, type, icon, color, is_system, sort_order) VALUES
('Impuestos', 'expense', 'bi-receipt', '#dc3545', TRUE, 1),
('Nómina', 'expense', 'bi-people', '#fd7e14', TRUE, 2),
('Honorarios', 'expense', 'bi-briefcase', '#6f42c1', TRUE, 3),
('Proveedores', 'expense', 'bi-truck', '#20c997', TRUE, 4),
('Servicios Públicos', 'expense', 'bi-lightbulb', '#ffc107', TRUE, 5),
('Alquileres', 'expense', 'bi-building', '#17a2b8', TRUE, 6),
('Mantenimiento', 'expense', 'bi-tools', '#6c757d', TRUE, 7),
('Publicidad', 'expense', 'bi-megaphone', '#e83e8c', TRUE, 8),
('Transporte', 'expense', 'bi-bus-front', '#20c997', TRUE, 9),
('Seguros', 'expense', 'bi-shield-check', '#0dcaf0', TRUE, 10),
('Software', 'expense', 'bi-code-square', '#0d6efd', TRUE, 11),
('Papelería', 'expense', 'bi-file-text', '#6f42c1', TRUE, 12),
('Capacitación', 'expense', 'bi-mortarboard', '#fd7e14', TRUE, 13),
('Otros Egresos', 'expense', 'bi-dash-circle', '#6c757d', TRUE, 14);

-- Insertar usuario administrador por defecto
-- Contraseña: admin123 (hash generado con password_hash)
INSERT INTO users (username, email, password_hash, full_name, role, email_verified, is_active) VALUES
('admin', 'admin@cashflow.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrador', 'admin', TRUE, TRUE);

-- Insertar usuario demo
-- Contraseña: demo123
INSERT INTO users (username, email, password_hash, full_name, role, email_verified, is_active) VALUES
('demo', 'demo@cashflow.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Usuario Demo', 'user', TRUE, TRUE);

-- Insertar preferencias para usuario demo
INSERT INTO user_preferences (user_id, language, currency, date_format, timezone) VALUES
(2, 'es', 'COP', 'Y-m-d', 'America/Bogota');

-- Insertar cuentas de ejemplo para usuario demo
INSERT INTO accounts (user_id, name, type, category, initial_balance, current_balance, is_active) VALUES
(2, 'Ventas Online', 'income', 'ventas', 0, 0, TRUE),
(2, 'Ventas Físicas', 'income', 'ventas', 0, 0, TRUE),
(2, 'Alquiler Oficina', 'income', 'alquileres', 0, 0, TRUE),
(2, 'Intereses Bancarios', 'income', 'intereses', 0, 0, TRUE),
(2, 'Impuestos', 'expense', 'impuestos', 0, 0, TRUE),
(2, 'Nómina', 'expense', 'nomina', 0, 0, TRUE),
(2, 'Proveedores', 'expense', 'proveedores', 0, 0, TRUE),
(2, 'Servicios Públicos', 'expense', 'servicios_publicos', 0, 0, TRUE),
(2, 'Marketing', 'expense', 'publicidad', 0, 0, TRUE);

-- Insertar ingresos de ejemplo para usuario demo (últimos 3 meses)
INSERT INTO incomes (user_id, account_id, amount, date, description, reference) VALUES
(2, 1, 1500.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Venta de productos online - Enero', 'FACT-001'),
(2, 1, 2200.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Venta de productos online - Enero', 'FACT-002'),
(2, 2, 800.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Venta en tienda física', 'TICKET-001'),
(2, 1, 1800.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Venta de productos online - Febrero', 'FACT-003'),
(2, 1, 2100.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Venta de productos online - Febrero', 'FACT-004'),
(2, 3, 1000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Alquiler local comercial', 'CONTRATO-001'),
(2, 1, 2500.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Venta de productos online - Marzo', 'FACT-005'),
(2, 2, 950.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Venta en tienda física', 'TICKET-002'),
(2, 4, 50.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Intereses cuenta de ahorros', 'INT-001');

-- Insertar egresos de ejemplo para usuario demo
INSERT INTO expenses (user_id, account_id, amount, date, description, reference) VALUES
(2, 5, 500.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Pago impuesto de renta', ''),
(2, 6, 3000.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Nómina empleados', 'NOM-001'),
(2, 7, 1200.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Compra insumos', 'OC-001'),
(2, 8, 350.00, DATE_SUB(CURDATE(), INTERVAL 2 MONTH), 'Servicios públicos', ''),
(2, 5, 450.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Pago impuesto IVA', ''),
(2, 6, 3000.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Nómina empleados', 'NOM-002'),
(2, 7, 1500.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Compra insumos', 'OC-002'),
(2, 9, 800.00, DATE_SUB(CURDATE(), INTERVAL 1 MONTH), 'Campaña publicitaria', 'PUB-001'),
(2, 5, 520.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Pago impuesto de renta', ''),
(2, 6, 3200.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Nómina empleados', 'NOM-003'),
(2, 7, 1100.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Compra insumos', 'OC-003'),
(2, 8, 380.00, DATE_SUB(CURDATE(), INTERVAL 0 MONTH), 'Servicios públicos', '');