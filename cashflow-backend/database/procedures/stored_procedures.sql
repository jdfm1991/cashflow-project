-- ============================================
-- PROCEDIMIENTOS ALMACENADOS
-- ============================================

DELIMITER //

-- Procedimiento: Obtener balance acumulado
CREATE PROCEDURE sp_get_balance(
    IN p_user_id INT,
    IN p_start_date DATE,
    IN p_end_date DATE
)
BEGIN
    SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense,
        SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as balance
    FROM (
        SELECT 'income' as type, amount, date FROM incomes WHERE user_id = p_user_id AND date BETWEEN p_start_date AND p_end_date
        UNION ALL
        SELECT 'expense' as type, amount, date FROM expenses WHERE user_id = p_user_id AND date BETWEEN p_start_date AND p_end_date
    ) t;
END //

-- Procedimiento: Limpiar tokens expirados
CREATE PROCEDURE sp_clean_expired_tokens()
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < NOW();
    DELETE FROM password_resets WHERE expires_at < NOW();
    DELETE FROM email_verifications WHERE expires_at < NOW();
    DELETE FROM upload_sessions WHERE expires_at < NOW();
END //

-- Procedimiento: Obtener estadísticas de usuario
CREATE PROCEDURE sp_get_user_stats(
    IN p_user_id INT
)
BEGIN
    -- Total ingresos
    SELECT COALESCE(SUM(amount), 0) INTO @total_income FROM incomes WHERE user_id = p_user_id;
    
    -- Total egresos
    SELECT COALESCE(SUM(amount), 0) INTO @total_expense FROM expenses WHERE user_id = p_user_id;
    
    -- Número de cuentas
    SELECT COUNT(*) INTO @accounts_count FROM accounts WHERE user_id = p_user_id;
    
    -- Número de transacciones
    SELECT COUNT(*) INTO @transactions_count FROM (
        SELECT id FROM incomes WHERE user_id = p_user_id
        UNION ALL
        SELECT id FROM expenses WHERE user_id = p_user_id
    ) t;
    
    -- Fecha del primer registro
    SELECT MIN(date) INTO @first_transaction FROM (
        SELECT date FROM incomes WHERE user_id = p_user_id
        UNION ALL
        SELECT date FROM expenses WHERE user_id = p_user_id
    ) t;
    
    -- Resultado
    SELECT 
        @total_income as total_income,
        @total_expense as total_expense,
        @total_income - @total_expense as balance,
        @accounts_count as accounts_count,
        @transactions_count as transactions_count,
        @first_transaction as first_transaction;
END //

DELIMITER ;