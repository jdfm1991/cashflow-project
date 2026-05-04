<?php
// app/Controllers/MigrationController.php

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Validator;
use App\Models\Company;
use App\Models\ExternalConnection;
use App\Models\MigrationLog;
use App\Models\ImportedTransaction;
use App\Models\Account;
use App\Services\ExternalDatabaseService;

class MigrationController
{
    private Company $companyModel;
    private ExternalConnection $connectionModel;
    private MigrationLog $logModel;
    private ImportedTransaction $importedModel;
    private Account $accountModel;

    public function __construct()
    {
        $this->companyModel = new Company();
        $this->connectionModel = new ExternalConnection();
        $this->logModel = new MigrationLog();
        $this->importedModel = new ImportedTransaction();
        $this->accountModel = new Account();
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
     * Obtener company_id del usuario autenticado
     */
    private function getCompanyId(): int
    {
        return (int) ($_REQUEST['company_id'] ?? 0);
    }

    /**
     * Obtener user_id del usuario autenticado
     */
    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 0);
    }

    /**
     * GET /api/migrations/connections
     * Listar conexiones (super_admin: todas, otros: solo las de su empresa)
     */
    public function getConnections(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();

        error_log("=== getConnections ===");
        error_log("User ID: " . $userId);
        error_log("User Role: " . $userRole);
        error_log("Company ID: " . $companyId);

        if ($userRole === 'super_admin') {
            // ✅ Super admin puede ver TODAS las conexiones de TODAS las empresas
            $connections = $this->connectionModel->getAll();
            error_log("Super admin: Mostrando " . count($connections) . " conexiones de todas las empresas");
        } else {
            // ✅ Otros roles solo ven conexiones de su empresa
            if ($companyId <= 0) {
                Response::unauthorized('No se pudo identificar la empresa');
                return;
            }
            $connections = $this->connectionModel->getByCompany($companyId);
            error_log("Usuario normal: Mostrando " . count($connections) . " conexiones de la empresa {$companyId}");
        }

        // Ocultar contraseñas
        foreach ($connections as &$conn) {
            unset($conn['password']);
        }

        Response::success($connections);
    }

    /**
     * POST /api/migrations/connections
     * Crear nueva conexión (solo para la empresa del usuario)
     */
    public function createConnection(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();

        error_log("=== createConnection ===");
        error_log("User ID: " . $userId);
        error_log("User Role: " . $userRole);
        error_log("Company ID: " . $companyId);

        // ✅ Verificar que el usuario tiene una empresa asociada
        if ($companyId <= 0) {
            Response::unauthorized('No se pudo identificar la empresa');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $validator = new Validator($data);
        $validator->required('name');
        $validator->required('host');
        $validator->required('database');
        $validator->required('username');
        $validator->required('password');
        $validator->required('table_name');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Probar conexión antes de guardar
        $extService = new ExternalDatabaseService([
            'host' => $data['host'],
            'port' => $data['port'] ?? 3306,
            'db_name' => $data['database'],
            'username' => $data['username'],
            'password' => $data['password']
        ]);

        $testResult = $extService->testConnection();
        if (!$testResult['success']) {
            Response::validationError(['connection' => $testResult['message']]);
            return;
        }

        // ✅ La conexión se crea asociada a la empresa del usuario
        $connectionData = [
            'company_id' => $companyId,
            'name' => $data['name'],
            'type' => $data['type'] ?? 'migration',
            'host' => $data['host'],
            'port' => $data['port'] ?? 3306,
            'db_name' => $data['database'],
            'username' => $data['username'],
            'password' => ExternalDatabaseService::encryptPassword($data['password']),
            'table_name' => $data['table_name'],
            'field_mapping' => json_encode($data['field_mapping'] ?? []),
            'query_template' => $data['query_template'] ?? null,
            'is_active' => true
        ];

        $connection = $this->connectionModel->create($connectionData);

        if ($connection) {
            unset($connection['password']);
            Response::success($connection, 'Conexión creada exitosamente', 201);
        } else {
            Response::error('Error al crear la conexión', 500);
        }
    }

    /**
     * DELETE /api/migrations/connections/{id}
     * Eliminar conexión (solo si pertenece a la empresa del usuario)
     */
    public function deleteConnection(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();

        error_log("=== deleteConnection ===");
        error_log("Connection ID: " . $id);
        error_log("User Role: " . $userRole);

        $connection = $this->connectionModel->find($id);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole === 'super_admin') {
            // Super admin puede eliminar cualquier conexión
            error_log("Super admin eliminando conexión ID: {$id}");
        } else {
            // Otros roles solo pueden eliminar conexiones de su empresa
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para eliminar esta conexión');
                return;
            }
            error_log("Usuario normal eliminando conexión de su empresa");
        }

        // Verificar si hay logs asociados
        $logs = $this->logModel->getByConnection($id);
        if (!empty($logs)) {
            Response::error('No se puede eliminar la conexión porque tiene migraciones asociadas', 400);
            return;
        }

        if ($this->connectionModel->delete($id)) {
            Response::success(null, 'Conexión eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la conexión', 500);
        }
    }

    /**
     * GET /api/migrations/years
     * Obtener años disponibles (verificar permisos de la conexión)
     */
    public function getAvailableYears(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);

        error_log("=== getAvailableYears ===");
        error_log("Connection ID: " . $connectionId);
        error_log("User Role: " . $userRole);

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para acceder a esta conexión');
                return;
            }
        }

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        $years = $extService->getAvailableYears();
        $extService->disconnect();

        Response::success(['years' => $years]);
    }

    /**
     * GET /api/migrations/months
     * Obtener meses disponibles (verificar permisos de la conexión)
     */
    public function getAvailableMonths(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);
        $year = (int) ($_GET['year'] ?? 0);

        error_log("=== getAvailableMonths ===");
        error_log("Connection ID: " . $connectionId);
        error_log("Year: " . $year);
        error_log("User Role: " . $userRole);

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para acceder a esta conexión');
                return;
            }
        }

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        $months = $extService->getAvailableMonths($year);
        $extService->disconnect();

        Response::success(['months' => $months]);
    }

    /**
     * GET /api/migrations/banks
     * Obtener los bancos disponibles (verificar permisos de la conexión)
     */
    public function getAvailableBanks(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);
        $year = (int) ($_GET['year'] ?? 0);
        $month = (int) ($_GET['month'] ?? 0);

        error_log("=== getAvailableBanks ===");
        error_log("Connection ID: " . $connectionId);
        error_log("Year: " . $year);
        error_log("Month: " . $month);
        error_log("User Role: " . $userRole);

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para acceder a esta conexión');
                return;
            }
        }

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        $banks = $extService->getAvailableBanks($year, $month);
        $extService->disconnect();

        Response::success(['banks' => $banks]);
    }

    /**
     * POST /api/migrations/preview
     * Previsualizar datos (verificar permisos de la conexión)
     */
    public function preview(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("=== MIGRATION PREVIEW ===");
        error_log("User Role: " . $userRole);
        error_log("Datos recibidos: " . json_encode($data));

        $validator = new Validator($data ?? []);
        $validator->required('connection_id');
        $validator->required('year');
        $validator->required('month');
        $validator->required('bank_id');

        if (!$validator->passes()) {
            error_log("Validación fallida: " . json_encode($validator->errors()));
            Response::validationError($validator->errors());
            return;
        }

        $connection = $this->connectionModel->find($data['connection_id']);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para acceder a esta conexión');
                return;
            }
        }

        // Configuración para el servicio externo
        $config = [
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'table_name' => $connection['table_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ];

        $extService = new ExternalDatabaseService($config);

        if (!$extService->connect()) {
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        // Obtener el bank_id
        $bankId = (int) $data['bank_id'];
        error_log("Bank ID: " . $bankId);

        $transactions = $extService->getTransactions($data['year'], $data['month'], $bankId);
        $extService->disconnect();

        if (empty($transactions)) {
            Response::success([
                'session_id' => null,
                'total_transactions' => 0,
                'preview' => [],
                'message' => 'No se encontraron transacciones para el período seleccionado'
            ]);
            return;
        }

        // Formatear para previsualización
        $preview = [];
        foreach ($transactions as $transaction) {
            $preview[] = [
                'reference' => $transaction['reference'],
                'date' => $transaction['date'],
                'description' => $transaction['description'],
                'amount' => abs($transaction['amount']),
                'transaction_type' => $transaction['transaction_type'],
                'operation_number' => $transaction['operation_number'] ?? ''
            ];
        }

        $incomeAccounts = $this->accountModel->getGlobalAccounts('income');
        $expenseAccounts = $this->accountModel->getGlobalAccounts('expense');

        $sessionId = uniqid('migration_');

        foreach ($preview as $transaction) {
            $this->importedModel->create([
                'company_id' => $companyId,
                'bank_id' => 999,
                'transaction_date' => $transaction['date'],
                'reference' => $transaction['reference'],
                'description' => $transaction['description'],
                'amount' => $transaction['amount'],
                'transaction_type' => $transaction['transaction_type'],
                'import_session_id' => $sessionId
            ]);
        }

        Response::success([
            'session_id' => $sessionId,
            'total_transactions' => count($preview),
            'preview' => $preview,
            'connection_info' => [
                'id' => $connection['id'],
                'name' => $connection['name']
            ],
            'income_accounts' => $incomeAccounts,
            'expense_accounts' => $expenseAccounts
        ], 'Datos cargados para migración');
    }

    /**
     * POST /api/migrations/execute
     * Ejecutar migración (verificar permisos)
     */
    public function execute(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("=== MIGRATION EXECUTE ===");
        error_log("User Role: " . $userRole);
        error_log("Raw input: " . $rawInput);

        $validator = new Validator($data ?? []);
        $validator->required('session_id');
        $validator->required('connection_id');
        $validator->required('year');
        $validator->required('month');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // ✅ Verificar que la sesión pertenece a la empresa
        $transactions = $this->importedModel->getBySession($companyId, $data['session_id']);

        if (empty($transactions)) {
            Response::notFound('No se encontraron transacciones para esta sesión');
            return;
        }

        // ✅ Obtener IDs reales en el orden de las transacciones
        $realIds = array_column($transactions, 'id');
        $totalTransactions = count($transactions);

        error_log("=== DIAGNÓSTICO DE MAPPINGS ===");
        error_log("Session ID: " . $data['session_id']);
        error_log("Total transacciones: " . $totalTransactions);
        error_log("IDs reales (primeros 10): " . json_encode(array_slice($realIds, 0, 10)));

        // ✅ Verificar permisos de la conexión
        $connection = $this->connectionModel->find($data['connection_id']);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para usar esta conexión');
                return;
            }
        }

        // Crear log de migración
        $logData = [
            'company_id' => $companyId,
            'connection_id' => $data['connection_id'],
            'migration_type' => $data['type'] ?? 'all',
            'year' => (int) $data['year'],
            'month' => (int) $data['month'],
            'status' => 'processing',
            'started_at' => date('Y-m-d H:i:s'),
            'created_by' => $userId
        ];

        $logId = $this->logModel->createLog($logData);

        if (!$logId) {
            Response::error('No se pudo crear el registro de migración', 500);
            return;
        }

        // Configurar cuentas por defecto
        $defaultIncomeAccountId = 3;   // Cambia por el ID real de tu cuenta de ingresos por defecto
        $defaultExpenseAccountId = 8;  // Cambia por el ID real de tu cuenta de egresos por defecto

        // ✅ OPCIÓN 4: Construir mapa de mappings usando el ÍNDICE del array
        $mappingsMap = [];
        $mappingsReceived = $data['mappings'] ?? [];

        error_log("Mappings recibidos del frontend: " . count($mappingsReceived));

        foreach ($mappingsReceived as $index => $mapping) {
            // Obtener account_id de diferentes estructuras posibles
            $accountId = null;
            if (is_array($mapping)) {
                $accountId = $mapping['account_id'] ?? null;
            } elseif (is_object($mapping)) {
                $accountId = $mapping->account_id ?? null;
            } elseif (is_numeric($mapping)) {
                $accountId = $mapping;
            }

            // Si hay un account_id válido y existe un ID real en esa posición
            if ($accountId && isset($realIds[$index])) {
                $mappingsMap[$realIds[$index]] = (int) $accountId;
                error_log("Mapeo #{$index}: índice {$index} → ID real {$realIds[$index]} → Cuenta {$accountId}");
            } else {
                error_log("Mapeo #{$index}: No se pudo mapear - accountId: {$accountId}, realId: " . ($realIds[$index] ?? 'null'));
            }
        }

        // ✅ También soportar mappings por ID directo (por si el frontend envía IDs reales)
        foreach ($mappingsReceived as $mapping) {
            if (is_array($mapping)) {
                $transId = $mapping['transaction_id'] ?? null;
                $accId = $mapping['account_id'] ?? null;
                if ($transId && $accId && !isset($mappingsMap[$transId])) {
                    $mappingsMap[(int)$transId] = (int)$accId;
                    error_log("Mapeo directo por ID: {$transId} → Cuenta {$accId}");
                }
            }
        }

        error_log("Mapa de mappings final: " . json_encode($mappingsMap));
        error_log("IDs con mapeo: " . count($mappingsMap) . " de {$totalTransactions}");

        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();
        $baseCurrencyId = $baseCurrency['id'] ?? 9;

        $imported = 0;
        $duplicated = 0;
        $failed = 0;
        $errors = [];

        foreach ($transactions as $index => $transaction) {
            $transactionId = (int) $transaction['id'];
            $type = $transaction['transaction_type'];
            $amount = (float) $transaction['amount'];

            // ✅ Buscar cuenta en el mapa de mappings
            if (isset($mappingsMap[$transactionId])) {
                $accountId = $mappingsMap[$transactionId];
                error_log("Transacción {$transactionId} (índice {$index}): Usando cuenta mapeada ID {$accountId}");
            } else {
                // Usar cuenta por defecto según el tipo
                $accountId = ($type === 'income') ? $defaultIncomeAccountId : $defaultExpenseAccountId;
                error_log("Transacción {$transactionId} (índice {$index}): Usando cuenta por defecto ID {$accountId} (tipo: {$type})");
            }

            // Verificar duplicado
            if ($this->transactionExists($companyId, $transaction)) {
                $duplicated++;
                $this->importedModel->markAsProcessed($transactionId, $accountId);
                error_log("Transacción {$transactionId}: Duplicada, omitida");
                continue;
            }

            $transactionData = [
                'company_id' => $companyId,
                'user_id' => $userId,
                'account_id' => $accountId,
                'amount' => $amount,
                'currency_id' => $baseCurrencyId,
                'exchange_rate' => 1.0,
                'amount_base_currency' => $amount,
                'date' => $transaction['transaction_date'],
                'description' => $transaction['description'] ?? '',
                'reference' => $transaction['reference'] ?? '',
                'payment_method' => 'bank'
            ];

            try {
                if ($type === 'income') {
                    $incomeModel = new \App\Models\Income();
                    $result = $incomeModel->create($transactionData);
                } else {
                    $expenseModel = new \App\Models\Expense();
                    $result = $expenseModel->create($transactionData);
                }

                if ($result) {
                    $this->importedModel->markAsProcessed($transactionId, $accountId);
                    $imported++;
                    error_log("Transacción {$transactionId}: ✅ Importada exitosamente");
                } else {
                    $failed++;
                    $errors[] = "Transacción ID {$transactionId}: Error al guardar";
                    error_log("Transacción {$transactionId}: ❌ Error al guardar");
                }
            } catch (\Exception $e) {
                $failed++;
                $errors[] = "Transacción ID {$transactionId}: " . $e->getMessage();
                error_log("Transacción {$transactionId}: ❌ Excepción - " . $e->getMessage());
            }
        }

        // Actualizar log
        $this->logModel->updateLog($logId, [
            'total_records' => $totalTransactions,
            'imported_records' => $imported,
            'duplicated_records' => $duplicated,
            'failed_records' => $failed,
            'error_log' => implode("\n", $errors),
            'status' => 'completed',
            'completed_at' => date('Y-m-d H:i:s')
        ]);

        $message = "Migración completada: {$imported} importadas, {$duplicated} duplicadas, {$failed} fallidas";

        error_log("=== MIGRATION EXECUTE COMPLETED ===");
        error_log($message);

        Response::success([
            'imported' => $imported,
            'duplicated' => $duplicated,
            'failed' => $failed,
            'errors' => $errors,
            'log_id' => $logId
        ], $message);
    }

    /**
     * GET /api/migrations/logs
     * Obtener historial de migraciones (super_admin: todos, otros: solo de su empresa)
     */
    public function getLogs(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();
        $limit = (int) ($_GET['limit'] ?? 50);

        error_log("=== getLogs ===");
        error_log("User Role: " . $userRole);
        error_log("Company ID: " . $companyId);

        if ($userRole === 'super_admin') {
            // ✅ Super admin puede ver TODOS los logs de TODAS las empresas
            $logs = $this->logModel->getAll($limit);
            error_log("Super admin: Mostrando " . count($logs) . " logs de todas las empresas");
        } else {
            // ✅ Otros roles solo ven logs de su empresa
            if ($companyId <= 0) {
                Response::unauthorized('No se pudo identificar la empresa');
                return;
            }
            $logs = $this->logModel->getByCompany($companyId, $limit);
            error_log("Usuario normal: Mostrando " . count($logs) . " logs de la empresa {$companyId}");
        }

        Response::success($logs);
    }

    /**
     * GET /api/migrations/test-connection
     * Probar conexión (verificar permisos)
     */
    public function testConnection(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);

        error_log("=== testConnection ===");
        error_log("Connection ID: " . $connectionId);
        error_log("User Role: " . $userRole);

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // ✅ Verificar permisos
        if ($userRole !== 'super_admin') {
            if ($connection['company_id'] != $companyId) {
                Response::forbidden('No tienes permisos para acceder a esta conexión');
                return;
            }
        }

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        $result = $extService->testConnection();

        Response::success([
            'connection_id' => $connectionId,
            'connection_name' => $connection['name'],
            'success' => $result['success'],
            'message' => $result['message']
        ]);
    }

    private function transactionExists(int $companyId, array $transaction): bool
    {
        $db = \App\Config\Database::getInstance()->getConnection();

        $sql = "SELECT COUNT(*) as total FROM incomes 
                WHERE company_id = :company_id 
                AND date = :date 
                AND amount = :amount
                AND reference = :reference";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'date' => $transaction['transaction_date'],
            'amount' => $transaction['amount'],
            'reference' => $transaction['reference']
        ]);
        $result = $stmt->fetch();

        if (($result['total'] ?? 0) > 0) {
            return true;
        }

        $sql = "SELECT COUNT(*) as total FROM expenses 
                WHERE company_id = :company_id 
                AND date = :date 
                AND amount = :amount
                AND reference = :reference";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'date' => $transaction['transaction_date'],
            'amount' => $transaction['amount'],
            'reference' => $transaction['reference']
        ]);
        $result = $stmt->fetch();

        return ($result['total'] ?? 0) > 0;
    }
}
