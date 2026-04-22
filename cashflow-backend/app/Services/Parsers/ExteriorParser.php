<?php
// app/Services/Parsers/ExteriorParser.php

namespace App\Services\Parsers;

use App\Services\BaseBankParser;

class ExteriorParser extends BaseBankParser
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
        
        error_log("ExteriorParser: Procesando " . count($rows) . " filas");
        
        foreach ($rows as $index => $row) {
            // Saltar fila de encabezados (fila 2)
            if ($index <= 1) {
                error_log("ExteriorParser: Saltando fila {$index} (encabezados)");
                continue;
            }
            
            $description = trim($row['A'] ?? '');
            $date = trim($row['B'] ?? '');
            $reference = trim($row['C'] ?? '');
            $amountRaw = trim($row['D'] ?? '');
            $sign = trim($row['E'] ?? '');
            $balance = trim($row['F'] ?? '');
            
            // Saltar filas vacías o filas de información de cuenta
            if (empty($description) || empty($date)) {
                error_log("ExteriorParser: Fila {$index} vacía o sin fecha, saltando");
                continue;
            }
            
            // Saltar filas que contienen información de la cuenta
            if (strpos($description, 'HOSPITAL DE CLI') !== false || 
                strpos($description, '0115') !== false ||
                strlen($date) < 5) {
                error_log("ExteriorParser: Fila {$index} es información de cuenta, saltando");
                continue;
            }
            
            // Limpiar monto (formato venezolano: puntos como miles, coma como decimal)
            $amount = $this->cleanAmountVenezuelan($amountRaw);
            
            if ($amount == 0) {
                error_log("ExteriorParser: Fila {$index} monto cero, saltando");
                continue;
            }
            
            // Determinar tipo por signo (+ = ingreso, - = egreso)
            $isExpense = false;
            if ($sign === '-') {
                $isExpense = true;
            } elseif ($sign === '+') {
                $isExpense = false;
            } else {
                // Fallback: si no hay signo, asumir ingreso si monto positivo
                $isExpense = $amount < 0;
            }
            
            // Parsear fecha
            $parsedDate = $this->parseDateExterior($date);
            
            error_log("ExteriorParser: Fila {$index} - Fecha: {$parsedDate}, Desc: {$description}, Monto: {$amount}, Signo: {$sign}, Tipo: " . ($isExpense ? 'EGRESO' : 'INGRESO'));
            
            $this->addTransaction($parsedDate, $reference, $description, abs($amount), $isExpense ? 'expense' : 'income');
        }
        
        error_log("ExteriorParser: Total transacciones: " . count($this->parsedData));
        
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
        
        $amount = trim($amount);
        
        // Si ya es numérico
        if (is_numeric($amount)) {
            return (float) $amount;
        }
        
        // Formato: "285.020,00"
        if (preg_match('/^(\d{1,3}(?:\.\d{3})*),(\d{2})$/', $amount, $matches)) {
            $integerPart = str_replace('.', '', $matches[1]);
            $decimalPart = $matches[2];
            return (float) ($integerPart . '.' . $decimalPart);
        }
        
        // Formato: "285.020" (sin decimales)
        if (preg_match('/^\d{1,3}(?:\.\d{3})+$/', $amount)) {
            return (float) str_replace('.', '', $amount);
        }
        
        // Formato: "285020,00"
        if (preg_match('/^(\d+),(\d{2})$/', $amount, $matches)) {
            return (float) ($matches[1] . '.' . $matches[2]);
        }
        
        // Fallback
        return (float) str_replace(',', '', $amount);
    }
    
    /**
     * Parsear fecha en formato d/m/yy o dd/mm/yy
     */
    private function parseDateExterior(string $date): string
    {
        $date = trim($date);
        
        // Formato: 2/3/26 o 13/04/26
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
        
        // Buscar una fila que tenga el formato esperado (columna E con + o -)
        foreach ($rows as $row) {
            $sign = trim($row['E'] ?? '');
            if ($sign === '+' || $sign === '-') {
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