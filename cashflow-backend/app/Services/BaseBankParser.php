<?php
// app/Services/BaseBankParser.php
declare(strict_types=1);

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;

abstract class BaseBankParser
{
    protected array $config;
    protected array $parsedData = [];
    protected array $errors = [];
    protected int $bankId;
    protected string $bankName;

    public function __construct(int $bankId, string $bankName, array $config)
    {
        $this->bankId = $bankId;
        $this->bankName = $bankName;
        $this->config = $config;
    }

    /**
     * Parsear archivo
     */
    abstract public function parse(string $filePath): array;

    /**
     * Validar formato
     */
    abstract public function validateFormat(string $filePath): bool;

    /**
     * Obtener configuración
     */
    public function getConfig(): array
    {
        return $this->config;
    }

    /**
     * Cargar y obtener filas del archivo
     */
    protected function loadRows(string $filePath, ?string $sheetName = null): array
    {
        try {
            $spreadsheet = IOFactory::load($filePath);

            if ($sheetName && $spreadsheet->sheetNameExists($sheetName)) {
                $sheet = $spreadsheet->getSheetByName($sheetName);
            } else {
                $sheet = $spreadsheet->getActiveSheet();
            }

            return $sheet->toArray(null, true, true, true);
        } catch (\Exception $e) {
            $this->errors[] = "Error al cargar el archivo: " . $e->getMessage();
            return [];
        }
    }

    /**
     * Parsear fecha desde diferentes formatos
     */
    protected function parseDate($date, array $formats = []): string
    {
        $formats = $formats ?: $this->config['patterns']['date_formats'] ?? ['excel_serial', 'dd/mm/yyyy', 'dd-mm-yyyy'];

        // Si es número de Excel (fecha serial)
        if (is_numeric($date) && in_array('excel_serial', $formats)) {
            $timestamp = Date::excelToTimestamp($date);
            return date('Y-m-d', $timestamp);
        }

        // Formato: "26 de abril de 2023"
        if (in_array('spanish_text', $formats) && preg_match('/(\d+)\s+de\s+([a-z]+)\s+de\s+(\d+)/i', $date, $matches)) {
            $months = [
                'enero' => 1,
                'febrero' => 2,
                'marzo' => 3,
                'abril' => 4,
                'mayo' => 5,
                'junio' => 6,
                'julio' => 7,
                'agosto' => 8,
                'septiembre' => 9,
                'octubre' => 10,
                'noviembre' => 11,
                'diciembre' => 12
            ];
            $month = $months[strtolower($matches[2])] ?? 1;
            return sprintf('%04d-%02d-%02d', $matches[3], $month, $matches[1]);
        }

        // Formato: "18/08/2023" o "18-08-2023"
        if (preg_match('/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/', $date, $matches)) {
            return sprintf('%04d-%02d-%02d', $matches[3], $matches[2], $matches[1]);
        }

        // Formato: "2023-05-02"
        if (preg_match('/(\d{4})-(\d{2})-(\d{2})/', $date, $matches)) {
            return $date;
        }

        return date('Y-m-d');
    }

    /**
     * Limpiar monto (remover símbolos, convertir formato)
     */
    protected function cleanAmount($amount): float
    {
        if (empty($amount)) {
            return 0.0;
        }

        if (is_numeric($amount)) {
            return (float) $amount;
        }

        $amount = trim((string) $amount);

        // ✅ 1. Formato venezolano: "1.234.567,89" (puntos miles, coma decimal)
        if (preg_match('/^-?\d{1,3}(?:\.\d{3})*,\d{2}$/', $amount)) {
            // Eliminar puntos de miles y reemplazar coma por punto decimal
            $cleaned = str_replace('.', '', $amount);
            $cleaned = str_replace(',', '.', $cleaned);
            error_log("cleanAmount: Formato venezolano detectado - Original: '{$amount}' → Convertido: {$cleaned}");
            return (float) $cleaned;
        }

        // ✅ 2. Formato venezolano con decimales simples: "15,86" (coma decimal)
        if (preg_match('/^-?\d+,\d{2}$/', $amount)) {
            $cleaned = str_replace(',', '.', $amount);
            error_log("cleanAmount: Formato coma decimal detectado - Original: '{$amount}' → Convertido: {$cleaned}");
            return (float) $cleaned;
        }

        // ✅ 3. Número con puntos como separadores de miles (sin decimales): "1.234"
        if (preg_match('/^-?\d{1,3}(?:\.\d{3})+$/', $amount)) {
            $cleaned = str_replace('.', '', $amount);
            error_log("cleanAmount: Formato miles detectado - Original: '{$amount}' → Convertido: {$cleaned}");
            return (float) $cleaned;
        }

        // ✅ 4. Número negativo con coma decimal: "-0,79"
        if (preg_match('/^-(\d+,\d{2})$/', $amount, $matches)) {
            $cleaned = '-' . str_replace(',', '.', $matches[1]);
            error_log("cleanAmount: Formato negativo con coma detectado - Original: '{$amount}' → Convertido: {$cleaned}");
            return (float) $cleaned;
        }

        // ✅ 5. Formato estándar (punto decimal, sin separadores de miles)
        $cleaned = str_replace(',', '', $amount);
        $number = (float) $cleaned;
        error_log("cleanAmount: Formato estándar - Original: '{$amount}' → Convertido: {$number}");
        return $number;
    }

    /**
     * Agregar transacción al resultado
     */
    protected function addTransaction(string $date, string $reference, string $description, float $amount, string $type): void
    {
        if (empty($date) || $amount == 0) {
            return;
        }

        $this->parsedData[] = [
            'date' => $this->parseDate($date),
            'reference' => trim($reference),
            'description' => trim($description),
            'amount' => abs($amount),
            'transaction_type' => $type,
            'raw_amount' => $type === 'income' ? abs($amount) : -abs($amount),
            'bank_id' => $this->bankId,
            'bank_name' => $this->bankName
        ];
    }

    /**
     * Obtener el valor de una celda por columna
     */
    protected function getCellValue(array $row, string $column): string
    {
        return $row[$column] ?? '';
    }

    /**
     * Limpiar montos con formato especial (ej: "1.411 | 4" = 1411.4)
     * 
     * @param string $amount
     * @return float
     */
    protected function cleanAmountSpecial(string $amount): float
    {
        $amount = trim($amount);

        // Buscar patrón: número con puntos como separadores de miles + espacio + pipe + espacio + decimales
        // Ejemplo: "1.411 | 4" → 1411.4
        if (preg_match('/(\d+(?:\.\d{3})*)\s*\|\s*(\d+)/', $amount, $matches)) {
            $integerPart = str_replace('.', '', $matches[1]); // "1411"
            $decimalPart = $matches[2]; // "4"
            $decimalPart = str_pad($decimalPart, 2, '0', STR_PAD_RIGHT);
            return (float) ($integerPart . '.' . $decimalPart);
        }

        // Si no coincide, usar el método normal
        return $this->cleanAmount($amount);
    }
}
