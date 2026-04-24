<?php


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
     * GET /api/migrations/connections
     * Listar conexiones configuradas
     */
    public function getConnections(): void
    {
        $companyId = $this->getCompanyId();
        $connections = $this->connectionModel->getByCompany($companyId);

        // Ocultar contraseñas
        foreach ($connections as &$conn) {
            unset($conn['password']);
        }

        Response::success($connections);
    }

    /**
     * POST /api/migrations/connections
     * Crear nueva conexión
     */
    public function createConnection(): void
    {
        $companyId = $this->getCompanyId();
        $userId = $this->getUserId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $validator = new Validator($data);
        $validator->required('name');
        $validator->required('host');
        $validator->required('database');  // ← Del frontend viene como 'database'
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
            'db_name' => $data['database'],  // ← Convertir 'database' a 'db_name'
            'username' => $data['username'],
            'password' => $data['password']
        ]);

        $testResult = $extService->testConnection();
        if (!$testResult['success']) {
            Response::validationError(['connection' => $testResult['message']]);
            return;
        }

        $connectionData = [
            'company_id' => $companyId,
            'name' => $data['name'],
            'type' => $data['type'] ?? 'migration',
            'host' => $data['host'],
            'port' => $data['port'] ?? 3306,
            'db_name' => $data['database'],  // ← Convertir aquí
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
     * POST /api/migrations/preview
     * Previsualizar datos a migrar
     */
    public function preview(): void
    {
        $companyId = $this->getCompanyId();
        $userId = $this->getUserId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("=== MIGRATION PREVIEW ===");
        error_log("Raw input: " . $rawInput);
        error_log("Data decoded: " . json_encode($data));

        $validator = new Validator($data ?? []);
        $validator->required('connection_id');
        $validator->required('year');
        $validator->required('month');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Obtener conexión
        $connection = $this->connectionModel->find($data['connection_id']);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        if ($connection['company_id'] != $companyId) {
            Response::forbidden('No tienes permisos para usar esta conexión');
            return;
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

        // Obtener transacciones
        $transactions = $extService->getTransactions($data['year'], $data['month']);
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

        // Obtener cuentas para mapeo
        $incomeAccounts = $this->accountModel->getGlobalAccounts('income');
        $expenseAccounts = $this->accountModel->getGlobalAccounts('expense');

        // Crear sesión temporal en imported_transactions
        $sessionId = uniqid('migration_');

        // ✅ Verificar si existe un banco por defecto, si no, crearlo
        $defaultBankId = $this->getOrCreateDefaultBank($companyId);

        $importedCount = 0;
        foreach ($preview as $transaction) {
            $result = $this->importedModel->create([
                'company_id' => $companyId,
                'bank_id' => $defaultBankId,  // Usar banco por defecto
                'transaction_date' => $transaction['date'],
                'reference' => $transaction['reference'],
                'description' => $transaction['description'],
                'amount' => $transaction['amount'],
                'transaction_type' => $transaction['transaction_type'],
                'import_session_id' => $sessionId
            ]);
            if ($result) $importedCount++;
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
     * Obtener o crear un banco por defecto para migraciones
     */
    private function getOrCreateDefaultBank(int $companyId): int
    {
        $bankModel = new \App\Models\Bank();

        // Buscar banco de migración existente
        $bank = $bankModel->findByName('Migración Externa');

        if (!$bank) {
            // Crear banco por defecto
            $bankData = [
                'name' => 'Migración Externa',
                'code' => 'MIG',
                'country' => 'Venezuela',
                'is_active' => 1
            ];
            $bank = $bankModel->create($bankData);
        }

        return $bank['id'] ?? 0;
    }

    /**
     * POST /api/migrations/execute
     * Ejecutar migración
     */


    // app/Controllers/MigrationController.php - Método execute()

    public function execute(): void
    {
        $companyId = $this->getCompanyId();
        $userId = $this->getUserId();

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("=== MIGRATION EXECUTE ===");
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

        // Obtener transacciones de la sesión
        $transactions = $this->importedModel->getBySession($companyId, $data['session_id']);

        error_log("Transacciones encontradas: " . count($transactions));

        if (empty($transactions)) {
            Response::notFound('No se encontraron transacciones para esta sesión');
            return;
        }

        $logData = [
            'company_id' => (int) $companyId,
            'connection_id' => (int) $data['connection_id'],
            'migration_type' => (string) ($data['type'] ?? 'all'),
            'year' => (int) $data['year'],
            'month' => (int) $data['month'],
            'status' => 'processing',
            'started_at' => date('Y-m-d H:i:s'),
            'created_by' => (int) $userId
        ];

        error_log("Log data: " . json_encode($logData));

        $logId = $this->logModel->createlog($logData);

        // ✅ Verificar que logId sea un número entero
        if (!is_numeric($logId) || $logId <= 0) {
            error_log("ERROR: No se pudo crear el log de migración. Resultado: " . json_encode($logId));
            Response::error('No se pudo crear el registro de migración', 500);
            return;
        }

        error_log("Log de migración creado ID: " . $logId);

        // Configurar cuentas por defecto
        $defaultIncomeAccountId = 3;   // ID de cuenta de ingresos por defecto
        $defaultExpenseAccountId = 8;  // ID de cuenta de egresos por defecto

        // Construir mapa de mappings si existen
        $mappingsMap = [];
        if (!empty($data['mappings']) && is_array($data['mappings'])) {
            foreach ($data['mappings'] as $mapping) {
                $transId = is_array($mapping) ? ($mapping['transaction_id'] ?? null) : null;
                $accId = is_array($mapping) ? ($mapping['account_id'] ?? null) : null;
                if ($transId && $accId) {
                    $mappingsMap[(int)$transId] = (int)$accId;
                }
            }
        }

        error_log("Mappings cargados: " . count($mappingsMap));

        // Obtener moneda base
        $currencyService = new \App\Services\CurrencyService();
        $baseCurrency = $currencyService->getBaseCurrency();
        $baseCurrencyId = $baseCurrency['id'] ?? 9;

        $imported = 0;
        $duplicated = 0;
        $failed = 0;
        $errors = [];

        foreach ($transactions as $transaction) {
            $transactionId = (int) $transaction['id'];
            $type = $transaction['transaction_type'];
            $amount = (float) $transaction['amount'];

            // Buscar cuenta asignada en mappings o usar por defecto
            if (isset($mappingsMap[$transactionId])) {
                $accountId = $mappingsMap[$transactionId];
                error_log("Transacción {$transactionId}: Usando cuenta mapeada ID {$accountId}");
            } else {
                $accountId = ($type === 'income') ? $defaultIncomeAccountId : $defaultExpenseAccountId;
                error_log("Transacción {$transactionId}: Usando cuenta por defecto ID {$accountId}");
            }

            // Verificar duplicado
            if ($this->transactionExists($companyId, $transaction)) {
                $duplicated++;
                $this->importedModel->markAsProcessed($transactionId, $accountId);
                error_log("Transacción {$transactionId}: Duplicada, omitida");
                continue;
            }

            // Preparar datos
            $transactionData = [
                'company_id' => (int) $companyId,
                'user_id' => (int) $userId,
                'account_id' => (int) $accountId,
                'amount' => $amount,
                'currency_id' => (int) $baseCurrencyId,
                'exchange_rate' => 1.0,
                'amount_base_currency' => $amount,
                'date' => $transaction['transaction_date'],
                'description' => (string) ($transaction['description'] ?? ''),
                'reference' => (string) ($transaction['reference'] ?? ''),
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

        // Actualizar log usando el método específico
        $this->logModel->updateLog($logId, [
            'total_records' => count($transactions),
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
     * GET /api/migrations/years
     * Obtener años disponibles en la BD externa
     */
    public function getAvailableYears(): void
    {
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);

        error_log("=== getAvailableYears ===");
        error_log("Company ID: {$companyId}");
        error_log("Connection ID: {$connectionId}");

        $connection = $this->connectionModel->find($connectionId);
        if (!$connection || $connection['company_id'] != $companyId) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        error_log("Conexión encontrada: " . json_encode([
            'id' => $connection['id'],
            'host' => $connection['host'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username']
        ]));

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],  // ← Usar db_name, no database
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            error_log("Error: No se pudo conectar a la base de datos externa");
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        $years = $extService->getAvailableYears();
        $extService->disconnect();

        error_log("Años encontrados: " . json_encode($years));

        Response::success(['years' => $years]);
    }

    /**
     * GET /api/migrations/months
     * Obtener meses disponibles para un año
     */
    public function getAvailableMonths(): void
    {
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);
        $year = (int) ($_GET['year'] ?? 0);

        error_log("=== getAvailableMonths ===");
        error_log("Company ID: " . $companyId);
        error_log("Connection ID: " . $connectionId);
        error_log("Year: " . $year);

        if ($connectionId <= 0) {
            Response::error('connection_id es requerido', 400);
            return;
        }

        if ($year <= 0) {
            Response::error('year es requerido', 400);
            return;
        }

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection) {
            error_log("Conexión no encontrada para ID: " . $connectionId);
            Response::notFound('Conexión no encontrada');
            return;
        }

        if ($connection['company_id'] != $companyId) {
            error_log("La conexión no pertenece a la empresa: {$companyId}");
            Response::forbidden('No tienes permisos para usar esta conexión');
            return;
        }

        error_log("Conexión encontrada: " . json_encode([
            'id' => $connection['id'],
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'username' => $connection['username'],
            'table_name' => $connection['table_name']
        ]));

        // ✅ IMPORTANTE: Asegurar que el array tenga la clave correcta 'db_name'
        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],      // ← Debe ser 'db_name', no 'database'
            'table_name' => $connection['table_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            error_log("Error: No se pudo conectar a la base de datos externa");
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        $months = $extService->getAvailableMonths($year);
        $extService->disconnect();

        error_log("Meses encontrados para {$year}: " . json_encode($months));

        Response::success(['months' => $months]);
    }

    /**
     * GET /api/migrations/logs
     * Obtener historial de migraciones
     */
    public function getLogs(): void
    {
        $companyId = $this->getCompanyId();
        $limit = (int) ($_GET['limit'] ?? 50);

        $logs = $this->logModel->getByCompany($companyId, $limit);
        Response::success($logs);
    }

    private function getCompanyId(): int
    {
        return (int) ($_REQUEST['company_id'] ?? 0);
    }

    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 0);
    }

    private function transactionExists(int $companyId, array $transaction): bool
    {
        $db = \App\Config\Database::getInstance()->getConnection();

        // ✅ Asegurar que los valores sean escalares
        $date = $transaction['transaction_date'] ?? '';
        $amount = (float) ($transaction['amount'] ?? 0);
        $reference = (string) ($transaction['reference'] ?? '');

        error_log("Verificando duplicado: company={$companyId}, date={$date}, amount={$amount}, reference={$reference}");

        // Buscar en ingresos
        $sql = "SELECT COUNT(*) as total FROM incomes 
            WHERE company_id = :company_id 
            AND date = :date 
            AND amount = :amount
            AND reference = :reference";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'date' => $date,
            'amount' => $amount,
            'reference' => $reference
        ]);
        $result = $stmt->fetch();

        if (($result['total'] ?? 0) > 0) {
            error_log("Duplicado encontrado en incomes");
            return true;
        }

        // Buscar en egresos
        $sql = "SELECT COUNT(*) as total FROM expenses 
            WHERE company_id = :company_id 
            AND date = :date 
            AND amount = :amount
            AND reference = :reference";

        $stmt = $db->prepare($sql);
        $stmt->execute([
            'company_id' => $companyId,
            'date' => $date,
            'amount' => $amount,
            'reference' => $reference
        ]);
        $result = $stmt->fetch();

        $exists = ($result['total'] ?? 0) > 0;
        if ($exists) {
            error_log("Duplicado encontrado en expenses");
        }

        return $exists;
    }



    public function testConnection(): void
    {
        $companyId = $this->getCompanyId();
        $connectionId = (int) ($_GET['connection_id'] ?? 0);

        $connection = $this->connectionModel->find($connectionId);

        if (!$connection || $connection['company_id'] != $companyId) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        $extService = new ExternalDatabaseService([
            'host' => $connection['host'],
            'port' => $connection['port'],
            'db_name' => $connection['db_name'],
            'table_name' => $connection['table_name'],
            'username' => $connection['username'],
            'password' => ExternalDatabaseService::decryptPassword($connection['password'])
        ]);

        if (!$extService->connect()) {
            Response::error('No se pudo conectar a la base de datos externa', 500);
            return;
        }

        // Probar consulta
        $testQuery = "SELECT COUNT(*) as total FROM adm_bancos_operaciones";
        $result = $extService->query($testQuery);

        $years = $extService->getAvailableYears();
        $months = !empty($years) ? $extService->getAvailableMonths($years[0]) : [];

        $extService->disconnect();

        Response::success([
            'connection' => [
                'id' => $connection['id'],
                'name' => $connection['name'],
                'host' => $connection['host'],
                'db_name' => $connection['db_name']
            ],
            'test_query' => $result,
            'available_years' => $years,
            'available_months_for_first_year' => $months
        ]);
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
     * DELETE /api/migrations/connections/{id}
     * Eliminar una conexión externa (versión simplificada)
     */
    public function deleteConnection(int $id): void
    {
        error_log("=== DELETE CONNECTION (simplificado) ===");
        error_log("Connection ID: " . $id);

        $companyId = $this->getCompanyId();

        // Obtener la conexión
        $connection = $this->connectionModel->find($id);

        if (!$connection) {
            Response::notFound('Conexión no encontrada');
            return;
        }

        // Verificar permisos
        if ($connection['company_id'] != $companyId) {
            Response::forbidden('No tienes permisos para eliminar esta conexión');
            return;
        }

        // Intentar eliminar directamente
        try {
            $sql = "DELETE FROM external_connections WHERE id = :id AND company_id = :company_id";
            $db = \App\Config\Database::getInstance()->getConnection();
            $stmt = $db->prepare($sql);
            $stmt->execute([
                'id' => $id,
                'company_id' => $companyId
            ]);

            if ($stmt->rowCount() > 0) {
                Response::success(null, 'Conexión eliminada exitosamente');
            } else {
                Response::error('No se pudo eliminar la conexión', 500);
            }
        } catch (\Exception $e) {
            error_log("Error en deleteConnection: " . $e->getMessage());
            Response::error('Error al eliminar la conexión: ' . $e->getMessage(), 500);
        }
    }
}
