<?php
// app/Controllers/BankAccountController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\BankAccount;
use App\Models\Bank;
use App\Models\Currency;
use App\Helpers\Response;
use App\Helpers\Validator;

class BankAccountController
{
    private BankAccount $bankAccountModel;
    private Bank $bankModel;
    private Currency $currencyModel;

    public function __construct()
    {
        $this->bankAccountModel = new BankAccount();
        $this->bankModel = new Bank();
        $this->currencyModel = new Currency();
    }

    /**
     * GET /api/bank-accounts
     * Listar cuentas bancarias de la empresa
     */
    public function index(): void
    {
        $companyId = $this->getCompanyId();

        $accounts = $this->bankAccountModel->getByCompany($companyId);

        Response::success($accounts);
    }

    /**
     * GET /api/bank-accounts/{id}
     * Obtener cuenta bancaria específica
     */
    public function show(int $id): void
    {
        $companyId = $this->getCompanyId();
        $account = $this->bankAccountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta bancaria no encontrada');
            return;
        }

        if ($account['company_id'] != $companyId) {
            Response::forbidden('No autorizado');
            return;
        }

        Response::success($account);
    }

    /**
     * POST /api/bank-accounts
     * Crear nueva cuenta bancaria para la empresa
     */
    public function store(): void
    {
        $companyId = $this->getCompanyId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->required('bank_id');
        $validator->numeric('bank_id');
        $validator->required('account_number');
        $validator->string('account_number');
        $validator->minLength('account_number', 3);
        $validator->required('currency_id');
        $validator->numeric('currency_id');
        $validator->optional('account_type');
        $validator->in('account_type', ['corriente', 'ahorros', 'nomina', 'inversion']);
        $validator->optional('opening_balance');
        $validator->numeric('opening_balance');
        $validator->min('opening_balance', 0);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar que el banco existe
        $bank = $this->bankModel->find($data['bank_id']);
        if (!$bank) {
            Response::validationError(['bank_id' => 'El banco no existe']);
            return;
        }

        // Verificar que la moneda existe
        $currency = $this->currencyModel->find($data['currency_id']);
        if (!$currency) {
            Response::validationError(['currency_id' => 'La moneda no es válida']);
            return;
        }

        // Verificar que el número de cuenta no esté duplicado en la misma empresa
        $existing = $this->bankAccountModel->findByAccountNumber($data['account_number'], $companyId);
        if ($existing) {
            Response::conflict('El número de cuenta ya está registrado para esta empresa');
            return;
        }

        $accountData = [
            'company_id' => $companyId,
            'bank_id' => $data['bank_id'],
            'account_number' => $data['account_number'],
            'account_type' => $data['account_type'] ?? 'corriente',
            'currency_id' => $data['currency_id'],
            'account_holder' => $data['account_holder'] ?? null,
            'opening_balance' => $data['opening_balance'] ?? 0,
            'current_balance' => $data['opening_balance'] ?? 0,
            'is_active' => true
        ];

        $account = $this->bankAccountModel->create($accountData);

        if ($account) {
            Response::success($account, 'Cuenta bancaria creada exitosamente', 201);
        } else {
            Response::error('Error al crear la cuenta bancaria', 500);
        }
    }

    /**
     * PUT /api/bank-accounts/{id}
     * Actualizar cuenta bancaria
     */
    public function update(int $id): void
    {
        $companyId = $this->getCompanyId();

        $account = $this->bankAccountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta bancaria no encontrada');
            return;
        }

        if ($account['company_id'] != $companyId) {
            Response::forbidden('No autorizado');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $allowedFields = [
            'account_number',
            'account_type',
            'currency_id',
            'account_holder',
            'is_active',
            'opening_balance',
            'current_balance'
        ];

        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        // Si se cambia el número de cuenta, verificar duplicado
        if (isset($updateData['account_number']) && $updateData['account_number'] !== $account['account_number']) {
            $existing = $this->bankAccountModel->findByAccountNumber($updateData['account_number'], $companyId);
            if ($existing && $existing['id'] != $id) {
                Response::conflict('El número de cuenta ya está registrado para esta empresa');
                return;
            }
        }

        // Si se actualiza el opening_balance, ajustar también el current_balance
        if (isset($updateData['opening_balance'])) {
            // Calcular la diferencia
            $difference = $updateData['opening_balance'] - $account['opening_balance'];
            $updateData['current_balance'] = $account['current_balance'] + $difference;
        }

        $updated = $this->bankAccountModel->update($id, $updateData);

        if ($updated) {
            Response::success($updated, 'Cuenta bancaria actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la cuenta bancaria', 500);
        }
    }

    /**
     * DELETE /api/bank-accounts/{id}
     * Eliminar cuenta bancaria
     */
    public function destroy(int $id): void
    {
        $companyId = $this->getCompanyId();

        $account = $this->bankAccountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta bancaria no encontrada');
            return;
        }

        if ($account['company_id'] != $companyId) {
            Response::forbidden('No autorizado');
            return;
        }

        // Usar los métodos de los modelos que extienden de Transaction
        $incomeModel = new \App\Models\Income();
        $expenseModel = new \App\Models\Expense();

        $incomeCount = $incomeModel->countByBankAccountAndCompany($companyId, $id);
        $expenseCount = $expenseModel->countByBankAccountAndCompany($companyId, $id);

        if ($incomeCount > 0 || $expenseCount > 0) {
            Response::error('No se puede eliminar la cuenta bancaria porque tiene transacciones asociadas', 400);
            return;
        }

        if ($this->bankAccountModel->delete($id)) {
            Response::success(null, 'Cuenta bancaria eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la cuenta bancaria', 500);
        }
    }

    /**
     * Obtener company_id del usuario autenticado
     */
    private function getCompanyId(): int
    {
        // Buscar en $_REQUEST
        if (isset($_REQUEST['company_id']) && !empty($_REQUEST['company_id'])) {
            return (int) $_REQUEST['company_id'];
        }

        // Intentar extraer del token JWT
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            try {
                $jwtService = new \App\Services\JWTService();
                $payload = $jwtService->validate($matches[1]);
                if ($payload && isset($payload['company_id'])) {
                    return (int) $payload['company_id'];
                }
            } catch (\Exception $e) {
                // Error al validar token
            }
        }

        // Si no se encuentra, obtener del usuario autenticado
        $userId = $this->getUserId();
        if ($userId > 0) {
            $userModel = new \App\Models\User();
            $user = $userModel->find($userId);
            if ($user && isset($user['company_id'])) {
                return (int) $user['company_id'];
            }
        }

        return 0;
    }

    /**
     * Obtener ID de usuario autenticado
     */
    private function getUserId(): int
    {
        // Buscar en $_REQUEST
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

        // Intentar extraer del token JWT
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
}
