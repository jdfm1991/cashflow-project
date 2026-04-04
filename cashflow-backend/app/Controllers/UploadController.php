<?php
// app/Controllers/UploadController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Bank;
use App\Models\BankAccount;
use App\Models\ImportedTransaction;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Services\BankStatementParser;
use App\Services\CurrencyService;
use App\Helpers\Response;
use App\Helpers\Validator;

class UploadController
{
    private Bank $bankModel;
    private BankAccount $bankAccountModel;
    private ImportedTransaction $importedModel;
    private Income $incomeModel;
    private Expense $expenseModel;
    private Account $accountModel;
    private BankStatementParser $parser;
    private CurrencyService $currencyService;

    private string $uploadDir;

    public function __construct()
    {
        $this->bankModel = new Bank();
        $this->bankAccountModel = new BankAccount();
        $this->importedModel = new ImportedTransaction();
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
        $this->parser = new BankStatementParser();
        $this->currencyService = new CurrencyService();
        $this->uploadDir = BANK_STATEMENTS_PATH . '/';

        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }
    }

    /**
     * POST /api/uploads/bank-statement
     * Cargar estado de cuenta bancario
     */
    public function uploadBankStatement(): void
    {
        $companyId = $this->getCompanyId();
        $userId = $this->getUserId();

        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No se recibió ningún archivo', 400);
            return;
        }

        $file = $_FILES['file'];
        $bankId = (int) ($_POST['bank_id'] ?? 0);
        $bankAccountId = (int) ($_POST['bank_account_id'] ?? 0);

        if ($bankId <= 0) {
            Response::validationError(['bank_id' => 'Debe seleccionar un banco']);
            return;
        }

        // Validar tipo de archivo
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, ['xlsx', 'xls', 'csv'])) {
            Response::validationError(['file' => 'Formato no soportado. Use XLSX, XLS o CSV']);
            return;
        }

        // Validar tamaño (máximo 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::validationError(['file' => 'El archivo no debe exceder los 5MB']);
            return;
        }

        // Guardar archivo temporal
        $tempFilename = uniqid('statement_') . '_' . $companyId . '.' . $extension;
        $tempPath = $this->uploadDir . $tempFilename;

        if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
            Response::internalError('Error al guardar el archivo');
            return;
        }

        // Parsear archivo según el banco
        $parseResult = $this->parser->parse($bankId, $tempPath);

        // Log para depuración
        error_log("Parse result - Success: " . ($parseResult['success'] ? 'true' : 'false'));
        error_log("Parse result - Total rows: " . $parseResult['total_rows']);
        error_log("Parse result - Errors: " . print_r($parseResult['errors'], true));
        error_log("Parse result - First 3 records: " . print_r(array_slice($parseResult['data'], 0, 3), true));

        if (!$parseResult['success']) {
            unlink($tempPath);
            Response::error('Error al procesar el archivo: ' . implode(', ', $parseResult['errors']), 400);
            return;
        }

        // ✅ Guardar TODAS las transacciones en tabla temporal (no solo 10)
        $sessionId = uniqid('session_');
        $savedCount = 0;

        foreach ($parseResult['data'] as $transaction) {
            $transactionData = [
                'company_id' => $companyId,
                'bank_id' => $bankId,
                'bank_account_id' => $bankAccountId ?: null,
                'transaction_date' => $transaction['date'],
                'reference' => $transaction['reference'],
                'description' => $transaction['description'],
                'amount' => $transaction['amount'],
                'transaction_type' => $transaction['transaction_type'],
                'import_session_id' => $sessionId
            ];

            if ($this->importedModel->create($transactionData)) {
                $savedCount++;
            }
        }

        // Limpiar archivo temporal
        unlink($tempPath);

        // ✅ Obtener TODAS las transacciones guardadas para previsualización
        $allTransactions = $this->importedModel->getBySession($companyId, $sessionId);
        $previewData = [];
        $previewIds = [];

        foreach ($allTransactions as $transaction) {
            $previewData[] = [
                'date' => $transaction['transaction_date'],
                'reference' => $transaction['reference'],
                'description' => $transaction['description'],
                'amount' => (float) $transaction['amount'],
                'transaction_type' => $transaction['transaction_type']
            ];
            $previewIds[] = $transaction['id']; // ✅ Enviar el ID real
        }

        // Formatear para la respuesta (sin limitar)
        /* $previewData = array_map(function ($transaction) {
            return [
                'date' => $transaction['transaction_date'],
                'reference' => $transaction['reference'],
                'description' => $transaction['description'],
                'amount' => (float) $transaction['amount'],
                'transaction_type' => $transaction['transaction_type']
            ];
        }, $allTransactions); */

        // Obtener las cuentas del catálogo para el mapeo
        $incomeAccounts = $this->accountModel->getGlobalAccounts('income');
        $expenseAccounts = $this->accountModel->getGlobalAccounts('expense');

        /* Response::success([
            'session_id' => $sessionId,
            'total_transactions' => $savedCount,
            'preview' => $previewData,  // ✅ Ahora envía TODAS las transacciones
            'income_accounts' => $incomeAccounts,
            'expense_accounts' => $expenseAccounts
        ], 'Archivo procesado correctamente. Por favor mapee las transacciones.'); */

        Response::success([
            'session_id' => $sessionId,
            'total_transactions' => $savedCount,
            'preview' => $previewData,
            'preview_ids' => $previewIds, // ✅ IDs reales
            'income_accounts' => $incomeAccounts,
            'expense_accounts' => $expenseAccounts
        ], 'Archivo procesado correctamente. Por favor mapee las transacciones.');
    }

    /**
     * POST /api/uploads/map-transactions
     * Mapear transacciones a cuentas del sistema
     */
    public function mapTransactions(): void
    {
        $companyId = $this->getCompanyId();
        $data = json_decode(file_get_contents('php://input'), true);

        $validator = new Validator($data);
        $validator->required('session_id');
        $validator->required('mappings');
        $validator->array('mappings');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $sessionId = $data['session_id'];
        $mappings = $data['mappings'];

        // Obtener transacciones de la sesión
        $transactions = $this->importedModel->getBySession($companyId, $sessionId);

        if (empty($transactions)) {
            Response::notFound('No se encontraron transacciones para esta sesión');
            return;
        }

        $imported = 0;
        $failed = 0;
        $duplicated = 0;
        $errors = [];
        $duplicatedList = [];

        foreach ($transactions as $transaction) {
            $transactionId = $transaction['id'];
            $type = $transaction['transaction_type'];

            // Buscar el mapeo para esta transacción
            $accountId = null;
            foreach ($mappings as $mapping) {
                if ($mapping['transaction_id'] == $transactionId) {
                    $accountId = $mapping['account_id'];
                    break;
                }
            }

            if (!$accountId) {
                $failed++;
                $errors[] = "Transacción ID {$transactionId}: No se pudo determinar la cuenta";
                continue;
            }

            // ✅ VERIFICAR SI YA EXISTE LA TRANSACCIÓN
            if ($this->transactionExists($companyId, $transaction)) {
                $duplicated++;
                $duplicatedList[] = [
                    'date' => $transaction['transaction_date'],
                    'amount' => $transaction['amount'],
                    'reference' => $transaction['reference']
                ];
                // Marcar como procesada aunque no se importe para no mostrarla en futuras cargas
                $this->importedModel->markAsProcessed($transactionId, $accountId);
                continue;
            }

            // Verificar que la cuenta existe y es del tipo correcto
            $account = $this->accountModel->find($accountId);
            if (!$account || $account['type'] !== $type) {
                $failed++;
                $errors[] = "Transacción ID {$transactionId}: La cuenta no es válida para el tipo {$type}";
                continue;
            }

            // Obtener moneda base
            $currencyService = new \App\Services\CurrencyService();
            $baseCurrency = $currencyService->getBaseCurrency();

            // Crear ingreso o egreso
            $transactionData = [
                'company_id' => $companyId,
                'user_id' => $this->getUserId(),
                'account_id' => $accountId,
                'bank_account_id' => $transaction['bank_account_id'],
                'amount' => $transaction['amount'],
                'currency_id' => $baseCurrency['id'] ?? 1,
                'exchange_rate' => 1,
                'amount_base_currency' => $transaction['amount'],
                'date' => $transaction['transaction_date'],
                'description' => $transaction['description'],
                'reference' => $transaction['reference'],
                'payment_method' => 'bank'
            ];

            try {
                if ($type === 'income') {
                    $result = $this->incomeModel->create($transactionData);
                } else {
                    $result = $this->expenseModel->create($transactionData);
                }

                if ($result) {
                    $this->importedModel->markAsProcessed($transactionId, $accountId);
                    $imported++;
                } else {
                    $failed++;
                    $errors[] = "Transacción ID {$transactionId}: Error al guardar";
                }
            } catch (\Exception $e) {
                $failed++;
                $errors[] = "Transacción ID {$transactionId}: " . $e->getMessage();
            }
        }

        $message = "Se importaron {$imported} transacciones exitosamente";
        if ($duplicated > 0) {
            $message .= ". {$duplicated} transacciones duplicadas fueron omitidas";
        }

        Response::success([
            'imported' => $imported,
            'failed' => $failed,
            'duplicated' => $duplicated,
            'duplicated_list' => $duplicatedList,
            'errors' => $errors,
            'session_id' => $sessionId
        ], $message);
    }

    /**
     * GET /api/uploads/banks
     * Obtener bancos disponibles para carga
     */
    public function getBanks(): void
    {
        $banks = $this->bankModel->getActiveBanks();
        Response::success($banks);
    }

    /**
     * GET /api/uploads/bank-accounts
     * Obtener cuentas bancarias de la empresa
     */
    public function getBankAccounts(): void
    {
        $companyId = $this->getCompanyId();
        $accounts = $this->bankAccountModel->getByCompany($companyId);
        Response::success($accounts);
    }

    /**
     * Encontrar cuenta que coincida con la descripción de la transacción
     */
    private function findMatchingAccount(array $transaction, array $mappings, string $type): ?int
    {
        // Primero, buscar por mapeo manual
        foreach ($mappings as $mapping) {
            if (isset($mapping['transaction_id']) && $mapping['transaction_id'] == $transaction['id']) {
                return (int) $mapping['account_id'];
            }
        }

        // Segundo, buscar por reglas automáticas (palabras clave)
        $description = strtolower($transaction['description']);
        $accounts = $this->accountModel->getGlobalAccounts($type);

        $keywords = [
            'ventas' => ['venta', 'factura', 'cliente', 'pago cliente', 'transferencia recibida'],
            'alquileres' => ['alquiler', 'renta', 'arriendo'],
            'servicios' => ['servicio', 'consultoría', 'honorarios'],
            'impuestos' => ['impuesto', 'seniat', 'igtf', 'iva'],
            'nomina' => ['nómina', 'salario', 'sueldo', 'empleado'],
            'proveedores' => ['proveedor', 'compra', 'insumo', 'pago proveedor']
        ];

        foreach ($accounts as $account) {
            $accountKeywords = $keywords[$account['category']] ?? [];
            foreach ($accountKeywords as $keyword) {
                if (strpos($description, $keyword) !== false) {
                    return $account['id'];
                }
            }
        }

        return null;
    }

    private function getCompanyId(): int
    {
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

        return $_REQUEST['company_id'] ?? 0;
    }

    private function getUserId(): int
    {
        return $_REQUEST['user_id'] ?? 0;
    }

    /**
     * Verificar si una transacción ya existe en la base de datos
     */
    private function transactionExists(int $companyId, array $transaction): bool
    {
        // Obtener conexión a la base de datos
        $db = \App\Config\Database::getInstance()->getConnection();

        // Buscar en ingresos
        $sql = "SELECT COUNT(*) as total FROM incomes 
            WHERE company_id = :company_id 
            AND date = :date 
            AND amount = :amount";

        $params = [
            'company_id' => $companyId,
            'date' => $transaction['transaction_date'],
            'amount' => $transaction['amount']
        ];

        if (!empty($transaction['reference'])) {
            $sql .= " AND reference = :reference";
            $params['reference'] = $transaction['reference'];
        } else {
            $sql .= " AND description = :description";
            $params['description'] = $transaction['description'];
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();

        if (($result['total'] ?? 0) > 0) {
            return true;
        }

        // Buscar en egresos
        $sql = "SELECT COUNT(*) as total FROM expenses 
            WHERE company_id = :company_id 
            AND date = :date 
            AND amount = :amount";

        $params = [
            'company_id' => $companyId,
            'date' => $transaction['transaction_date'],
            'amount' => $transaction['amount']
        ];

        if (!empty($transaction['reference'])) {
            $sql .= " AND reference = :reference";
            $params['reference'] = $transaction['reference'];
        } else {
            $sql .= " AND description = :description";
            $params['description'] = $transaction['description'];
        }

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();

        return ($result['total'] ?? 0) > 0;
    }
}
