<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Models\ExchangeRate;
use App\Helpers\Response;
use App\Helpers\Validator;

class TransactionController
{
    private Income $incomeModel;
    private Expense $expenseModel;
    private Account $accountModel;
    private ExchangeRate $exchangeRateModel;

    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
        $this->exchangeRateModel = new ExchangeRate();
    }

    /**
     * GET /api/incomes
     * Obtener ingresos con filtros avanzados
     */
    public function getIncomes(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        // Obtener filtros
        $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int) $_GET['company_id'] : null;
        $year = $_GET['year'] ?? null;
        $month = $_GET['month'] ?? null;
        $accountId = isset($_GET['account_id']) ? (int) $_GET['account_id'] : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;

        // Construir filtros
        $filters = [];

        if ($year && !empty($year)) {
            if ($month && !empty($month)) {
                $monthPadded = str_pad($month, 2, '0', STR_PAD_LEFT);
                $filters['start_date'] = "{$year}-{$monthPadded}-01";
                $filters['end_date'] = date("Y-m-t", strtotime($filters['start_date']));
            } else {
                $filters['start_date'] = "{$year}-01-01";
                $filters['end_date'] = "{$year}-12-31";
            }
        }

        if ($accountId) {
            $filters['account_id'] = $accountId;
        }

        error_log("=== GET INCOMES ===");
        error_log("Role: " . $userRole);
        error_log("Company ID filter: " . ($companyId ?? 'null'));
        error_log("Filters: " . json_encode($filters));

        // Obtener ingresos según el rol
        if ($userRole === 'super_admin') {
            $incomes = $this->incomeModel->getGlobalWithFilters($filters, $limit);
        } else {
            $userCompanyId = $this->getCompanyId($userId);
            $incomes = $this->incomeModel->getByCompanyWithFilters($userCompanyId, $filters, $limit);
        }

        // Convertir montos a float
        foreach ($incomes as &$income) {
            $income['amount'] = (float) $income['amount'];
            $income['amount_base_currency'] = (float) ($income['amount_base_currency'] ?? $income['amount']);
            $income['exchange_rate'] = (float) ($income['exchange_rate'] ?? 1);
        }

        $total = array_sum(array_column($incomes, 'amount_base_currency'));

        // ✅ CORREGIDO: Devolver 'incomes', no 'expenses'
        Response::success([
            'incomes' => $incomes,   // ← Esto debe ser 'incomes'
            'total' => $total,
            'count' => count($incomes)
        ]);
    }

    // Método helper para obtener company_id
    private function getCompanyId(int $userId): int
    {
        if ($userId <= 0) {
            return 0;
        }

        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['company_id'] ?? 0;
    }

    /**
     * Obtener rol del usuario autenticado
     */
    private function getUserRole(int $userId): string
    {
        if ($userId <= 0) {
            return 'guest';
        }

        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['role'] ?? 'user';
    }

    /**
     * POST /api/incomes
     * Crear nuevo ingreso (con soporte para conversión de moneda)
     */
    public function createIncome(): void
    {

        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        // ✅ LOG para depuración
        error_log("=== CREATE INCOME ===");
        error_log("Datos recibidos: " . json_encode($data));



        // ✅ CORREGIDO: Determinar company_id según el rol
        $companyId = null;

        if ($userRole === 'super_admin') {
            if (isset($data['company_id']) && $data['company_id'] > 0) {
                $companyId = (int) $data['company_id'];
                error_log("Super admin creando ingreso para empresa: {$companyId}");
            } else {
                $companyId = $this->getCompanyId($userId);
                error_log("Super admin sin company_id específico, usando su empresa: {$companyId}");
            }
        } else {
            $companyId = $this->getCompanyId($userId);
            error_log("Usuario normal creando ingreso para su empresa: {$companyId}");
        }

        if ($userId <= 0 || $companyId <= 0) {
            Response::unauthorized('Usuario no autenticado o sin empresa asociada');
            return;
        }

        // Validaciones
        $validator = new Validator($data);
        $validator->required('account_id');
        $validator->numeric('account_id');
        $validator->required('amount');
        $validator->numeric('amount');
        $validator->min('amount', 0.01);
        $validator->required('date');
        $validator->date('date', 'Y-m-d');
        $validator->optional('currency_id');
        $validator->numeric('currency_id');
        $validator->required('payment_method');
        $validator->in('payment_method', ['cash', 'bank']);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Validar fecha futura
        if (!$this->validateDateNotFuture($data['date'])) {
            Response::validationError(['date' => 'No se puede registrar una transacción con fecha futura']);
            return;
        }

        // Verificar cuenta
        $account = $this->accountModel->find((int) $data['account_id']);
        if (!$account || $account['type'] !== 'income') {
            Response::validationError(['account_id' => 'Cuenta no válida para ingreso']);
            return;
        }
        // ========== MANEJO DE MONEDA Y CONVERSIÓN ==========
        // ✅ PRIORIZAR valores enviados por el frontend

        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();

        // Obtener moneda seleccionada (del frontend o por defecto)
        $currencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : ($baseCurrency['id'] ?? 9);
        $amount = (float) $data['amount'];

        // ✅ VERIFICAR si el frontend ya envió valores calculados
        $exchangeRate = isset($data['exchange_rate']) ? (float) $data['exchange_rate'] : null;
        $amountBaseCurrency = isset($data['amount_base_currency']) ? (float) $data['amount_base_currency'] : null;

        // Verificar que la moneda existe
        $currencyModel = new \App\Models\Currency();
        $currency = $currencyModel->find($currencyId);
        if (!$currency) {
            Response::validationError(['currency_id' => 'Moneda no válida']);
            return;
        }

        // ✅ SOLO recalcular si el frontend NO envió los valores
        if ($exchangeRate === null || $amountBaseCurrency === null) {
            error_log("⚠️ Frontend no envió exchange_rate o amount_base_currency, recalculando...");

            if ($baseCurrency && $currencyId != $baseCurrency['id']) {
                $conversion = $currencyService->convert($amount, $currencyId, $baseCurrency['id'], $data['date']);

                if ($conversion['success']) {
                    $exchangeRate = $conversion['rate'];
                    $amountBaseCurrency = $conversion['converted_amount'];
                } else {
                    Response::validationError([
                        'currency_id' => "No se encontró tasa de cambio para {$currency['code']} a {$baseCurrency['code']} en la fecha {$data['date']}"
                    ]);
                    return;
                }
            } else {
                $exchangeRate = 1;
                $amountBaseCurrency = $amount;
            }
        } else {
            error_log("✅ Usando valores enviados por el frontend: exchange_rate=$exchangeRate, amount_base_currency=$amountBaseCurrency");
        }

        // ========== FIN DE LA NUEVA LÓGICA ==========

        $incomeData = [
            'company_id' => $companyId,
            'user_id' => $userId,
            'account_id' => (int) $data['account_id'],
            'bank_id' => $data['bank_id'] ?? null,  // ✅ Agregar bank_id
            'amount' => $amount,
            'currency_id' => $currencyId,
            'exchange_rate' => $exchangeRate,
            'amount_base_currency' => $amountBaseCurrency,
            'date' => $data['date'],
            'description' => $data['description'] ?? null,
            'reference' => $data['reference'] ?? null,
            'payment_method' => $data['payment_method']
        ];

        error_log("=== CREATE INCOME - BANK DEBUG ===");
        error_log("Datos recibidos: " . json_encode($data));
        error_log("Bank ID recibido: " . ($data['bank_id'] ?? 'no enviado'));
        error_log("Payment method: " . ($data['payment_method'] ?? 'no enviado'));

        // Después de crear $incomeData
        error_log("IncomeData a guardar: " . json_encode($incomeData));

        $income = $this->incomeModel->create($incomeData);

        if ($income) {
            // ✅ Procesar actualización de saldo bancario
            $bankBalanceService = new \App\Services\BankBalanceService();
            $bankBalanceService->processIncomeBalance($income);

            Response::success($income, 'Ingreso registrado exitosamente', 201);
        } else {
            Response::error('Error al registrar el ingreso', 500);
        }
    }

    /**
     * GET /api/incomes/{id}
     * Obtener ingreso específico
     */
    public function getIncome(int $id): void
    {
        $userId = $this->getUserId();

        $income = $this->incomeModel->find($id);

        if (!$income) {
            Response::notFound('Ingreso no encontrado');
            return;
        }

        if ($income['user_id'] != $userId) {
            Response::forbidden('No autorizado');
            return;
        }

        // Obtener datos de la cuenta
        $account = $this->accountModel->find($income['account_id']);
        $income['account_name'] = $account['name'] ?? null;
        $income['category'] = $account['category'] ?? null;

        Response::success($income);
    }

    /**
     * PUT /api/incomes/{id}
     * Actualizar ingreso (con soporte para conversión de moneda)
     */
    public function updateIncome(int $id): void
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $income = $this->incomeModel->find($id);

        if (!$income) {
            Response::notFound('Ingreso no encontrado');
            return;
        }

        // ========== VALIDACIÓN DE PERMISOS ==========
        if ($userRole !== 'super_admin') {
            if ($income['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para editar este ingreso');
                return;
            }
        }

        // Validaciones básicas
        $validator = new Validator($data ?? []);
        $validator->optional('account_id');
        $validator->numeric('account_id');
        $validator->optional('amount');
        $validator->numeric('amount');
        $validator->min('amount', 0.01);
        $validator->optional('currency_id');
        $validator->numeric('currency_id');

        if (isset($data['date'])) {
            $validator->required('date');
            $validator->date('date', 'Y-m-d');
            if (!$this->validateDateNotFuture($data['date'])) {
                Response::validationError(['date' => 'No se puede establecer una fecha futura']);
                return;
            }
        }

        $validator->optional('description');
        $validator->string('description');
        $validator->maxLength('description', 500);
        $validator->optional('reference');
        $validator->string('reference');
        $validator->maxLength('reference', 100);
        $validator->optional('payment_method');
        $validator->in('payment_method', ['cash', 'bank']);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar cuenta si se cambia
        if (isset($data['account_id'])) {
            $account = $this->accountModel->find((int) $data['account_id']);
            if (!$account) {
                Response::notFound('Cuenta no encontrada');
                return;
            }
            if ($account['type'] !== 'income') {
                Response::validationError(['account_id' => 'La cuenta seleccionada no es de tipo ingreso']);
                return;
            }
        }

        // Preparar datos para actualizar
        $updateData = [];

        // Copiar campos simples
        $simpleFields = ['account_id', 'description', 'reference', 'payment_method'];
        foreach ($simpleFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        // Manejar fecha
        if (isset($data['date'])) {
            $updateData['date'] = $data['date'];
        }

        // ========== MANEJO DE MONEDA Y CONVERSIÓN ==========
        // ✅ PRIORIZAR valores enviados por el frontend

        $newAmount = isset($data['amount']) ? (float) $data['amount'] : $income['amount'];
        $newCurrencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : $income['currency_id'];

        // ✅ VERIFICAR si el frontend ya envió valores calculados
        $newExchangeRate = isset($data['exchange_rate']) ? (float) $data['exchange_rate'] : null;
        $newAmountBaseCurrency = isset($data['amount_base_currency']) ? (float) $data['amount_base_currency'] : null;

        $updateData['amount'] = $newAmount;
        $updateData['currency_id'] = $newCurrencyId;

        // ✅ SOLO recalcular si el frontend NO envió los valores
        if ($newExchangeRate !== null && $newAmountBaseCurrency !== null) {
            // Usar valores del frontend
            $updateData['exchange_rate'] = $newExchangeRate;
            $updateData['amount_base_currency'] = $newAmountBaseCurrency;
            error_log("✅ updateIncome: Usando valores del frontend - exchange_rate=$newExchangeRate, amount_base_currency=$newAmountBaseCurrency");
        } else {
            // Recalcular (compatibilidad con versiones anteriores)
            error_log("⚠️ updateIncome: Frontend no envió valores, recalculando...");

            $currencyService = new \App\Services\CurrencyService();
            $baseCurrency = $currencyService->getBaseCurrency();

            $newDate = isset($data['date']) ? $data['date'] : $income['date'];

            if ($baseCurrency && $newCurrencyId != $baseCurrency['id']) {
                $conversion = $currencyService->convert($newAmount, $newCurrencyId, $baseCurrency['id'], $newDate);

                if ($conversion['success']) {
                    $updateData['exchange_rate'] = $conversion['rate'];
                    $updateData['amount_base_currency'] = $conversion['converted_amount'];
                } else {
                    Response::validationError([
                        'currency_id' => "No se encontró tasa de cambio para la fecha {$newDate}"
                    ]);
                    return;
                }
            } else {
                $updateData['exchange_rate'] = 1;
                $updateData['amount_base_currency'] = $newAmount;
            }
        }

        // ... obtener el income original antes de actualizar ...
        $oldIncome = $this->incomeModel->find($id);

        // Actualizar el ingreso
        $updated = $this->incomeModel->update($id, $updateData);

        if ($updated) {
            // ✅ Revertir saldo anterior y aplicar nuevo
            $bankBalanceService = new \App\Services\BankBalanceService();

            // Revertir el saldo de la transacción anterior
            $bankBalanceService->revertBalance('income', $oldIncome);

            // Aplicar el saldo de la nueva transacción
            $newIncome = $this->incomeModel->find($id);
            $bankBalanceService->processIncomeBalance($newIncome);

            Response::success($updated, 'Ingreso actualizado exitosamente');
        } else {
            Response::error('Error al actualizar el ingreso', 500);
        }
    }

    /**
     * DELETE /api/incomes/{id}
     * Eliminar ingreso
     */
    public function deleteIncome(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $income = $this->incomeModel->find($id);

        if (!$income) {
            Response::notFound('Ingreso no encontrado');
            return;
        }

        // ========== VALIDACIÓN DE PERMISOS ==========
        // Super_admin puede eliminar cualquier ingreso
        if ($userRole !== 'super_admin') {
            if ($income['user_id'] != $userId) {
                Response::forbidden('No autorizado para eliminar este ingreso');
                return;
            }
        }
        // ========== FIN VALIDACIÓN ==========

        // ✅ Guardar datos antes de eliminar para revertir saldo
        $incomeData = $income;

        if ($this->incomeModel->delete($id)) {
            // ✅ Revertir el saldo bancario
            $bankBalanceService = new \App\Services\BankBalanceService();
            $bankBalanceService->revertBalance('income', $incomeData);

            Response::success(null, 'Ingreso eliminado exitosamente');
        } else {
            Response::error('Error al eliminar el ingreso', 500);
        }
    }

    /**
     * GET /api/expenses
     * Obtener egresos del usuario
     */
    public function getExpenses(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        // Obtener filtros
        $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int) $_GET['company_id'] : null;
        $year = $_GET['year'] ?? null;
        $month = $_GET['month'] ?? null;
        $accountId = isset($_GET['account_id']) ? (int) $_GET['account_id'] : null;
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : null;

        // Construir filtros
        $filters = [];

        if ($year && !empty($year)) {
            if ($month && !empty($month)) {
                $monthPadded = str_pad($month, 2, '0', STR_PAD_LEFT);
                $filters['start_date'] = "{$year}-{$monthPadded}-01";
                $filters['end_date'] = date("Y-m-t", strtotime($filters['start_date']));
            } else {
                $filters['start_date'] = "{$year}-01-01";
                $filters['end_date'] = "{$year}-12-31";
            }
        }

        if ($accountId) {
            $filters['account_id'] = $accountId;
        }

        error_log("=== GET EXPENSES ===");
        error_log("Role: " . $userRole);
        error_log("Company ID filter: " . ($companyId ?? 'null'));

        // ✅ Obtener egresos según el rol
        if ($userRole === 'super_admin') {
            $expenses = $this->expenseModel->getGlobalWithFilters($filters, $limit);
        } else {
            $userCompanyId = $this->getCompanyId($userId);
            $expenses = $this->expenseModel->getByCompanyWithFilters($userCompanyId, $filters, $limit);
        }

        $total = array_sum(array_column($expenses, 'amount_base_currency'));

        Response::success([
            'expenses' => $expenses,
            'total' => $total,
            'count' => count($expenses)
        ]);
    }
    /**
     * POST /api/expenses
     * Crear nuevo egreso (con soporte para conversión de moneda)
     */
    public function createExpense(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("=== CREATE EXPENSE ===");
        error_log("Datos recibidos: " . json_encode($data));

        // ✅ VALIDACIONES PASO A PASO
        $errors = [];

        // 1. Validar account_id
        if (!isset($data['account_id']) || !is_numeric($data['account_id'])) {
            $errors['account_id'] = 'Cuenta es requerida';
        } else {
            $account = $this->accountModel->find((int)$data['account_id']);
            if (!$account) {
                $errors['account_id'] = 'Cuenta no existe';
            } elseif ($account['type'] !== 'expense') {
                $errors['account_id'] = 'La cuenta no es de tipo egreso';
            }
            error_log("Cuenta verificada: " . json_encode($account));
        }

        // 2. Validar amount
        if (!isset($data['amount']) || !is_numeric($data['amount']) || $data['amount'] <= 0) {
            $errors['amount'] = 'Monto inválido';
        }
        error_log("Amount: " . ($data['amount'] ?? 'no'));

        // 3. Validar date
        if (!isset($data['date'])) {
            $errors['date'] = 'Fecha requerida';
        } else {
            $date = $data['date'];
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
                $errors['date'] = 'Formato de fecha inválido';
            } elseif ($date > date('Y-m-d')) {
                $errors['date'] = 'No se puede registrar con fecha futura';
            }
        }
        error_log("Date: " . ($data['date'] ?? 'no'));

        // 4. Validar payment_method
        if (!isset($data['payment_method']) || !in_array($data['payment_method'], ['cash', 'bank'])) {
            $errors['payment_method'] = 'Método de pago inválido';
        }
        error_log("Payment method: " . ($data['payment_method'] ?? 'no'));

        // 5. Validar currency_id (opcional)
        if (isset($data['currency_id'])) {
            $currencyModel = new \App\Models\Currency();
            $currency = $currencyModel->find((int)$data['currency_id']);
            if (!$currency) {
                $errors['currency_id'] = 'Moneda no existe';
            }
            error_log("Currency: " . json_encode($currency));
        }

        // 6. Validar company_id (para super_admin)
        $companyId = null;
        if ($userRole === 'super_admin') {
            if (isset($data['company_id']) && $data['company_id'] > 0) {
                $companyModel = new \App\Models\Company();
                $company = $companyModel->find((int)$data['company_id']);
                if (!$company) {
                    $errors['company_id'] = 'Empresa no existe';
                }
                $companyId = (int)$data['company_id'];
                error_log("Company: " . json_encode($company));
            } else {
                $companyId = $this->getCompanyId($userId);
            }
        } else {
            $companyId = $this->getCompanyId($userId);
        }

        // Si hay errores, responder
        if (!empty($errors)) {
            error_log("❌ Errores de validación: " . json_encode($errors));
            Response::validationError($errors);
            return;
        }

        error_log("✅ Validaciones pasadas correctamente");

        // Validar fecha futura
        if (!$this->validateDateNotFuture($data['date'])) {
            Response::validationError(['date' => 'No se puede registrar una transacción con fecha futura']);
            return;
        }

        // Verificar cuenta nuevamente (por si acaso)
        $account = $this->accountModel->find((int) $data['account_id']);
        if (!$account || $account['type'] !== 'expense') {
            Response::validationError(['account_id' => 'Cuenta no válida para egreso']);
            return;
        }

        // ========== MANEJO DE MONEDA Y CONVERSIÓN ==========
        // ✅ PRIORIZAR valores enviados por el frontend

        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();

        // Obtener moneda seleccionada (del frontend o por defecto)
        $currencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : ($baseCurrency['id'] ?? 9);
        $amount = (float) $data['amount'];

        // ✅ VERIFICAR si el frontend ya envió valores calculados
        $exchangeRate = isset($data['exchange_rate']) ? (float) $data['exchange_rate'] : null;
        $amountBaseCurrency = isset($data['amount_base_currency']) ? (float) $data['amount_base_currency'] : null;

        // Verificar que la moneda existe
        $currencyModel = new \App\Models\Currency();
        $currency = $currencyModel->find($currencyId);
        if (!$currency) {
            Response::validationError(['currency_id' => 'Moneda no válida']);
            return;
        }

        // ✅ SOLO recalcular si el frontend NO envió los valores
        if ($exchangeRate !== null && $amountBaseCurrency !== null) {
            // Usar valores del frontend
            error_log("✅ createExpense: Usando valores del frontend - exchange_rate=$exchangeRate, amount_base_currency=$amountBaseCurrency");
        } else {
            // Recalcular (compatibilidad con versiones anteriores)
            error_log("⚠️ createExpense: Frontend no envió valores, recalculando...");

            if ($baseCurrency && $currencyId != $baseCurrency['id']) {
                $conversion = $currencyService->convert($amount, $currencyId, $baseCurrency['id'], $data['date']);

                if ($conversion['success']) {
                    $exchangeRate = $conversion['rate'];
                    $amountBaseCurrency = $conversion['converted_amount'];
                    error_log("createExpense: Conversión calculada - rate=$exchangeRate, base=$amountBaseCurrency");
                } else {
                    Response::validationError([
                        'currency_id' => "No se encontró tasa de cambio para {$currency['code']} a {$baseCurrency['code']} en la fecha {$data['date']}"
                    ]);
                    return;
                }
            } else {
                $exchangeRate = 1;
                $amountBaseCurrency = $amount;
                error_log("createExpense: Misma moneda base - rate=1, base=$amountBaseCurrency");
            }
        }

        // Obtener payment_method
        $paymentMethod = $data['payment_method'] ?? 'cash';
        if (!in_array($paymentMethod, ['cash', 'bank'])) {
            $paymentMethod = 'cash';
        }

        // Crear egreso
        $expenseData = [
            'company_id' => $companyId,
            'user_id' => $userId,
            'account_id' => (int) $data['account_id'],
            'bank_id' => $data['bank_id'] ?? null,  // ✅ Agregar bank_id
            'amount' => $amount,
            'currency_id' => $currencyId,
            'exchange_rate' => $exchangeRate,
            'amount_base_currency' => $amountBaseCurrency,
            'date' => $data['date'],
            'description' => $data['description'] ?? null,
            'reference' => $data['reference'] ?? null,
            'payment_method' => $data['payment_method']
        ];

        error_log("Datos de egreso a guardar: " . json_encode($expenseData));

        $expense = $this->expenseModel->create($expenseData);

        if ($expense) {
            // ✅ Procesar actualización de saldo bancario
            $bankBalanceService = new \App\Services\BankBalanceService();
            $bankBalanceService->processExpenseBalance($expense);

            Response::success($expense, 'Egreso registrado exitosamente', 201);
        } else {
            Response::error('Error al registrar el egreso', 500);
        }
    }
    /**
     * GET /api/expenses/{id}
     * Obtener egreso específico
     */
    public function getExpense(int $id): void
    {
        $userId = $this->getUserId();

        $expense = $this->expenseModel->find($id);

        if (!$expense) {
            Response::notFound('Egreso no encontrado');
            return;
        }

        if ($expense['user_id'] != $userId) {
            Response::forbidden('No autorizado');
            return;
        }

        $account = $this->accountModel->find($expense['account_id']);
        $expense['account_name'] = $account['name'] ?? null;
        $expense['category'] = $account['category'] ?? null;

        Response::success($expense);
    }

    /**
     * PUT /api/expenses/{id}
     * Actualizar egreso
     * - Para super_admin: puede editar cualquier egreso (con restricciones según tipo)
     * - Para otros roles: solo egresos de su empresa
     */
    public function updateExpense(int $id): void
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $expense = $this->expenseModel->find($id);

        if (!$expense) {
            Response::notFound('Egreso no encontrado');
            return;
        }

        // Guardar datos originales para revertir saldo
        $oldExpenseData = $expense;

        // Validación de permisos
        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
            if ($expense['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para editar este egreso');
                return;
            }
        }

        // Validaciones básicas
        $validator = new Validator($data ?? []);
        $validator->optional('account_id');
        $validator->numeric('account_id');
        $validator->optional('amount');
        $validator->numeric('amount');
        $validator->min('amount', 0.01);
        $validator->optional('currency_id');
        $validator->numeric('currency_id');

        if (isset($data['date'])) {
            $validator->required('date');
            $validator->date('date', 'Y-m-d');
            if (!$this->validateDateNotFuture($data['date'])) {
                Response::validationError(['date' => 'No se puede establecer una fecha futura']);
                return;
            }
        }

        $validator->optional('description');
        $validator->string('description');
        $validator->maxLength('description', 500);
        $validator->optional('reference');
        $validator->string('reference');
        $validator->maxLength('reference', 100);
        $validator->optional('payment_method');
        $validator->in('payment_method', ['cash', 'bank']);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar cuenta si se cambia
        if (isset($data['account_id'])) {
            $account = $this->accountModel->find((int) $data['account_id']);
            if (!$account) {
                Response::notFound('Cuenta no encontrada');
                return;
            }
            if ($account['type'] !== 'expense') {
                Response::validationError(['account_id' => 'La cuenta seleccionada no es de tipo egreso']);
                return;
            }
        }

        // Preparar datos para actualizar
        $updateData = [];

        // Copiar campos simples
        $simpleFields = ['account_id', 'description', 'reference', 'payment_method'];
        foreach ($simpleFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        // Manejar fecha
        if (isset($data['date'])) {
            $updateData['date'] = $data['date'];
        }

        // ========== MANEJO DE MONEDA Y CONVERSIÓN ==========
        $newAmount = isset($data['amount']) ? (float) $data['amount'] : $expense['amount'];
        $newCurrencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : $expense['currency_id'];

        // VERIFICAR si el frontend ya envió valores calculados
        $newExchangeRate = isset($data['exchange_rate']) ? (float) $data['exchange_rate'] : null;
        $newAmountBaseCurrency = isset($data['amount_base_currency']) ? (float) $data['amount_base_currency'] : null;

        $updateData['amount'] = $newAmount;
        $updateData['currency_id'] = $newCurrencyId;

        // SOLO recalcular si el frontend NO envió los valores
        if ($newExchangeRate !== null && $newAmountBaseCurrency !== null) {
            $updateData['exchange_rate'] = $newExchangeRate;
            $updateData['amount_base_currency'] = $newAmountBaseCurrency;
            error_log("✅ updateExpense: Usando valores del frontend - exchange_rate=$newExchangeRate, amount_base_currency=$newAmountBaseCurrency");
        } else {
            error_log("⚠️ updateExpense: Frontend no envió valores, recalculando...");

            $currencyService = new \App\Services\CurrencyService();
            $baseCurrency = $currencyService->getBaseCurrency();

            $newDate = isset($data['date']) ? $data['date'] : $expense['date'];

            if ($baseCurrency && $newCurrencyId != $baseCurrency['id']) {
                $conversion = $currencyService->convert($newAmount, $newCurrencyId, $baseCurrency['id'], $newDate);

                if ($conversion['success']) {
                    $updateData['exchange_rate'] = $conversion['rate'];
                    $updateData['amount_base_currency'] = $conversion['converted_amount'];
                } else {
                    Response::validationError([
                        'currency_id' => "No se encontró tasa de cambio para la fecha {$newDate}"
                    ]);
                    return;
                }
            } else {
                $updateData['exchange_rate'] = 1;
                $updateData['amount_base_currency'] = $newAmount;
            }
        }

        $updated = $this->expenseModel->update($id, $updateData);

        if ($updated) {
            // ✅ CORREGIDO: Usar BankBalanceService correctamente
            $bankBalanceService = new \App\Services\BankBalanceService();

            // Revertir saldo anterior (solo si era bancario)
            if (isset($oldExpenseData['payment_method']) && $oldExpenseData['payment_method'] === 'bank') {
                $bankBalanceService->revertBalance('expense', $oldExpenseData);
            }

            // Aplicar nuevo saldo
            $newExpenseData = $this->expenseModel->find($id);
            if ($newExpenseData && isset($newExpenseData['payment_method']) && $newExpenseData['payment_method'] === 'bank') {
                $bankBalanceService->processExpenseBalance($newExpenseData);
            }

            Response::success($updated, 'Egreso actualizado exitosamente');
        } else {
            Response::error('Error al actualizar el egreso', 500);
        }
    }
    /**
     * DELETE /api/expenses/{id}
     * Eliminar egreso
     */
    public function deleteExpense(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);  // ← Obtener rol

        $expense = $this->expenseModel->find($id);

        if (!$expense) {
            Response::notFound('Egreso no encontrado');
            return;
        }

        // ========== VALIDACIÓN DE PERMISOS ==========
        // Super_admin puede eliminar cualquier egreso
        if ($userRole !== 'super_admin') {
            // Verificar que el egreso pertenece al usuario
            if ($expense['user_id'] != $userId) {
                Response::forbidden('No autorizado para eliminar este egreso');
                return;
            }
        }
        // ========== FIN VALIDACIÓN ==========

        // ✅ Guardar datos antes de eliminar para revertir saldo
        $expenseData = $expense;

        if ($this->expenseModel->delete($id)) {
            // ✅ Revertir el saldo bancario
            $bankBalanceService = new \App\Services\BankBalanceService();
            $bankBalanceService->revertBalance('expense', $expenseData);

            Response::success(null, 'Egreso eliminado exitosamente');
        } else {
            Response::error('Error al eliminar el Egreso', 500);
        }
    }

    /**
     * Obtener ID de usuario autenticado
     */
    private function getUserId(): int
    {
        // Buscar en $_REQUEST (establecido por AuthMiddleware)
        if (isset($_REQUEST['user_id']) && !empty($_REQUEST['user_id'])) {
            return (int) $_REQUEST['user_id'];
        }

        // Buscar en $_POST
        if (isset($_POST['user_id']) && !empty($_POST['user_id'])) {
            return (int) $_POST['user_id'];
        }

        // Buscar en $_GET
        if (isset($_GET['user_id']) && !empty($_GET['user_id'])) {
            return (int) $_GET['user_id'];
        }

        // Buscar en $_SERVER
        if (isset($_SERVER['USER_ID']) && !empty($_SERVER['USER_ID'])) {
            return (int) $_SERVER['USER_ID'];
        }

        // Intentar extraer del token
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            try {
                $jwtService = new \App\Services\JWTService();
                $payload = $jwtService->validate($matches[1]);
                if ($payload && isset($payload['user_id'])) {
                    return (int) $payload['user_id'];
                }
            } catch (\Exception $e) {
                // Error al validar token
            }
        }

        return 0;
    }

    /**
     * Validar que la fecha no sea futura
     */
    private function validateDateNotFuture(string $date): bool
    {
        $today = date('Y-m-d');
        return $date <= $today;
    }

    /**
     * Validar rango de fechas
     */
    private function validateDateRange(?string $startDate, ?string $endDate): array
    {
        $errors = [];
        $today = date('Y-m-d');

        if ($startDate && $startDate > $today) {
            $errors[] = 'La fecha desde no puede ser mayor al día actual';
        }

        if ($endDate && $endDate > $today) {
            $errors[] = 'La fecha hasta no puede ser mayor al día actual';
        }

        if ($startDate && $endDate && $startDate > $endDate) {
            $errors[] = 'La fecha desde no puede ser mayor a la fecha hasta';
        }

        return $errors;
    }

    // app/Controllers/TransactionController.php - Agregar estos métodos

    /**
     * GET /api/incomes/stats
     * Obtener estadísticas de ingresos para reconversión
     */
    public function getIncomeStats(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $companyId = null;
        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
        } else {
            $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int) $_GET['company_id'] : null;
        }

        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        $stats = $this->incomeModel->getStats($companyId, $startDate, $endDate);

        Response::success($stats);
    }

    /**
     * GET /api/expenses/stats
     * Obtener estadísticas de egresos para reconversión
     */
    public function getExpenseStats(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $companyId = null;
        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
        } else {
            $companyId = isset($_GET['company_id']) && $_GET['company_id'] !== '' ? (int) $_GET['company_id'] : null;
        }

        $startDate = $_GET['start_date'] ?? null;
        $endDate = $_GET['end_date'] ?? null;

        $stats = $this->expenseModel->getStats($companyId, $startDate, $endDate);

        Response::success($stats);
    }

    /**
     * POST /api/incomes/reconvert
     * Ejecutar reconversión masiva de ingresos
     */
    public function reconvertIncomes(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $startDate = $data['start_date'] ?? null;
        $endDate = $data['end_date'] ?? null;
        $targetCurrencyId = $data['target_currency_id'] ?? null;
        $createBackup = $data['create_backup'] ?? false;
        $companyId = null;

        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
        } else {
            $companyId = $data['company_id'] ?? null;
        }

        if (!$startDate || !$endDate || !$targetCurrencyId) {
            Response::validationError(['message' => 'Faltan parámetros requeridos']);
            return;
        }

        try {
            $currencyModel = new \App\Models\Currency();
            $exchangeRateModel = new \App\Models\ExchangeRate();

            // Verificar la moneda destino
            $targetCurrency = $currencyModel->find($targetCurrencyId);
            if (!$targetCurrency) {
                Response::notFound('Moneda destino no encontrada');
                return;
            }

            // Obtener moneda base actual
            $baseCurrency = $currencyModel->getBaseCurrency();
            if (!$baseCurrency) {
                Response::error('No hay moneda base configurada', 400);
                return;
            }

            // Crear respaldo si se solicitó
            if ($createBackup) {
                $this->createBackup('incomes', $startDate, $endDate, $companyId);
            }

            // ✅ Usar el modelo para obtener las transacciones
            $transactions = $this->incomeModel->getForReconversion($companyId, $startDate, $endDate);

            $updatedCount = 0;
            $newTotal = 0;
            $errors = [];

            foreach ($transactions as $transaction) {
                // Obtener tasa histórica para convertir de moneda base a moneda destino
                $rate = $exchangeRateModel->getRate(
                    $baseCurrency['id'],
                    $targetCurrencyId,
                    $transaction['date']
                );

                if ($rate !== null) {
                    // Recalcular amount (monto en la moneda destino)
                    $newAmount = $transaction['amount_base_currency'] / $rate;

                    // ✅ Usar el método del modelo para actualizar
                    $updated = $this->incomeModel->reconvertCurrency(
                        $transaction['id'],
                        $targetCurrencyId,
                        $newAmount,
                        $rate
                    );

                    if ($updated) {
                        $updatedCount++;
                        $newTotal += $newAmount;
                    } else {
                        $errors[] = "Error actualizando ingreso ID: {$transaction['id']}";
                    }
                } else {
                    $errors[] = "No hay tasa para fecha {$transaction['date']} (de {$baseCurrency['code']} a {$targetCurrency['code']})";
                }
            }

            Response::success([
                'affected' => $updatedCount,
                'new_total' => $newTotal,
                'target_currency' => $targetCurrency,
                'base_currency' => $baseCurrency,
                'errors' => $errors
            ], "Reconversión completada: {$updatedCount} ingresos actualizados a {$targetCurrency['code']}");
        } catch (\Exception $e) {
            error_log("Error in reconvertIncomes: " . $e->getMessage());
            Response::error('Error al ejecutar la reconversión: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/expenses/reconvert
     * Ejecutar reconversión masiva de egresos
     */
    public function reconvertExpenses(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $startDate = $data['start_date'] ?? null;
        $endDate = $data['end_date'] ?? null;
        $targetCurrencyId = $data['target_currency_id'] ?? null;
        $createBackup = $data['create_backup'] ?? false;
        $companyId = null;

        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
        } else {
            $companyId = $data['company_id'] ?? null;
        }

        if (!$startDate || !$endDate || !$targetCurrencyId) {
            Response::validationError(['message' => 'Faltan parámetros requeridos: start_date, end_date, target_currency_id']);
            return;
        }

        try {
            $currencyModel = new \App\Models\Currency();
            $targetCurrency = $currencyModel->find($targetCurrencyId);

            if (!$targetCurrency) {
                Response::notFound('Moneda destino no encontrada');
                return;
            }

            if ($createBackup) {
                $this->createBackup('expenses', $startDate, $endDate, $companyId);
            }

            $transactions = $this->expenseModel->getForReconversion($companyId, $startDate, $endDate);

            $updatedCount = 0;
            $newTotal = 0;
            $errors = [];

            foreach ($transactions as $transaction) {
                $rate = $this->exchangeRateModel->getRate(
                    $transaction['currency_id'],
                    $targetCurrencyId,
                    $transaction['date']
                );

                if ($rate !== null) {
                    $newAmount = $transaction['amount_base_currency'] / $rate;

                    if ($this->expenseModel->updateBaseAmount($transaction['id'], $newAmount, $rate)) {
                        $updatedCount++;
                        $newTotal += $newAmount;
                    } else {
                        $errors[] = "Error actualizando egreso ID: {$transaction['id']}";
                    }
                } else {
                    $errors[] = "No hay tasa para egreso ID: {$transaction['id']} en fecha {$transaction['date']}";
                }
            }

            //$currencyModel->setAsBaseCurrency($targetCurrencyId);

            Response::success([
                'affected' => $updatedCount,
                'new_total' => $newTotal,
                'target_currency' => $targetCurrency,
                'errors' => $errors
            ], "Reconversión completada: {$updatedCount} egresos actualizados");
        } catch (\Exception $e) {
            error_log("Error in reconvertExpenses: " . $e->getMessage());
            Response::error('Error al ejecutar la reconversión: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Crear respaldo de datos
     */
    private function createBackup(string $table, string $startDate, string $endDate, ?int $companyId): void
    {
        try {
            $db = \App\Config\Database::getInstance()->getConnection();
            $backupTable = $table . '_backup_' . date('Ymd_His');

            // Crear tabla de respaldo
            $sql = "CREATE TABLE IF NOT EXISTS `{$backupTable}` LIKE `{$table}`";
            $db->exec($sql);

            // Insertar datos
            $sql = "INSERT INTO `{$backupTable}` SELECT * FROM `{$table}` 
                WHERE date BETWEEN :start_date AND :end_date";
            $params = [
                ':start_date' => $startDate,
                ':end_date' => $endDate
            ];

            if ($companyId && $companyId > 0) {
                $sql .= " AND company_id = :company_id";
                $params[':company_id'] = $companyId;
            }

            $stmt = $db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            $stmt->execute();

            error_log("Backup created: {$backupTable}");
        } catch (\Exception $e) {
            error_log("Error creating backup: " . $e->getMessage());
        }
    }
}
