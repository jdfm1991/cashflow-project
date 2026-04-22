<?php

namespace App\Services\Parsers;

use App\Services\BaseBankParser;

class CaroniParser extends BaseBankParser
{
    public function parse(string $filePath): array
    {
        $this->parsedData = [];
        $this->errors = [];

        $rows = $this->loadRows($filePath);

        if (empty($rows)) {
            $this->errors[] = "No se pudieron leer las filas del archivo";
            return $this->getResult();
        }

        error_log("CaroniParser: Procesando " . count($rows) . " filas");

        foreach ($rows as $index => $row) {
            // Saltar fila de encabezados (fila 1)
            if ($index == 1) {
                error_log("CaroniParser: Saltando fila de encabezados");
                continue;
            }

            // Obtener el contenido de las columnas
            $columnA = trim($row['A'] ?? '');
            $columnB = trim($row['B'] ?? '');

            if (empty($columnA)) {
                continue;
            }

            // Dividir columna A por tabulador
            $parts = explode("\t", $columnA);
            $parts = array_map('trim', $parts);

            // Extraer datos básicos
            $description = $parts[0] ?? '';
            $date = $parts[1] ?? '';
            $cheque = $parts[2] ?? '';
            $code = $parts[3] ?? '';

            // ✅ IMPORTANTE: El monto está dividido entre columna A y columna B
            // En columna A viene la parte entera (con puntos como separadores de miles)
            // En columna B viene la parte decimal

            $integerPart = $parts[4] ?? '';      // Parte entera (ej: "1.411")
            $decimalPart = $columnB;              // Parte decimal (ej: "4")

            // Si no hay parte entera en parts[4], buscar en otro lugar
            if (empty($integerPart) && isset($parts[5])) {
                $integerPart = $parts[5];
            }

            // Limpiar la parte entera (remover puntos de miles)
            $integerPartClean = str_replace('.', '', $integerPart);

            // Limpiar la parte decimal (asegurar 2 dígitos)
            $decimalPartClean = preg_replace('/[^0-9]/', '', $decimalPart);
            $decimalPartClean = str_pad($decimalPartClean, 2, '0', STR_PAD_RIGHT);

            // Construir el monto completo
            $fullAmount = (float) ($integerPartClean . '.' . $decimalPartClean);

            // Determinar si es débito o crédito
            $isDebit = false;
            $isCredit = false;

            // Palabras clave para débitos (egresos)
            $debitKeywords = ['CARGO', 'COMISION', 'CUOTA', 'DEBITO', 'COM.', 'DE CLINICAS'];
            foreach ($debitKeywords as $keyword) {
                if (stripos($description, $keyword) !== false) {
                    $isDebit = true;
                    break;
                }
            }

            // Palabras clave para créditos (ingresos)
            $creditKeywords = ['ABONOS', 'CREDITO', 'PAGO RECIBIDO'];
            foreach ($creditKeywords as $keyword) {
                if (stripos($description, $keyword) !== false) {
                    $isCredit = true;
                    break;
                }
            }

            // Si no se detectó por palabras clave, verificar si hay valor en integerPart
            if (!$isDebit && !$isCredit) {
                // Si el integerPart viene de la columna de débito (parts[4]), es débito
                // Si el integerPart viene de otra parte, es crédito
                $isDebit = true; // Por defecto, asumir débito si no hay palabra clave
            }

            // Parsear fecha
            $parsedDate = $this->parseDateCaroni($date);

            error_log("CaroniParser: Fila {$index} - Date: {$parsedDate}, Desc: {$description}, Integer: {$integerPart}, Decimal: {$decimalPartClean}, Full: {$fullAmount}, IsDebit: {$isDebit}, IsCredit: {$isCredit}");

            if ($isDebit && $fullAmount > 0) {
                $this->addTransaction($parsedDate, $cheque, $description, $fullAmount, 'expense');
            } elseif ($isCredit && $fullAmount > 0) {
                $this->addTransaction($parsedDate, $cheque, $description, $fullAmount, 'income');
            }
        }

        error_log("CaroniParser: Total transacciones: " . count($this->parsedData));

        return $this->getResult();
    }

    /**
     * Parsear fecha en formato dd/mm/yy o dd/mm/yyyy
     */
    private function parseDateCaroni(string $date): string
    {
        $date = trim($date);

        // Formato: 31/03/26
        if (preg_match('/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/', $date, $matches)) {
            $day = str_pad($matches[1], 2, '0', STR_PAD_LEFT);
            $month = str_pad($matches[2], 2, '0', STR_PAD_LEFT);
            $year = $matches[3];

            if (strlen($year) == 2) {
                $year = '20' . $year;
            }

            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }

        return date('Y-m-d');
    }

    public function validateFormat(string $filePath): bool
    {
        $rows = $this->loadRows($filePath);

        if (empty($rows)) {
            return false;
        }

        // Buscar una fila que contenga "CARGO" o "ABONOS"
        foreach ($rows as $row) {
            $content = $row['A'] ?? '';
            if (stripos($content, 'CARGO') !== false || stripos($content, 'ABONOS') !== false) {
                return true;
            }
        }

        return false;
    }

    private function getResult(): array
    {
        return [
            'success' => empty($this->errors),
            'data' => $this->parsedData,
            'errors' => $this->errors,
            'total_rows' => count($this->parsedData),
            'bank_id' => $this->bankId,
            'bank_name' => $this->bankName
        ];
    }

    // app/Services/Parsers/CaroniParser.php

    /**
     * Limpiar monto con formato venezolano (puntos como miles)
     */
    private function cleanAmountCaroni($amount): float
    {
        if (empty($amount)) {
            return 0.0;
        }

        $amount = trim($amount);

        // Si ya es numérico
        if (is_numeric($amount)) {
            return (float) $amount;
        }

        // Eliminar espacios en blanco
        $amount = preg_replace('/\s/', '', $amount);

        // Formato: "1.411" o "31.257" - solo puntos (miles)
        if (preg_match('/^\d{1,3}(?:\.\d{3})+$/', $amount)) {
            $number = (float) str_replace('.', '', $amount);
            error_log("CaroniParser cleanAmount: Miles sin decimales - '{$amount}' → {$number}");
            return $number;
        }

        // Formato: "1.411,04" - puntos como miles, coma como decimal
        if (preg_match('/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/', $amount, $matches)) {
            $integerPart = str_replace('.', '', $matches[1]);
            $decimalPart = $matches[2];
            $number = (float) ($integerPart . '.' . $decimalPart);
            error_log("CaroniParser cleanAmount: Miles con decimales - '{$amount}' → {$number}");
            return $number;
        }

        // Formato: "1411,04" - solo coma decimal
        if (preg_match('/^(\d+),(\d{2})$/', $amount, $matches)) {
            $number = (float) ($matches[1] . '.' . $matches[2]);
            error_log("CaroniParser cleanAmount: Coma decimal - '{$amount}' → {$number}");
            return $number;
        }

        // Fallback: limpiar estándar
        $cleaned = str_replace(',', '', $amount);
        $number = (float) $cleaned;
        error_log("CaroniParser cleanAmount: Fallback - '{$amount}' → {$number}");
        return $number;
    }
}
