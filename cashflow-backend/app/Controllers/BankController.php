<?php
// app/Controllers/BankController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Bank;
use App\Helpers\Response;
use App\Helpers\Validator;

class BankController
{
    private Bank $bankModel;

    public function __construct()
    {
        $this->bankModel = new Bank();
    }

    /**
     * GET /api/banks
     * Listar bancos del catálogo global
     */
    public function index(): void
    {
        $banks = $this->bankModel->getActiveBanks();
        Response::success($banks);
    }

    /**
     * GET /api/banks/{id}
     * Obtener banco específico
     */
    public function show(int $id): void
    {
        $bank = $this->bankModel->find($id);

        if (!$bank) {
            Response::notFound('Banco no encontrado');
            return;
        }

        Response::success($bank);
    }

    /**
     * POST /api/banks
     * Crear nuevo banco (solo super_admin)
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear bancos');
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
        $validator->minLength('name', 2);

        $validator->optional('code');
        $validator->string('code');
        $validator->maxLength('code', 20);

        $validator->optional('country');
        $validator->string('country');

        $validator->optional('website');
        $validator->url('website');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $bank = $this->bankModel->create($data);

        if ($bank) {
            Response::success($bank, 'Banco creado exitosamente', 201);
        } else {
            Response::error('Error al crear el banco', 500);
        }
    }

    /**
     * PUT /api/banks/{id}
     * Actualizar banco (solo super_admin)
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para actualizar bancos');
            return;
        }

        $bank = $this->bankModel->find($id);

        if (!$bank) {
            Response::notFound('Banco no encontrado');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $allowedFields = ['name', 'code', 'country', 'website', 'phone', 'logo', 'is_active'];
        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        $updated = $this->bankModel->update($id, $updateData);

        if ($updated) {
            Response::success($updated, 'Banco actualizado exitosamente');
        } else {
            Response::error('Error al actualizar el banco', 500);
        }
    }

    /**
     * DELETE /api/banks/{id}
     * Eliminar banco (solo super_admin)
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para eliminar bancos');
            return;
        }

        $bank = $this->bankModel->find($id);

        if (!$bank) {
            Response::notFound('Banco no encontrado');
            return;
        }

        // Verificar si hay cuentas bancarias usando este banco
        $bankAccountModel = new \App\Models\BankAccount();

        // ✅ Usar el método existente del modelo BankAccount
        $sql = "SELECT COUNT(*) as total FROM bank_accounts WHERE bank_id = :bank_id";
        $stmt = $bankAccountModel->getDb()->prepare($sql);
        $stmt->execute(['bank_id' => $id]);
        $result = $stmt->fetch();

        if (($result['total'] ?? 0) > 0) {
            Response::error('No se puede eliminar el banco porque tiene cuentas bancarias asociadas', 400);
            return;
        }

        if ($this->bankModel->delete($id)) {
            Response::success(null, 'Banco eliminado exitosamente');
        } else {
            Response::error('Error al eliminar el banco', 500);
        }
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
}
