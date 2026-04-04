-- ============================================
-- VISTAS ÚTILES PARA REPORTES Y DASHBOARD
-- ============================================

-- Vista: Resumen mensual de ingresos por usuario
CREATE OR REPLACE VIEW view_monthly_income AS
SELECT 
    user_id,
    YEAR(date) as year,
    MONTH(date) as month,
    DATE_FORMAT(date, '%Y-%m') as period,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount
FROM incomes
GROUP BY user_id, YEAR(date), MONTH(date), DATE_FORMAT(date, '%Y-%m');

-- Vista: Resumen mensual de egresos por usuario
CREATE OR REPLACE VIEW view_monthly_expense AS
SELECT 
    user_id,
    YEAR(date) as year,
    MONTH(date) as month,
    DATE_FORMAT(date, '%Y-%m') as period,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as average_amount
FROM expenses
GROUP BY user_id, YEAR(date), MONTH(date), DATE_FORMAT(date, '%Y-%m');

-- Vista: Flujo de caja mensual
CREATE OR REPLACE VIEW view_monthly_cashflow AS
SELECT 
    COALESCE(i.user_id, e.user_id) as user_id,
    COALESCE(i.year, e.year) as year,
    COALESCE(i.month, e.month) as month,
    COALESCE(i.period, e.period) as period,
    COALESCE(i.total_amount, 0) as total_income,
    COALESCE(e.total_amount, 0) as total_expense,
    COALESCE(i.total_amount, 0) - COALESCE(e.total_amount, 0) as balance,
    COALESCE(i.transaction_count, 0) as income_count,
    COALESCE(e.transaction_count, 0) as expense_count
FROM view_monthly_income i
LEFT JOIN view_monthly_expense e ON i.user_id = e.user_id AND i.period = e.period
UNION
SELECT 
    COALESCE(i.user_id, e.user_id) as user_id,
    COALESCE(i.year, e.year) as year,
    COALESCE(i.month, e.month) as month,
    COALESCE(i.period, e.period) as period,
    COALESCE(i.total_amount, 0) as total_income,
    COALESCE(e.total_amount, 0) as total_expense,
    COALESCE(i.total_amount, 0) - COALESCE(e.total_amount, 0) as balance,
    COALESCE(i.transaction_count, 0) as income_count,
    COALESCE(e.transaction_count, 0) as expense_count
FROM view_monthly_expense e
LEFT JOIN view_monthly_income i ON e.user_id = i.user_id AND e.period = i.period
WHERE i.user_id IS NULL;

-- Vista: Resumen por categorías
CREATE OR REPLACE VIEW view_category_summary AS
SELECT 
    'income' as type,
    i.user_id,
    a.category,
    a.name as account_name,
    COUNT(*) as transaction_count,
    SUM(i.amount) as total_amount,
    AVG(i.amount) as average_amount,
    MIN(i.amount) as min_amount,
    MAX(i.amount) as max_amount
FROM incomes i
INNER JOIN accounts a ON i.account_id = a.id
GROUP BY i.user_id, a.category, a.name
UNION ALL
SELECT 
    'expense' as type,
    e.user_id,
    a.category,
    a.name as account_name,
    COUNT(*) as transaction_count,
    SUM(e.amount) as total_amount,
    AVG(e.amount) as average_amount,
    MIN(e.amount) as min_amount,
    MAX(e.amount) as max_amount
FROM expenses e
INNER JOIN accounts a ON e.account_id = a.id
GROUP BY e.user_id, a.category, a.name;

-- Vista: Top 10 transacciones por monto
CREATE OR REPLACE VIEW view_top_transactions AS
SELECT 
    'income' as type,
    id,
    user_id,
    account_id,
    amount,
    date,
    description,
    reference
FROM incomes
UNION ALL
SELECT 
    'expense' as type,
    id,
    user_id,
    account_id,
    amount,
    date,
    description,
    reference
FROM expenses
ORDER BY amount DESC
LIMIT 10;