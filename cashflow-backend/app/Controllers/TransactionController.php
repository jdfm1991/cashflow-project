<?php
// app/Controllers/TransactionController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Helpers\Response;
use App\Helpers\Validator;

class TransactionController
{
    private Income $incomeModel;
    private Expense $expenseModel;
    private Account $accountModel;

    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
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

        // ========== NUEVO: MANEJO DE MONEDA Y CONVERSIÓN ==========

        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();

        // Obtener moneda seleccionada (por defecto la moneda base)
        $currencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : ($baseCurrency['id'] ?? 9);
        $amount = (float) $data['amount'];
        $exchangeRate = 1;
        $amountBaseCurrency = $amount;

        // Verificar que la moneda existe
        $currencyModel = new \App\Models\Currency();
        $currency = $currencyModel->find($currencyId);
        if (!$currency) {
            Response::validationError(['currency_id' => 'Moneda no válida']);
            return;
        }

        // Si la moneda seleccionada NO es la moneda base, buscar tasa de cambio
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
        }

        // ========== FIN DE LA NUEVA LÓGICA ==========

        $incomeData = [
            'company_id' => $companyId,
            'user_id' => $userId,
            'account_id' => (int) $data['account_id'],
            'amount' => $amount,
            'currency_id' => $currencyId,
            'exchange_rate' => $exchangeRate,
            'amount_base_currency' => $amountBaseCurrency,
            'date' => $data['date'],
            'description' => $data['description'] ?? null,
            'reference' => $data['reference'] ?? null,
            'payment_method' => $data['payment_method']
        ];

        $income = $this->incomeModel->create($incomeData);

        if ($income) {
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
        // Super_admin puede editar cualquier ingreso
        if ($userRole !== 'super_admin') {
            if ($income['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para editar este ingreso');
                return;
            }
        }
        // ========== FIN VALIDACIÓN ==========

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

        // Si se cambia la cuenta, verificar que existe y es del tipo correcto
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

        // Manejar monto, moneda y fecha con recalculo de conversión
        $needConversion = false;
        $newAmount = isset($data['amount']) ? (float) $data['amount'] : $income['amount'];
        $newCurrencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : $income['currency_id'];
        $newDate = isset($data['date']) ? $data['date'] : $income['date'];

        if (isset($data['amount']) || isset($data['currency_id']) || isset($data['date'])) {
            $needConversion = true;
            $updateData['amount'] = $newAmount;
            $updateData['currency_id'] = $newCurrencyId;
            $updateData['date'] = $newDate;
        }

        if ($needConversion) {
            $currencyService = new \App\Services\CurrencyService();
            $baseCurrency = $currencyService->getBaseCurrency();

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

        $updated = $this->incomeModel->update($id, $updateData);

        if ($updated) {
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

        if ($this->incomeModel->delete($id)) {
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

        // Validaciones básicas
        $validator = new Validator($data);
        $validator->required('account_id');
        $validator->numeric('account_id');
        $validator->required('amount');
        $validator->numeric('amount');
        $validator->min('amount', 0.01);
        $validator->required('date');
        $validator->date('date', 'Y-m-d');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // ✅ CORREGIDO: Determinar company_id según el rol
        $companyId = null;

        if ($userRole === 'super_admin') {
            // Si es super_admin y se envió company_id en el request, usar ese
            if (isset($data['company_id']) && $data['company_id'] > 0) {
                $companyId = (int) $data['company_id'];
                error_log("Super admin creando egreso para empresa: {$companyId}");
            } else {
                // Si no se envió, usar la empresa del usuario
                $companyId = $this->getCompanyId($userId);
                error_log("Super admin sin company_id específico, usando su empresa: {$companyId}");
            }
        } else {
            // Usuario normal: usar su empresa
            $companyId = $this->getCompanyId($userId);
            error_log("Usuario normal creando egreso para su empresa: {$companyId}");
        }

        if ($userId <= 0 || $companyId <= 0) {
            Response::unauthorized('Usuario no autenticado o sin empresa asociada');
            return;
        }

        // Validar fecha futura
        if (!$this->validateDateNotFuture($data['date'])) {
            Response::validationError(['date' => 'No se puede registrar una transacción con fecha futura']);
            return;
        }

        // Verificar cuenta
        $account = $this->accountModel->find((int) $data['account_id']);
        if (!$account || $account['type'] !== 'expense') {
            Response::validationError(['account_id' => 'Cuenta no válida para egreso']);
            return;
        }

        // Manejo de moneda y conversión
        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();
        $currencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : ($baseCurrency['id'] ?? 9);
        $amount = (float) $data['amount'];
        $exchangeRate = 1;
        $amountBaseCurrency = $amount;

        $currencyModel = new \App\Models\Currency();
        $currency = $currencyModel->find($currencyId);
        if (!$currency) {
            Response::validationError(['currency_id' => 'Moneda no válida']);
            return;
        }

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
        }

        // Obtener payment_method
        $paymentMethod = $data['payment_method'] ?? 'cash';
        if (!in_array($paymentMethod, ['cash', 'bank'])) {
            $paymentMethod = 'cash';
        }

        // Crear egreso
        $expenseData = [
            'company_id' => $companyId,  // ← Usar el company_id determinado
            'user_id' => $userId,
            'account_id' => (int) $data['account_id'],
            'amount' => $amount,
            'currency_id' => $currencyId,
            'exchange_rate' => $exchangeRate,
            'amount_base_currency' => $amountBaseCurrency,
            'date' => $data['date'],
            'description' => $data['description'] ?? null,
            'reference' => $data['reference'] ?? null,
            'payment_method' => $paymentMethod
        ];

        error_log("Datos de egreso a guardar: " . json_encode($expenseData));

        $expense = $this->expenseModel->create($expenseData);

        if ($expense) {
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
        $userRole = $this->getUserRole($userId);  // ← Obtener rol

        if ($userId <= 0) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $expense = $this->expenseModel->find($id);

        if (!$expense) {
            Response::notFound('Egreso no encontrado');
            return;
        }

        // ========== VALIDACIÓN DE PERMISOS ==========
        // Super_admin puede editar cualquier egreso
        // Otros roles solo pueden editar egresos de su empresa
        if ($userRole !== 'super_admin') {
            $companyId = $this->getCompanyId($userId);
            if ($expense['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para editar este egreso');
                return;
            }
        }
        // ========== FIN VALIDACIÓN ==========

        // ========== VALIDAR SEGÚN TIPO DE PAGO ==========
        $isBankExpense = isset($expense['payment_method']) && $expense['payment_method'] === 'bank';

        if ($isBankExpense) {
            // Egreso bancario: SOLO puede editar 'description'
            $allowedFields = ['description'];
            $updateData = [];

            if (isset($data['description'])) {
                $updateData['description'] = $data['description'];
            }

            // Validar que solo se esté intentando editar descripción
            $forbiddenFields = array_diff(array_keys($data), $allowedFields);
            if (!empty($forbiddenFields)) {
                Response::forbidden(
                    'Los egresos bancarios solo permiten editar la descripción. ' .
                        'Campos no permitidos: ' . implode(', ', $forbiddenFields)
                );
                return;
            }

            if (empty($updateData)) {
                Response::error('No hay campos válidos para actualizar', 400);
                return;
            }

            // Validar descripción
            $validator = new Validator($updateData);
            $validator->optional('description');
            $validator->string('description');
            $validator->maxLength('description', 500);

            if (!$validator->passes()) {
                Response::validationError($validator->errors());
                return;
            }

            $updated = $this->expenseModel->update($id, $updateData);

            if ($updated) {
                Response::success($updated, 'Descripción del egreso bancario actualizada exitosamente');
            } else {
                Response::error('Error al actualizar la descripción', 500);
            }
            return;
        }

        // ========== Egreso en efectivo: permite editar todos los campos ==========

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

        // Si se cambia la cuenta, verificar que existe y es del tipo correcto
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

        // Manejar monto, moneda y fecha con recalculo de conversión
        $needConversion = false;
        $newAmount = isset($data['amount']) ? (float) $data['amount'] : $expense['amount'];
        $newCurrencyId = isset($data['currency_id']) ? (int) $data['currency_id'] : $expense['currency_id'];
        $newDate = isset($data['date']) ? $data['date'] : $expense['date'];

        if (isset($data['amount']) || isset($data['currency_id']) || isset($data['date'])) {
            $needConversion = true;
            $updateData['amount'] = $newAmount;
            $updateData['currency_id'] = $newCurrencyId;
            $updateData['date'] = $newDate;
        }

        if ($needConversion) {
            $currencyService = new \App\Services\CurrencyService();
            $baseCurrency = $currencyService->getBaseCurrency();

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

        if ($this->expenseModel->delete($id)) {
            Response::success(null, 'Egreso eliminado exitosamente');
        } else {
            Response::error('Error al eliminar el egreso', 500);
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
}
