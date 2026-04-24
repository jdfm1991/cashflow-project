<?php
// app/Config/Routes.php
return [
    // ============================================
    // RUTAS PÚBLICAS
    // ============================================

    // Ruta raíz
    [
        'method' => 'GET',
        'pattern' => '#^$#',
        'controller' => 'App\\Controllers\\HealthController',
        'action' => 'check',
        'middleware' => []
    ],

    // Health check
    [
        'method' => 'GET',
        'pattern' => '#^api/health$#',
        'controller' => 'App\\Controllers\\HealthController',
        'action' => 'check',
        'middleware' => []
    ],

    // Versión
    [
        'method' => 'GET',
        'pattern' => '#^api/version$#',
        'controller' => 'App\\Controllers\\HealthController',
        'action' => 'version',
        'middleware' => []
    ],

    // ============================================
    // RUTAS DE AUTENTICACIÓN (PÚBLICAS)
    // ============================================

    [
        'method' => 'POST',
        'pattern' => '#^api/auth/register$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'register',
        'middleware' => []
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/auth/login$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'login',
        'middleware' => []
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/auth/refresh$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'refresh',
        'middleware' => []
    ],

    // ============================================
    // RUTAS PROTEGIDAS (REQUIEREN AUTENTICACIÓN)
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^api/auth/me$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'me',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/auth/logout$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'logout',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/auth/change-password$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'changePassword',
        'middleware' => ['AuthMiddleware']
    ],
    // Agrega esto en tus rutas para probar
    [
        'method' => 'GET',
        'pattern' => '#^api/auth/check$#',
        'controller' => 'App\\Controllers\\AuthController',
        'action' => 'checkAuth',
        'middleware' => ['AuthMiddleware']
    ],

    // app/Config/Routes.php

    // ============================================
    // RUTAS DE MIGRACIÓN DE DATOS
    // ============================================

    // Conexiones
    [
        'method' => 'GET',
        'pattern' => '#^api/migrations/connections$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'getConnections',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/migrations/connections$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'createConnection',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/migrations/connections/(\d+)$#',  // ← NUEVA RUTA DELETE
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'deleteConnection',
        'middleware' => ['AuthMiddleware']
    ],

    // Migración
    [
        'method' => 'POST',
        'pattern' => '#^api/migrations/preview$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'preview',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/migrations/execute$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'execute',
        'middleware' => ['AuthMiddleware']
    ],

    // Años y meses disponibles
    [
        'method' => 'GET',
        'pattern' => '#^api/migrations/years$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'getAvailableYears',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/migrations/months$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'getAvailableMonths',
        'middleware' => ['AuthMiddleware']
    ],

    // Logs
    [
        'method' => 'GET',
        'pattern' => '#^api/migrations/logs$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'getLogs',
        'middleware' => ['AuthMiddleware']
    ],

    // Test connection
    [
        'method' => 'GET',
        'pattern' => '#^api/migrations/test-connection$#',
        'controller' => 'App\\Controllers\\MigrationController',
        'action' => 'testConnection',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE EMPRESAS (NUEVAS)
    // ============================================

    // Empresas públicas (solo las activas, sin autenticación)
    [
        'method' => 'GET',
        'pattern' => '#^api/public/companies$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'getPublicCompanies',
        'middleware' => []
    ],

    // Listar todas las empresas (solo admin global)
    [
        'method' => 'GET',
        'pattern' => '#^api/companies$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],

    // Crear empresa
    [
        'method' => 'POST',
        'pattern' => '#^api/companies$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],

    // Obtener empresa del usuario autenticado
    [
        'method' => 'GET',
        'pattern' => '#^api/companies/me$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'myCompany',
        'middleware' => ['AuthMiddleware']
    ],

    // Obtener empresa específica
    [
        'method' => 'GET',
        'pattern' => '#^api/companies/(\d+)$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],

    // Actualizar empresa
    [
        'method' => 'PUT',
        'pattern' => '#^api/companies/(\d+)$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],

    // Eliminar empresa
    [
        'method' => 'DELETE',
        'pattern' => '#^api/companies/(\d+)$#',
        'controller' => 'App\\Controllers\\CompanyController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS PÚBLICAS DEL DASHBOARD
    // ============================================

    // Estadísticas públicas del dashboard (sin autenticación)
    [
        'method' => 'GET',
        'pattern' => '#^api/public/dashboard/stats$#',
        'controller' => 'App\\Controllers\\DashboardController',
        'action' => 'getPublicStats',
        'middleware' => []  // ✅ Sin autenticación
    ],

    // Tendencias públicas
    [
        'method' => 'GET',
        'pattern' => '#^api/public/dashboard/trends$#',
        'controller' => 'App\\Controllers\\DashboardController',
        'action' => 'getPublicTrends',
        'middleware' => []
    ],

    // Transacciones recientes públicas
    [
        'method' => 'GET',
        'pattern' => '#^api/public/dashboard/recent-transactions$#',
        'controller' => 'App\\Controllers\\DashboardController',
        'action' => 'getPublicRecentTransactions',
        'middleware' => []
    ],

    // Distribución por categorías pública
    [
        'method' => 'GET',
        'pattern' => '#^api/public/dashboard/category-distribution$#',
        'controller' => 'App\\Controllers\\DashboardController',
        'action' => 'getPublicCategoryDistribution',
        'middleware' => []
    ],

    // ✅ NUEVA RUTA: Flujo de caja público
    [
        'method' => 'GET',
        'pattern' => '#^api/public/dashboard/cashflow$#',
        'controller' => 'App\\Controllers\\DashboardController',
        'action' => 'getPublicCashFlow',
        'middleware' => []
    ],

    // ============================================
    // RUTAS DE USUARIOS (solo super_admin)
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/users$#',
        'controller' => 'App\\Controllers\\UserController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/users$#',
        'controller' => 'App\\Controllers\\UserController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/users/(\d+)$#',
        'controller' => 'App\\Controllers\\UserController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^api/users/(\d+)$#',
        'controller' => 'App\\Controllers\\UserController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/users/(\d+)$#',
        'controller' => 'App\\Controllers\\UserController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE CUENTAS
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^api/accounts$#',
        'controller' => 'App\\Controllers\\AccountController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/accounts$#',
        'controller' => 'App\\Controllers\\AccountController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'GET',
        'pattern' => '#^api/accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\AccountController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'PUT',
        'pattern' => '#^api/accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\AccountController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'DELETE',
        'pattern' => '#^api/accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\AccountController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE INGRESOS
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^api/incomes$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'getIncomes',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/incomes$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'createIncome',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'GET',
        'pattern' => '#^api/incomes/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'getIncome',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'PUT',
        'pattern' => '#^api/incomes/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'updateIncome',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'DELETE',
        'pattern' => '#^api/incomes/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'deleteIncome',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE EGRESOS
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^api/expenses$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'getExpenses',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'POST',
        'pattern' => '#^api/expenses$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'createExpense',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'GET',
        'pattern' => '#^api/expenses/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'getExpense',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'PUT',
        'pattern' => '#^api/expenses/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'updateExpense',
        'middleware' => ['AuthMiddleware']
    ],

    [
        'method' => 'DELETE',
        'pattern' => '#^api/expenses/(\d+)$#',
        'controller' => 'App\\Controllers\\TransactionController',
        'action' => 'deleteExpense',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE BANCOS (Catálogo Global)
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/banks$#',
        'controller' => 'App\\Controllers\\BankController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/banks$#',
        'controller' => 'App\\Controllers\\BankController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/banks/(\d+)$#',
        'controller' => 'App\\Controllers\\BankController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^api/banks/(\d+)$#',
        'controller' => 'App\\Controllers\\BankController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/banks/(\d+)$#',
        'controller' => 'App\\Controllers\\BankController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE CUENTAS BANCARIAS (Por Empresa)
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/bank-accounts$#',
        'controller' => 'App\\Controllers\\BankAccountController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/bank-accounts$#',
        'controller' => 'App\\Controllers\\BankAccountController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/bank-accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\BankAccountController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^api/bank-accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\BankAccountController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/bank-accounts/(\d+)$#',
        'controller' => 'App\\Controllers\\BankAccountController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE MONEDAS
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/currencies$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/currencies/all$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'all',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/currencies/base$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'getBase',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/currencies/(\d+)$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/currencies$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^api/currencies/(\d+)$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/currencies/(\d+)$#',
        'controller' => 'App\\Controllers\\CurrencyController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // app/Config/Routes.php - Agregar después de las rutas de bancos

    // ============================================
    // RUTAS DE TASAS DE CAMBIO
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/exchange-rates$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'index',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/exchange-rates/all$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'getAll',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/exchange-rates$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'store',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/exchange-rates/(\d+)$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'show',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^api/exchange-rates/(\d+)$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'update',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^api/exchange-rates/(\d+)$#',
        'controller' => 'App\\Controllers\\ExchangeRateController',
        'action' => 'destroy',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE CARGA MASIVA (CONCILIACIÓN)
    // ============================================
    [
        'method' => 'GET',
        'pattern' => '#^api/uploads/banks$#',
        'controller' => 'App\\Controllers\\UploadController',
        'action' => 'getBanks',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'GET',
        'pattern' => '#^api/uploads/bank-accounts$#',
        'controller' => 'App\\Controllers\\UploadController',
        'action' => 'getBankAccounts',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/uploads/bank-statement$#',
        'controller' => 'App\\Controllers\\UploadController',
        'action' => 'uploadBankStatement',
        'middleware' => ['AuthMiddleware']
    ],
    [
        'method' => 'POST',
        'pattern' => '#^api/uploads/map-transactions$#',
        'controller' => 'App\\Controllers\\UploadController',
        'action' => 'mapTransactions',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTAS DE REPORTES
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^api/reports/cash-flow$#',
        'controller' => 'App\\Controllers\\ReportController',
        'action' => 'cashFlow',
        'middleware' => ['AuthMiddleware']
    ],

    // ============================================
    // RUTA POR DEFECTO (404)
    // ============================================

    [
        'method' => 'GET',
        'pattern' => '#^.*$#',
        'controller' => 'App\\Controllers\\ErrorController',
        'action' => 'notFound',
        'middleware' => []
    ],
    [
        'method' => 'POST',
        'pattern' => '#^.*$#',
        'controller' => 'App\\Controllers\\ErrorController',
        'action' => 'notFound',
        'middleware' => []
    ],
    [
        'method' => 'PUT',
        'pattern' => '#^.*$#',
        'controller' => 'App\\Controllers\\ErrorController',
        'action' => 'notFound',
        'middleware' => []
    ],
    [
        'method' => 'DELETE',
        'pattern' => '#^.*$#',
        'controller' => 'App\\Controllers\\ErrorController',
        'action' => 'notFound',
        'middleware' => []
    ]


];
