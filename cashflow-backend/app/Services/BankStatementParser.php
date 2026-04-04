<?php
// app/Services/BankStatementParser.php
declare(strict_types=1);

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date;

class BankStatementParser
{
    private array $parsedData = [];
    private array $errors = [];

    /**
     * Parsear archivo según el banco seleccionado
     */
    public function parse(int $bankId, string $filePath): array
    {
        $this->parsedData = [];
        $this->errors = [];

        try {
            // ✅ Cargar el archivo completo sin limitar filas
            $spreadsheet = IOFactory::load($filePath);
            $sheet = $spreadsheet->getActiveSheet();
            $rows = $sheet->toArray(null, true, true, true);

            switch ($bankId) {
                case 1: // Banco Provincial
                    $this->parseProvincial($rows);
                    break;
                case 2: // Banco Mercantil
                    $this->parseMercantil($rows);
                    break;
                case 3: // Banco de Venezuela
                    $this->parseBancoDeVenezuela($rows);
                    break;
                case 4: // Banco Banesco
                    $this->parseBanesco($rows);
                    break;
                default:
                    $this->errors[] = 'Formato de banco no soportado';
                    break;
            }
        } catch (\Exception $e) {
            $this->errors[] = 'Error al procesar el archivo: ' . $e->getMessage();
        }

        return [
            'success' => empty($this->errors),
            'data' => $this->parsedData,  // ✅ Todos los datos parseados
            'errors' => $this->errors,
            'total_rows' => count($this->parsedData)
        ];
    }

    /**
     * Parsear estado de cuenta - Banco Provincial
     * Formato: F. Operación | F. Valor | Código | Nº. Doc. | Concepto | Importe | Oficina
     */
    private function parseProvincial(array $rows): void
    {
        // Buscar la fila donde comienzan los datos (después de "F. Operación")
        $startRow = 0;
        foreach ($rows as $index => $row) {
            if (isset($row['A']) && strpos($row['A'], 'F. Operación') !== false) {
                $startRow = $index + 2; // Saltar la fila de encabezados
                break;
            }
        }

        for ($i = $startRow; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;

            $row = $rows[$i];
            $date = $row['A'] ?? '';
            $amount = str_replace(['.', ','], ['', '.'], $row['F'] ?? '0');
            $amount = floatval($amount);

            if (empty($date) || $amount == 0) continue;

            $this->parsedData[] = [
                'date' => $this->parseDate($date),
                'reference' => trim($row['D'] ?? ''),
                'description' => trim($row['E'] ?? ''),
                'amount' => abs($amount),
                'transaction_type' => $amount < 0 ? 'expense' : 'income',
                'raw_amount' => $amount
            ];
        }
    }

    /**
     * Parsear estado de cuenta - Banco Mercantil
     * Formato: Fecha | Número de Transacción | Oficina | Descripción | Egresos | Ingresos | Saldo
     */
    private function parseMercantil(array $rows): void
    {
        // Buscar la fila de encabezados
        $startRow = 0;
        foreach ($rows as $index => $row) {
            if (isset($row['A']) && strpos($row['A'], 'Fecha') !== false && strpos($row['B'], 'Número') !== false) {
                $startRow = $index + 1;
                break;
            }
        }

        for ($i = $startRow; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;

            $row = $rows[$i];
            $date = $row['A'] ?? '';
            $egress = str_replace(['.', ','], ['', '.'], $row['E'] ?? '0');
            $ingress = str_replace(['.', ','], ['', '.'], $row['F'] ?? '0');

            if (empty($date)) continue;

            if (!empty($egress) && floatval($egress) > 0) {
                $this->parsedData[] = [
                    'date' => $this->parseDate($date),
                    'reference' => trim($row['B'] ?? ''),
                    'description' => trim($row['D'] ?? ''),
                    'amount' => abs(floatval($egress)),
                    'transaction_type' => 'expense',
                    'raw_amount' => -floatval($egress)
                ];
            }

            if (!empty($ingress) && floatval($ingress) > 0) {
                $this->parsedData[] = [
                    'date' => $this->parseDate($date),
                    'reference' => trim($row['B'] ?? ''),
                    'description' => trim($row['D'] ?? ''),
                    'amount' => abs(floatval($ingress)),
                    'transaction_type' => 'income',
                    'raw_amount' => floatval($ingress)
                ];
            }
        }
    }

    /**
     * Parsear estado de cuenta - Banco de Venezuela
     * Formato: fecha | referencia | concepto | saldo | monto | tipoMovimiento
     */
    private function parseBancoDeVenezuela(array $rows): void
    {
        // Saltar encabezados (primera fila)
        for ($i = 2; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;

            $row = $rows[$i];
            $date = $row['A'] ?? '';
            $amount = str_replace(['.', ','], ['', '.'], $row['E'] ?? '0');
            $amount = floatval($amount);
            $movementType = $row['F'] ?? '';

            if (empty($date)) continue;

            $transactionType = (stripos($movementType, 'Crédito') !== false || $amount > 0) ? 'income' : 'expense';

            $this->parsedData[] = [
                'date' => $this->parseDate($date),
                'reference' => trim($row['B'] ?? ''),
                'description' => trim($row['C'] ?? ''),
                'amount' => abs($amount),
                'transaction_type' => $transactionType,
                'raw_amount' => $amount
            ];
        }
    }

    /**
     * Parsear estado de cuenta - Banco Banesco
     * Formato: Fecha | Referencia | Descripción | Monto | Saldo | Tipo de Movimiento
     */
    private function parseBanesco(array $rows): void
    {
        // Saltar encabezados (primera fila)
        for ($i = 2; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;

            $row = $rows[$i];
            $date = $row['A'] ?? '';
            $amount = str_replace(['.', ','], ['', '.'], $row['D'] ?? '0');
            $amount = floatval($amount);
            $movementType = $row['F'] ?? '';

            if (empty($date)) continue;

            $transactionType = (stripos($movementType, 'Crédito') !== false || $amount > 0) ? 'income' : 'expense';

            $this->parsedData[] = [
                'date' => $this->parseDate($date),
                'reference' => trim($row['B'] ?? ''),
                'description' => trim($row['C'] ?? ''),
                'amount' => abs($amount),
                'transaction_type' => $transactionType,
                'raw_amount' => $amount
            ];
        }
    }

    /**
     * Parsear fecha desde diferentes formatos
     */
    private function parseDate($date): string
    {
        // Si es número de Excel (fecha serial)
        if (is_numeric($date)) {
            $timestamp = Date::excelToTimestamp($date);
            return date('Y-m-d', $timestamp);
        }

        // Formato: "26 de abril de 2023"
        if (preg_match('/(\d+)\s+de\s+([a-z]+)\s+de\s+(\d+)/i', $date, $matches)) {
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
}
