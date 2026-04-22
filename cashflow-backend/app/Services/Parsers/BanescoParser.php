<?php
// app/Services/Parsers/BanescoParser.php

namespace App\Services\Parsers;

use App\Services\BaseBankParser;

class BanescoParser extends BaseBankParser
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
        
        error_log("BanescoParser: Procesando " . count($rows) . " filas");
        
        foreach ($rows as $index => $row) {
            // Obtener la primera celda (todo el contenido está en columna A)
            $content = $row['A'] ?? '';
            
            if (empty($content)) continue;
            
            // Saltar encabezados
            if (strpos($content, 'FechaReferenciaDescripciónMontoSaldoTipo') !== false) {
                error_log("BanescoParser: Saltando encabezado en fila {$index}");
                continue;
            }
            
            // Procesar la línea
            $transaction = $this->parseLine($content);
            
            if ($transaction) {
                $this->parsedData[] = $transaction;
                error_log("BanescoParser: Transacción agregada - Fecha: {$transaction['date']}, Monto: {$transaction['amount']}, Tipo: {$transaction['transaction_type']}");
            }
        }
        
        error_log("BanescoParser: Total transacciones procesadas: " . count($this->parsedData));
        
        return $this->getResult();
    }
    
    /**
     * Parsear una línea del archivo de Banesco
     * Formato esperado: FechaReferenciaDescripciónMontoSaldoTipo
     */
    private function parseLine(string $line): ?array
    {
        // Patrón para detectar fecha en español "d de mes de aaaa"
        $datePattern = '/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i';
        
        if (!preg_match($datePattern, $line, $dateMatches)) {
            return null;
        }
        
        $day = $dateMatches[1];
        $monthName = strtolower($dateMatches[2]);
        $year = $dateMatches[3];
        
        $months = [
            'enero' => 1, 'febrero' => 2, 'marzo' => 3, 'abril' => 4,
            'mayo' => 5, 'junio' => 6, 'julio' => 7, 'agosto' => 8,
            'septiembre' => 9, 'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12
        ];
        
        $month = $months[$monthName] ?? 1;
        $date = sprintf('%04d-%02d-%02d', $year, $month, $day);
        
        // Remover la fecha del inicio de la línea
        $remaining = substr($line, strlen($dateMatches[0]));
        
        // Buscar referencia (número de 10-15 dígitos)
        preg_match('/^(\d{10,15})/', $remaining, $refMatches);
        $reference = $refMatches[1] ?? '';
        
        if ($reference) {
            $remaining = substr($remaining, strlen($reference));
        }
        
        // Buscar el tipo de movimiento al final
        $typePattern = '/(Nota de Débito|Nota de Crédito)$/i';
        $type = '';
        
        if (preg_match($typePattern, $remaining, $typeMatches)) {
            $type = $typeMatches[1];
            $remaining = substr($remaining, 0, -strlen($type));
        }
        
        // Extraer descripción y monto
        // El patrón: descripción + monto (formato: 000.000,00)
        preg_match('/(.*?)(\d{1,3}(?:\.\d{3})*,\d{2})(\d{1,3}(?:\.\d{3})*,\d{2})?$/', $remaining, $amountMatches);
        
        $description = $remaining;
        $amount = 0;
        $balance = 0;
        
        if (isset($amountMatches[2])) {
            // Limpiar descripción (remover el monto del final)
            $description = trim(substr($remaining, 0, strrpos($remaining, $amountMatches[2])));
            $amount = $this->cleanAmount($amountMatches[2]);
            
            if (isset($amountMatches[3])) {
                $balance = $this->cleanAmount($amountMatches[3]);
            }
        }
        
        // Determinar tipo de transacción
        $isExpense = false;
        
        if (stripos($type, 'Débito') !== false) {
            $isExpense = true;
        } elseif (stripos($type, 'Crédito') !== false) {
            $isExpense = false;
        } else {
            // Si no hay tipo, buscar palabras clave en la descripción
            $debitKeywords = ['COMPRA', 'PAGO', 'SERV MTTO', 'CONTRAPRESTACION', 'NOMINA'];
            foreach ($debitKeywords as $keyword) {
                if (stripos($description, $keyword) !== false) {
                    $isExpense = true;
                    break;
                }
            }
        }
        
        return [
            'date' => $date,
            'reference' => $reference,
            'description' => trim($description),
            'amount' => abs($amount),
            'transaction_type' => $isExpense ? 'expense' : 'income',
            'raw_amount' => $isExpense ? -abs($amount) : abs($amount)
        ];
    }
    
    public function validateFormat(string $filePath): bool
    {
        $rows = $this->loadRows($filePath);
        
        if (empty($rows)) {
            return false;
        }
        
        // Buscar una fila que contenga una fecha en español
        $datePattern = '/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i';
        
        foreach ($rows as $row) {
            $content = $row['A'] ?? '';
            if (preg_match($datePattern, $content)) {
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