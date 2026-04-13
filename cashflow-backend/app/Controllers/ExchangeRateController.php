<?php
// app/Controllers/ExchangeRateController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\ExchangeRate;
use App\Models\Currency;
use App\Helpers\Response;
use App\Helpers\Validator;

class ExchangeRateController
{
    private ExchangeRate $exchangeRateModel;
    private Currency $currencyModel;

    public function __construct()
    {
        $this->exchangeRateModel = new ExchangeRate();
        $this->currencyModel = new Currency();
    }

    /**
     * GET /api/exchange-rates
     * Listar tasas de cambio
     */
    public function index(): void
    {
        $fromCurrency = $_GET['from'] ?? null;
        $toCurrency = $_GET['to'] ?? null;
        $date = $_GET['date'] ?? null;

        error_log("=== ExchangeRateController ===");
        error_log("From: $fromCurrency, To: $toCurrency, Date: $date");

        // Si se especifican monedas origen y destino, buscar tasa específica
        if ($fromCurrency && $toCurrency) {
            $rateDate = $date ?? date('Y-m-d');
            $rate = $this->exchangeRateModel->getRate((int)$fromCurrency, (int)$toCurrency, $rateDate);
            Response::success([
                'from_currency_id' => (int)$fromCurrency,
                'to_currency_id' => (int)$toCurrency,
                'date' => $rateDate,
                'rate' => $rate !== null ? (float) $rate : null
            ]);
            return;
        }

        // Si se especifica una fecha, mostrar tasas de esa fecha
        if ($date) {
            $rates = $this->exchangeRateModel->getRatesByDate($date);
            foreach ($rates as &$rate) {
                $rate['rate'] = (float) $rate['rate'];
            }
            Response::success($rates);
            return;
        }

        // ✅ Si no hay filtros, mostrar todas las tasas (últimas por cada par de monedas)
        $rates = $this->exchangeRateModel->getAllLatestRates();
        foreach ($rates as &$rate) {
            $rate['rate'] = (float) $rate['rate'];
        }
        Response::success($rates);
    }

    /**
     * POST /api/exchange-rates
     * Crear nueva tasa de cambio
     */
    public function store(): void
    {
        $userId = $this->getUserId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $validator = new Validator($data);
        $validator->required('from_currency_id');
        $validator->numeric('from_currency_id');
        $validator->required('to_currency_id');
        $validator->numeric('to_currency_id');
        $validator->required('rate');
        $validator->numeric('rate');
        $validator->min('rate', 0.00000001);
        $validator->required('effective_date');
        $validator->date('effective_date', 'Y-m-d');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar que las monedas existen
        $fromCurrency = $this->currencyModel->find($data['from_currency_id']);
        $toCurrency = $this->currencyModel->find($data['to_currency_id']);

        if (!$fromCurrency || !$toCurrency) {
            Response::validationError(['currency' => 'Una o ambas monedas no existen']);
            return;
        }

        // Si es la misma moneda, error
        if ($data['from_currency_id'] == $data['to_currency_id']) {
            Response::validationError(['currency' => 'Las monedas deben ser diferentes']);
            return;
        }

        // ✅ Verificar si ya existe una tasa para esta combinación y fecha
        $existing = $this->exchangeRateModel->findByCurrenciesAndDate(
            $data['from_currency_id'],
            $data['to_currency_id'],
            $data['effective_date']
        );

        if ($existing) {
            // Obtener nombres de monedas para el mensaje
            $fromName = $fromCurrency['code'] . ' - ' . $fromCurrency['name'];
            $toName = $toCurrency['code'] . ' - ' . $toCurrency['name'];

            Response::conflict(
                "Ya existe una tasa de cambio para {$fromName} → {$toName} en la fecha {$data['effective_date']}. " .
                    "Puede editar la tasa existente o seleccionar otra fecha.",
                [
                    'existing_rate' => $existing['rate'],
                    'existing_id' => $existing['id']
                ]
            );
            return;
        }

        $rateData = [
            'from_currency_id' => $data['from_currency_id'],
            'to_currency_id' => $data['to_currency_id'],
            'rate' => $data['rate'],
            'effective_date' => $data['effective_date'],
            'source' => $data['source'] ?? 'manual',
            'created_by' => $userId,
            'notes' => $data['notes'] ?? null
        ];

        $rate = $this->exchangeRateModel->create($rateData);

        if ($rate) {
            Response::success($rate, 'Tasa de cambio creada exitosamente', 201);
        } else {
            Response::error('Error al crear la tasa de cambio', 500);
        }
    }

    /**
     * GET /api/exchange-rates/{id}
     * Obtener tasa específica
     */
    public function show(int $id): void
    {
        $rate = $this->exchangeRateModel->find($id);

        if (!$rate) {
            Response::notFound('Tasa de cambio no encontrada');
            return;
        }

        // Obtener nombres de monedas
        $fromCurrency = $this->currencyModel->find($rate['from_currency_id']);
        $toCurrency = $this->currencyModel->find($rate['to_currency_id']);

        $rate['from_currency_code'] = $fromCurrency['code'] ?? null;
        $rate['to_currency_code'] = $toCurrency['code'] ?? null;

        Response::success($rate);
    }

    /**
     * PUT /api/exchange-rates/{id}
     * Actualizar tasa de cambio
     */
    public function update(int $id): void
    {
        $rate = $this->exchangeRateModel->find($id);

        if (!$rate) {
            Response::notFound('Tasa de cambio no encontrada');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $allowedFields = ['rate', 'source', 'notes'];
        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        if (isset($updateData['rate'])) {
            $updateData['rate'] = (float) $updateData['rate'];
        }

        $updated = $this->exchangeRateModel->update($id, $updateData);

        if ($updated) {
            Response::success($updated, 'Tasa de cambio actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la tasa de cambio', 500);
        }
    }

    /**
     * DELETE /api/exchange-rates/{id}
     * Eliminar tasa de cambio
     */
    public function destroy(int $id): void
    {
        $rate = $this->exchangeRateModel->find($id);

        if (!$rate) {
            Response::notFound('Tasa de cambio no encontrada');
            return;
        }

        if ($this->exchangeRateModel->delete($id)) {
            Response::success(null, 'Tasa de cambio eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la tasa de cambio', 500);
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
     * GET /api/exchange-rates/all
     * Obtener todas las tasas de cambio (histórico completo)
     */
    public function getAll(): void
    {
        $rates = $this->exchangeRateModel->getAllRates();

        foreach ($rates as &$rate) {
            $rate['rate'] = (float) $rate['rate'];
        }

        Response::success($rates);
    }
}
