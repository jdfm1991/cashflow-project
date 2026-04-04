-- ============================================
-- TRIGGERS
-- ============================================

DELIMITER //

-- Trigger: Actualizar balance de cuenta al insertar ingreso
CREATE TRIGGER tr_income_after_insert
AFTER INSERT ON incomes
FOR EACH ROW
BEGIN
    UPDATE accounts 
    SET current_balance = current_balance + NEW.amount
    WHERE id = NEW.account_id;
END //

-- Trigger: Actualizar balance de cuenta al eliminar ingreso
CREATE TRIGGER tr_income_after_delete
AFTER DELETE ON incomes
FOR EACH ROW
BEGIN
    UPDATE accounts 
    SET current_balance = current_balance - OLD.amount
    WHERE id = OLD.account_id;
END //

-- Trigger: Actualizar balance de cuenta al insertar egreso
CREATE TRIGGER tr_expense_after_insert
AFTER INSERT ON expenses
FOR EACH ROW
BEGIN
    UPDATE accounts 
    SET current_balance = current_balance - NEW.amount
    WHERE id = NEW.account_id;
END //

-- Trigger: Actualizar balance de cuenta al eliminar egreso
CREATE TRIGGER tr_expense_after_delete
AFTER DELETE ON expenses
FOR EACH ROW
BEGIN
    UPDATE accounts 
    SET current_balance = current_balance + OLD.amount
    WHERE id = OLD.account_id;
END //

-- Trigger: Registrar auditoría al crear usuario
CREATE TRIGGER tr_user_after_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_data)
    VALUES (NEW.id, 'CREATE', 'user', NEW.id, JSON_OBJECT('username', NEW.username, 'email', NEW.email, 'role', NEW.role));
END //

DELIMITER ;