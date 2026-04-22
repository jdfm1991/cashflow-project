<?php
// app/Services/BankParserFactory.php
declare(strict_types=1);

namespace App\Services;

// ✅ Cargar constantes si no están definidas
if (!defined('APP_PATH')) {
    require_once __DIR__ . '/../config/Constants.php';
}

use App\Services\Parsers\ProvincialParser;
use App\Services\Parsers\MercantilParser;
use App\Services\Parsers\BancoDeVenezuelaParser;
use App\Services\Parsers\BanescoParser;
use App\Services\Parsers\GenericParser;

class BankParserFactory
{
    private array $bankConfigs;

    public function __construct()
    {
        error_log("=== BankParserFactory CONSTRUCTOR ===");
        error_log("APP_PATH: " . (defined('APP_PATH') ? APP_PATH : 'NO DEFINIDA'));
        error_log("BASE_PATH: " . (defined('BASE_PATH') ? BASE_PATH : 'NO DEFINIDA'));
        $this->loadConfigurations();
    }

    /**
     * Cargar configuraciones desde archivo JSON
     */
    private function loadConfigurations(): void
    {
        // Probar múltiples rutas
        $paths = [
            APP_PATH . '/config/bank_configs.json',
            BASE_PATH . '/app/config/bank_configs.json',
            __DIR__ . '/../config/bank_configs.json',
            __DIR__ . '/../../app/config/bank_configs.json',
            getcwd() . '/app/config/bank_configs.json'
        ];

        $found = false;

        foreach ($paths as $path) {
            error_log("BankParserFactory: Probando ruta: " . $path);
            if (file_exists($path)) {
                error_log("BankParserFactory: ✅ ARCHIVO ENCONTRADO en: " . $path);
                $content = file_get_contents($path);
                $data = json_decode($content, true);
                $this->bankConfigs = $data['banks'] ?? [];
                error_log("BankParserFactory: Configuraciones cargadas: " . count($this->bankConfigs));
                error_log("BankParserFactory: IDs: " . implode(', ', array_keys($this->bankConfigs)));
                $found = true;
                break;
            } else {
                error_log("BankParserFactory: ❌ No existe: " . $path);
            }
        }

        if (!$found) {
            error_log("BankParserFactory: ⚠️ No se encontró configuración en ninguna ruta");
            $this->bankConfigs = [];
        }
    }

    /**
     * Obtener parser para un banco específico
     */
    public function getParser(int $bankId): ?BaseBankParser
    {
        error_log("=== BankParserFactory::getParser($bankId) ===");
        error_log("Configuraciones disponibles: " . json_encode(array_keys($this->bankConfigs)));

        $config = $this->bankConfigs[$bankId] ?? null;

        if (!$config) {
            error_log("BankParserFactory: ❌ No hay configuración para banco ID: {$bankId}");
            return null;
        }

        // ✅ Bancos que necesitan parser específico
        $specificParsers = [
            3 => \App\Services\Parsers\BancoDeVenezuelaParser::class,  // BDV
            4 => \App\Services\Parsers\BanescoParser::class,  // Banesco
            6 => \App\Services\Parsers\CaroniParser::class,   // Caroni
            7 => \App\Services\Parsers\ExteriorParser::class, // Exterior
        ];

        if (isset($specificParsers[$bankId])) {
            $className = $specificParsers[$bankId];
            error_log("BankParserFactory: Usando parser específico para banco ID: {$bankId} - {$className}");
            return new $className($bankId, $config['name'], $config);
        }

        error_log("BankParserFactory: ✅ Configuración encontrada para banco: {$config['name']}");

        // Verificar que la clase GenericParser existe
        if (!class_exists(GenericParser::class)) {
            error_log("BankParserFactory: ❌ La clase GenericParser no existe");
            return null;
        }

        // Para todos los demás, usar GenericParser
        error_log("BankParserFactory: Usando GenericParser para banco ID: {$bankId}");
        return new GenericParser($bankId, $config['name'], $config);
    }

    /**
     * Obtener todos los bancos soportados
     */
    public function getSupportedBanks(): array
    {
        /* $banks = [];
        foreach ($this->bankConfigs as $id => $config) {
            $banks[] = [
                'id' => $id,
                'name' => $config['name'],
                'code' => $config['code'],
                'sample_files' => $config['patterns']['sample_files'] ?? []
            ];
        }
        return $banks; */
        return $this->bankConfigs;
    }

    /**
     * Obtener nombre de la clase parser
     */
    private function getParserClassName(string $code): string
    {
        $map = [
            'provincial' => 'App\\Services\\Parsers\\ProvincialParser',
            'mercantil' => 'App\\Services\\Parsers\\MercantilParser',
            'bdv' => 'App\\Services\\Parsers\\BancoDeVenezuelaParser',
            'banesco' => 'App\\Services\\Parsers\\BanescoParser'
        ];

        return $map[$code] ?? 'App\\Services\\Parsers\\GenericParser';
    }

    /**
     * Configuraciones por defecto
     */
    private function getDefaultConfigs(): array
    {
        return [
            '1' => [
                'name' => 'Banco Provincial',
                'code' => 'provincial',
                'patterns' => [
                    'header_row_keyword' => 'F. Operación',
                    'start_row_offset' => 2,
                    'columns' => ['date' => 'A', 'reference' => 'D', 'description' => 'E', 'amount' => 'F'],
                    'amount_negative_is_expense' => true,
                    'date_formats' => ['excel_serial', 'dd/mm/yyyy']
                ]
            ],
            '2' => [
                'name' => 'Banco Mercantil',
                'code' => 'mercantil',
                'patterns' => [
                    'header_row_keywords' => ['Fecha', 'Número de Transacción'],
                    'start_row_offset' => 1,
                    'columns' => ['date' => 'A', 'reference' => 'B', 'description' => 'D', 'debit' => 'E', 'credit' => 'F'],
                    'separate_columns' => true,
                    'date_formats' => ['dd/mm/yyyy']
                ]
            ],
            '3' => [
                'name' => 'Banco de Venezuela',
                'code' => 'bdv',
                'patterns' => [
                    'start_row' => 2,
                    'columns' => ['date' => 'A', 'reference' => 'B', 'description' => 'C', 'amount' => 'E', 'movement_type' => 'F'],
                    'credit_keywords' => ['Crédito', 'Abono'],
                    'debit_keywords' => ['Débito', 'Cargo'],
                    'date_formats' => ['dd/mm/yyyy']
                ]
            ],
            '4' => [
                'name' => 'Banco Banesco',
                'code' => 'banesco',
                'patterns' => [
                    'start_row' => 2,
                    'columns' => ['date' => 'A', 'reference' => 'B', 'description' => 'C', 'amount' => 'D', 'movement_type' => 'F'],
                    'credit_keywords' => ['Crédito', 'Abono', 'Pago Recibido'],
                    'debit_keywords' => ['Débito', 'Cargo', 'Pago Realizado'],
                    'date_formats' => ['dd/mm/yyyy']
                ]
            ]
        ];
    }
}
