<?php
// app/Services/ExternalDatabaseService.php

namespace App\Services;

use PDO;
use Exception;

class ExternalDatabaseService
{
    private ?PDO $connection = null;
    private array $config;

    public function __construct(array $config)
    {
        $this->config = $config;

        error_log("ExternalDatabaseService: Configuración recibida: " . json_encode([
            'host' => $config['host'] ?? 'NO',
            'port' => $config['port'] ?? 'NO',
            'db_name' => $config['db_name'] ?? 'NO',
            'username' => $config['username'] ?? 'NO',
            'table_name' => $config['table_name'] ?? 'NO'
        ]));
    }

    /**
     * Conectar a la base de datos externa
     */
    public function connect(): bool
    {
        try {
            // ✅ Verificar que db_name existe
            if (empty($this->config['db_name'])) {
                error_log("ExternalDatabaseService: ERROR - db_name no está definido");
                error_log("Config recibida: " . json_encode($this->config));
                return false;
            }

            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $this->config['host'],
                $this->config['port'] ?? 3306,
                $this->config['db_name']
            );

            error_log("ExternalDatabaseService: DSN: " . $dsn);
            error_log("ExternalDatabaseService: Usuario: " . $this->config['username']);

            $this->connection = new PDO(
                $dsn,
                $this->config['username'],
                $this->config['password'],
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 30
                ]
            );

            error_log("ExternalDatabaseService: Conexión exitosa");
            return true;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error de conexión - " . $e->getMessage());
            error_log("ExternalDatabaseService: Config: " . json_encode([
                'host' => $this->config['host'],
                'port' => $this->config['port'],
                'db_name' => $this->config['db_name'] ?? 'NO DEFINIDO',
                'username' => $this->config['username']
            ]));
            return false;
        }
    }

    /**
     * Desconectar
     */
    public function disconnect(): void
    {
        $this->connection = null;
    }

    /**
     * Ejecutar consulta personalizada
     */
    public function query(string $sql, array $params = []): array
    {
        if (!$this->connection) {
            throw new Exception('No hay conexión activa');
        }

        error_log("ExternalDatabaseService: Ejecutando query: " . $sql);
        error_log("ExternalDatabaseService: Parámetros: " . json_encode($params));

        $stmt = $this->connection->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll();
    }

    /**
     * Obtener transacciones por año y mes
     * Adaptado a tu estructura de tabla adm_bancos_operaciones
     */
    public function getTransactions(int $year, int $month, int $bankId): array
    {
        try {
            $tableName = $this->getTableName();

            error_log("ExternalDatabaseService: Buscando transacciones en {$tableName} para {$year}-{$month}-{$bankId}");

            // Consulta adaptada a tu estructura
            $sql = "SELECT 
                    numero_documento as reference,
                    fecha_operacion as date,
                    conceptos as description,
                    monto as amount,
                    cod_operacion as transaction_type,
                    numero as operation_number
                FROM {$tableName} 
                WHERE YEAR(fecha_operacion) = :year 
                AND MONTH(fecha_operacion) = :month
                AND cod_banco = :bankId
                AND conciliado = 'Si'
                ORDER BY fecha_operacion ASC";

            $results = $this->query($sql, [
                'year' => $year,
                'month' => $month,
                'bankId' => $bankId
            ]);

            error_log("ExternalDatabaseService: Resultados raw: " . json_encode(array_slice($results, 0, 3)));

            $transactions = [];
            foreach ($results as $row) {
                // Determinar tipo por cod_operacion o por monto
                $amount = (float) ($row['amount'] ?? 0);

                if (isset($row['transaction_type'])) {
                    if ($row['transaction_type'] == 'NC') {
                        $type = 'income';
                    } elseif ($row['transaction_type'] == 'ND') {
                        $type = 'expense';
                    } else {
                        $type = $amount > 0 ? 'income' : 'expense';
                    }
                } else {
                    $type = $amount > 0 ? 'income' : 'expense';
                }

                $transactions[] = [
                    'reference' => $row['reference'] ?? '',
                    'date' => $row['date'] ?? '',
                    'description' => $row['description'] ?? '',
                    'amount' => abs($amount),
                    'transaction_type' => $type,
                    'operation_number' => $row['operation_number'] ?? ''
                ];
            }

            error_log("ExternalDatabaseService: Transacciones procesadas: " . count($transactions));

            return $transactions;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error getTransactions - " . $e->getMessage());
            error_log("ExternalDatabaseService: Trace - " . $e->getTraceAsString());
            return [];
        }
    }

    /**
     * Obtener años disponibles
     */
    public function getAvailableYears(): array
    {
        try {
            $tableName = $this->getTableName();

            error_log("ExternalDatabaseService: Buscando años disponibles en tabla {$tableName}");

            $sql = "SELECT DISTINCT YEAR(fecha_operacion) as year 
                FROM {$tableName} 
                WHERE fecha_operacion IS NOT NULL
                AND conciliado = 'Si'
                ORDER BY year DESC";

            $results = $this->query($sql);

            error_log("ExternalDatabaseService: Resultados query años: " . json_encode($results));

            $years = array_column($results, 'year');
            $years = array_map('intval', $years);
            // Filtrar años válidos (> 2000)
            $years = array_filter($years, function ($year) {
                return $year >= 2000;
            });

            error_log("ExternalDatabaseService: Años disponibles: " . json_encode($years));

            return $years;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error getAvailableYears - " . $e->getMessage());
            return [];
        }
    }

    /**
     * Obtener meses disponibles para un año
     */
    public function getAvailableMonths(int $year): array
    {
        try {
            $tableName = $this->getTableName();

            error_log("ExternalDatabaseService: Buscando meses para {$year} en tabla {$tableName}");

            $sql = "SELECT DISTINCT MONTH(fecha_operacion) as month 
                FROM {$tableName} 
                WHERE YEAR(fecha_operacion) = :year 
                AND fecha_operacion IS NOT NULL
                AND conciliado = 'Si'
                ORDER BY month ASC";

            $results = $this->query($sql, ['year' => $year]);

            error_log("ExternalDatabaseService: Resultados query meses: " . json_encode($results));

            $months = array_column($results, 'month');
            $months = array_map('intval', $months);

            error_log("ExternalDatabaseService: Meses disponibles para {$year}: " . json_encode($months));

            return $months;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error getAvailableMonths - " . $e->getMessage());
            return [];
        }
    }

    /**
     *  Obtener los banco disponibles en el año y mes seleccionados
     */
    public function getAvailableBanks(int $year, int $month): array
    {
        try {
            $tableName = $this->getTableName();

            error_log("ExternalDatabaseService: Buscando bancos para {$year} y {$month} en tabla {$tableName}");

            $sql = "SELECT DISTINCT B.cod_banco as id, B.descripcion as name
                FROM {$tableName} AS A 
                INNER JOIN adm_tabla_bancos AS B ON A.cod_banco = B.cod_banco
                WHERE YEAR(fecha_operacion) = :year 
                AND MONTH(fecha_operacion) = :month 
                AND fecha_operacion IS NOT NULL
                AND conciliado = 'Si'
                ORDER BY A.cod_banco ASC";

            $results = $this->query($sql, ['year' => $year, 'month' => $month]);

            error_log("ExternalDatabaseService: Resultados query bancos: " . json_encode($results));

            $banks = array_column($results, 'banco');

            error_log("ExternalDatabaseService: Bancos disponibles para {$year} y {$month}: " . json_encode($banks));

            // Asegurar que id sea entero
            foreach ($results as &$bank) {
                $bank['id'] = (int) $bank['id'];
            }

            return $results;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error getAvailableBanks - " . $e->getMessage());
            return [];
        }
    }

    /**
     * Obtener estructura de columnas de la tabla
     */
    private function getTableColumns(): array
    {
        try {
            $sql = "DESCRIBE adm_bancos_operaciones";
            $results = $this->query($sql);
            $columns = array_column($results, 'Field');
            return $columns;
        } catch (Exception $e) {
            error_log("ExternalDatabaseService: Error getTableColumns - " . $e->getMessage());
            return [];
        }
    }

    /**
     * Probar conexión
     */
    public function testConnection(): array
    {
        try {
            $this->connect();

            // Verificar que la tabla existe
            $sql = "SHOW TABLES LIKE 'adm_bancos_operaciones'";
            $result = $this->query($sql);

            if (empty($result)) {
                return ['success' => false, 'message' => 'La tabla adm_bancos_operaciones no existe en la base de datos externa'];
            }

            // Verificar que tiene datos
            $sql = "SELECT COUNT(*) as total FROM adm_bancos_operaciones";
            $count = $this->query($sql);
            $total = $count[0]['total'] ?? 0;

            $this->disconnect();

            return [
                'success' => true,
                'message' => "Conexión exitosa. {$total} registros encontrados en adm_bancos_operaciones"
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    /**
     * Encriptar/Desencriptar password
     */
    public static function encryptPassword(string $password): string
    {
        $key = $_ENV['ENCRYPTION_KEY'] ?? 'default_key_32_bytes_long!!!';
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($password, 'aes-256-cbc', $key, 0, $iv);
        return base64_encode($iv . $encrypted);
    }

    public static function decryptPassword(string $encrypted): string
    {
        $key = $_ENV['ENCRYPTION_KEY'] ?? 'default_key_32_bytes_long!!!';
        $data = base64_decode($encrypted);
        $iv = substr($data, 0, openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = substr($data, openssl_cipher_iv_length('aes-256-cbc'));
        return openssl_decrypt($encrypted, 'aes-256-cbc', $key, 0, $iv);
    }

    // app/Services/ExternalDatabaseService.php

    /**
     * Obtener el nombre de la tabla a consultar
     */
    private function getTableName(): string
    {
        // Usar el table_name de la configuración, o el valor por defecto
        return $this->config['table_name'] ?? 'adm_bancos_operaciones';
    }
}
