<?php
// app/Services/Parsers/BancoDeVenezuelaParser.php

namespace App\Services\Parsers;

use App\Services\BaseBankParser;

class BancoDeVenezuelaParser extends BaseBankParser
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
        
        error_log("BancoDeVenezuelaParser: Procesando " . count($rows) . " filas");
        
        $patterns = $this->config['patterns'];
        $startRow = $patterns['start_row'] ?? 2;
        $skipKeywords = $patterns['skip_rows_with_keywords'] ?? ['SALDO INICIAL', 'SALDO ANTERIOR'];
        
        for ($i = $startRow; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;
            
            $row = $rows[$i];
            
            // Saltar filas de resumen
            $firstCell = trim($row['A'] ?? '');
            $shouldSkip = false;
            foreach ($skipKeywords as $keyword) {
                if (stripos($firstCell, $keyword) !== false) {
                    $shouldSkip = true;
                    break;
                }
            }
            if ($shouldSkip) {
                error_log("BancoDeVenezuelaParser: Saltando fila {$i} - {$firstCell}");
                continue;
            }
            
            $date = trim($row['A'] ?? '');
            $reference = trim($row['B'] ?? '');
            $description = trim($row['C'] ?? '');
            $amountRaw = trim($row['E'] ?? '');
            $movementType = trim($row['F'] ?? '');
            
            if (empty($date)) {
                continue;
            }
            
            // Limpiar monto (formato venezolano)
            $amount = $this->cleanAmountVenezuelan($amountRaw);
            
            if ($amount == 0) {
                error_log("BancoDeVenezuelaParser: Fila {$i} monto cero, saltando");
                continue;
            }
            
            // Determinar tipo por columna de tipo de movimiento
            $isExpense = false;
            $debitKeywords = $patterns['debit_keywords'] ?? ['Nota de Débito', 'Débito', 'Cargo', 'Egreso'];
            $creditKeywords = $patterns['credit_keywords'] ?? ['Nota de Crédito', 'Crédito', 'Abono', 'Ingreso'];
            
            foreach ($debitKeywords as $keyword) {
                if (stripos($movementType, $keyword) !== false) {
                    $isExpense = true;
                    break;
                }
            }
            
            // Si no se detectó por palabras clave, verificar signo del monto
            if (!$isExpense && $amount < 0) {
                $isExpense = true;
                $amount = abs($amount);
            }
            
            // Parsear fecha
            $parsedDate = $this->parseDate($date);
            
            error_log("BancoDeVenezuelaParser: Fila {$i} - Fecha: {$parsedDate}, Desc: {$description}, Monto: {$amount}, Tipo: " . ($isExpense ? 'EGRESO' : 'INGRESO'));
            
            $this->addTransaction($parsedDate, $reference, $description, $amount, $isExpense ? 'expense' : 'income');
        }
        
        error_log("BancoDeVenezuelaParser: Total transacciones: " . count($this->parsedData));
        
        return $this->getResult();
    }
    
    /**
     * Limpiar monto con formato venezolano
     */
    private function cleanAmountVenezuelan($amount): float
    {
        if (empty($amount)) {
            return 0.0;
        }
        
        $amount = trim((string) $amount);
        
        // Si ya es numérico
        if (is_numeric($amount)) {
            return (float) $amount;
        }
        
        // Verificar si es negativo
        $isNegative = strpos($amount, '-') === 0;
        if ($isNegative) {
            $amount = substr($amount, 1);
        }
        
        // Formato: "1.234.567,89" (puntos miles, coma decimal)
        if (preg_match('/^\d{1,3}(?:\.\d{3})*,\d{2}$/', $amount)) {
            $cleaned = str_replace('.', '', $amount);
            $cleaned = str_replace(',', '.', $cleaned);
            $result = (float) $cleaned;
            return $isNegative ? -$result : $result;
        }
        
        // Formato: "15,86" (coma decimal)
        if (preg_match('/^\d+,\d{2}$/', $amount)) {
            $cleaned = str_replace(',', '.', $amount);
            $result = (float) $cleaned;
            return $isNegative ? -$result : $result;
        }
        
        // Formato: "1.234" (puntos miles sin decimales)
        if (preg_match('/^\d{1,3}(?:\.\d{3})+$/', $amount)) {
            $cleaned = str_replace('.', '', $amount);
            $result = (float) $cleaned;
            return $isNegative ? -$result : $result;
        }
        
        // Fallback
        $cleaned = str_replace(',', '', $amount);
        $result = (float) $cleaned;
        return $isNegative ? -$result : $result;
    }
    
    public function validateFormat(string $filePath): bool
    {
        $rows = $this->loadRows($filePath);
        
        if (empty($rows)) {
            return false;
        }
        
        // Buscar una fila que tenga el formato esperado
        for ($i = 2; $i <= min(10, count($rows)); $i++) {
            if (!isset($rows[$i])) continue;
            
            $row = $rows[$i];
            $movementType = trim($row['F'] ?? '');
            
            if (stripos($movementType, 'Nota de Crédito') !== false || 
                stripos($movementType, 'Nota de Débito') !== false) {
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
}