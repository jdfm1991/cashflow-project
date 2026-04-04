<?php
// app/Controllers/AccountController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Account;
use App\Helpers\Response;
use App\Helpers\Validator;

class AccountController
{
    private Account $accountModel;

    public function __construct()
    {
        $this->accountModel = new Account();
    }

    /**
     * GET /api/accounts
     * Listar todas las cuentas del catálogo global
     */
    public function index(): void
    {
        $type = $_GET['type'] ?? null;

        // Las cuentas son globales, no requieren filtro por empresa
        $accounts = $this->accountModel->getGlobalAccounts($type);

        Response::success($accounts);
    }

    /**
     * GET /api/accounts/{id}
     * Obtener cuenta específica del catálogo global
     */
    public function show(int $id): void
    {
        $account = $this->accountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta no encontrada');
            return;
        }

        Response::success($account);
    }

    /**
     * POST /api/accounts
     * Crear nueva cuenta en el catálogo global (solo admin global)
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        // Solo super_admin puede crear cuentas globales
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear cuentas globales');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->required('name');
        $validator->string('name');
        $validator->minLength('name', 3);
        $validator->maxLength('name', 100);

        $validator->required('type');
        $validator->in('type', ['income', 'expense']);

        $validator->required('category');
        $validator->string('category');

        $validator->optional('description');
        $validator->string('description');
        $validator->maxLength('description', 255);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $data['is_system'] = false;
        $data['is_active'] = true;

        $account = $this->accountModel->create($data);

        if ($account) {
            Response::success($account, 'Cuenta creada exitosamente', 201);
        } else {
            Response::error('Error al crear la cuenta', 500);
        }
    }

    /**
     * PUT /api/accounts/{id}
     * Actualizar cuenta del catálogo global (solo admin global)
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        // Solo super_admin puede actualizar cuentas globales
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para actualizar cuentas globales');
            return;
        }

        $account = $this->accountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta no encontrada');
            return;
        }

        // No permitir modificar cuentas del sistema
        /* if ($account['is_system']) {
            Response::forbidden('No se pueden modificar las cuentas del sistema');
            return;
        } */

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->optional('name');
        $validator->string('name');
        $validator->minLength('name', 3);
        $validator->maxLength('name', 100);

        $validator->optional('type');
        $validator->in('type', ['income', 'expense']);

        $validator->optional('category');
        $validator->string('category');

        $validator->optional('description');
        $validator->string('description');
        $validator->maxLength('description', 255);

        $validator->optional('is_active');
        $validator->boolean('is_active');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // ✅ Asegurar que is_active se convierte correctamente
        if (isset($data['is_active'])) {
            // Convertir a entero (1 o 0)
            $data['is_active'] = $data['is_active'] ? 1 : 0;
        }

        $updated = $this->accountModel->update($id, $data);

        if ($updated) {
            Response::success($updated, 'Cuenta actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la cuenta', 500);
        }
    }

    /**
     * Eliminar cuenta
     * DELETE /api/accounts/{id}
     * Eliminar cuenta del catálogo global (solo super_admin)
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        // Solo super_admin puede eliminar cuentas globales
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para eliminar cuentas globales');
            return;
        }

        $account = $this->accountModel->find($id);

        if (!$account) {
            Response::notFound('Cuenta no encontrada');
            return;
        }

        // No permitir eliminar cuentas del sistema
        if ($account['is_system']) {
            Response::forbidden('No se pueden eliminar las cuentas del sistema');
            return;
        }

        // Verificar si hay transacciones usando esta cuenta
        $incomeModel = new \App\Models\Income();
        $expenseModel = new \App\Models\Expense();

        $incomesCount = $incomeModel->countByAccount($id);
        $expensesCount = $expenseModel->countByAccount($id);

        if ($incomesCount > 0 || $expensesCount > 0) {
            Response::error('No se puede eliminar la cuenta porque tiene transacciones asociadas', 400);
            return;
        }

        if ($this->accountModel->delete($id)) {
            Response::success(null, 'Cuenta eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la cuenta', 500);
        }
    }

    /**
     * Obtener rol del usuario autenticado
     */
    private function getUserRole(int $userId): string
    {
        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['role'] ?? 'user';
    }

    /**
     * Obtener ID de usuario autenticado
     */
    private function getUserId(): int
    {
        if (isset($_REQUEST['user_id']) && !empty($_REQUEST['user_id'])) {
            return (int) $_REQUEST['user_id'];
        }

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
