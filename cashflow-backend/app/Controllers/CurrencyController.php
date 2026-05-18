<?php
// app/Controllers/CurrencyController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Currency;
use App\Helpers\Response;
use App\Helpers\Validator;

class CurrencyController
{
    private Currency $currencyModel;

    public function __construct()
    {
        $this->currencyModel = new Currency();
    }

    /**
     * GET /api/currencies
     * Listar monedas activas
     */
    public function index(): void
    {
        $currencies = $this->currencyModel->getActiveCurrencies();
        Response::success($currencies);
    }

    /**
     * GET /api/currencies/all
     * Listar todas las monedas (incluyendo inactivas) - solo admin
     */
    public function all(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para ver todas las monedas');
            return;
        }

        $currencies = $this->currencyModel->getAllCurrencies();
        Response::success($currencies);
    }

    /**
     * GET /api/currencies/{id}
     * Obtener moneda específica
     */
    public function show(int $id): void
    {
        $currency = $this->currencyModel->find($id);

        if (!$currency) {
            Response::notFound('Moneda no encontrada');
            return;
        }

        Response::success($currency);
    }

    /**
     * GET /api/currencies/base
     * Obtener moneda base del sistema
     */
    public function getBase(): void
    {
        $baseCurrency = $this->currencyModel->getBaseCurrency();

        if (!$baseCurrency) {
            Response::notFound('No hay moneda base configurada');
            return;
        }

        Response::success($baseCurrency);
    }

    /**
     * POST /api/currencies
     * Crear nueva moneda (solo admin)
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear monedas');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->required('code');
        $validator->string('code');
        $validator->minLength('code', 3);
        $validator->maxLength('code', 3);
        $validator->required('name');
        $validator->string('name');
        $validator->minLength('name', 2);
        $validator->required('symbol');
        $validator->string('symbol');
        $validator->minLength('symbol', 1);
        $validator->optional('decimal_places');
        $validator->integer('decimal_places');
        $validator->min('decimal_places', 0);
        $validator->max('decimal_places', 4);
        $validator->optional('is_base');
        $validator->boolean('is_base');
        $validator->optional('is_default');
        $validator->boolean('is_default'); // ✅ Nuevo campo

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar que el código no exista
        $existing = $this->currencyModel->findByCode($data['code']);
        if ($existing) {
            Response::conflict('El código de moneda ya existe');
            return;
        }

        $isBase = $data['is_base'] ?? false;
        $isDefault = $data['is_default'] ?? false;

        $currencyData = [
            'code' => strtoupper($data['code']),
            'name' => $data['name'],
            'symbol' => $data['symbol'],
            'decimal_places' => $data['decimal_places'] ?? 2,
            'is_base' => $isBase,
            'is_default' => $isDefault, // ✅ Nuevo campo
            'is_active' => true
        ];

        $currency = $this->currencyModel->create($currencyData);

        if ($currency) {
            if ($isBase) {
                $this->currencyModel->setAsBaseCurrency($currency['id']);
            }
            if ($isDefault) {
                $this->currencyModel->setAsDefaultCurrency($currency['id']);
            }
            Response::success($currency, 'Moneda creada exitosamente', 201);
        } else {
            Response::error('Error al crear la moneda', 500);
        }
    }

    /**
     * PUT /api/currencies/{id}
     * Actualizar moneda (solo admin)
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para actualizar monedas');
            return;
        }

        $currency = $this->currencyModel->find($id);

        if (!$currency) {
            Response::notFound('Moneda no encontrada');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $allowedFields = ['name', 'symbol', 'decimal_places', 'is_base', 'is_default', 'is_active'];
        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        // Asegurar tipos correctos
        if (isset($updateData['is_base'])) {
            $updateData['is_base'] = (int) $updateData['is_base'];
        }
        if (isset($updateData['is_default'])) {
            $updateData['is_default'] = (int) $updateData['is_default'];
        }
        if (isset($updateData['decimal_places'])) {
            $updateData['decimal_places'] = (int) $updateData['decimal_places'];
        }
        if (isset($updateData['is_active'])) {
            $updateData['is_active'] = (int) $updateData['is_active'];
        }

        // Si se está estableciendo como base, actualizar otras
        if (isset($updateData['is_base']) && $updateData['is_base'] === 1) {
            $this->currencyModel->setAsBaseCurrency($id);
            $updateData['is_base'] = 1;
        }

        // ✅ Si se está estableciendo como default, actualizar otras
        if (isset($updateData['is_default']) && $updateData['is_default'] === 1) {
            $this->currencyModel->setAsDefaultCurrency($id);
            $updateData['is_default'] = 1;
        }

        $updated = $this->currencyModel->update($id, $updateData);

        if ($updated) {
            Response::success($updated, 'Moneda actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la moneda', 500);
        }
    }

    /**
     * DELETE /api/currencies/{id}
     * Eliminar moneda (solo admin, no puede eliminar la base)
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        error_log("=== DESTROY CURRENCY ===");
        error_log("User ID: $userId, Role: $userRole, Currency ID: $id");

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para eliminar monedas');
            return;
        }

        $currency = $this->currencyModel->find($id);

        if (!$currency) {
            Response::notFound('Moneda no encontrada');
            return;
        }

        // No permitir eliminar la moneda base
        if ($currency['is_base']) {
            Response::forbidden('No se puede eliminar la moneda base del sistema');
            return;
        }

        // ✅ Verificar tasas de cambio usando el método del modelo
        $exchangeRateModel = new \App\Models\ExchangeRate();
        $ratesCount = $exchangeRateModel->countByCurrency($id);

        if ($ratesCount > 0) {
            Response::error(
                "No se puede eliminar la moneda porque está siendo utilizada en {$ratesCount} tasa(s) de cambio. " .
                    "Primero debe eliminar las tasas de cambio asociadas.",
                400
            );
            return;
        }


        // ✅ Usar los métodos de los modelos
        $incomeModel = new \App\Models\Income();
        $expenseModel = new \App\Models\Expense();

        $incomeCount = $incomeModel->countByCurrency($id);
        $expenseCount = $expenseModel->countByCurrency($id);

        if ($incomeCount > 0 || $expenseCount > 0) {
            Response::error('No se puede eliminar la moneda porque tiene transacciones asociadas', 400);
            return;
        }

        if ($this->currencyModel->delete($id)) {
            Response::success(null, 'Moneda eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la moneda', 500);
        }
    }

    /**
     * GET /api/currencies/default
     * Obtener moneda por defecto del sistema
     */
    public function getDefault(): void
    {
        $defaultCurrency = $this->currencyModel->getDefaultCurrency();

        if (!$defaultCurrency) {
            Response::notFound('No hay moneda por defecto configurada');
            return;
        }

        Response::success($defaultCurrency);
    }

    /**
     * Contar transacciones por moneda
     */
    private function countTransactionsByCurrency($model, int $currencyId): int
    {
        $table = $model->getTableName();
        $sql = "SELECT COUNT(*) as total FROM {$table} WHERE currency_id = :currency_id";
        $stmt = $model->db->prepare($sql);
        $stmt->execute(['currency_id' => $currencyId]);
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
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
