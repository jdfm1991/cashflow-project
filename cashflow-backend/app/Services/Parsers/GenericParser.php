<?php
// app/Services/Parsers/GenericParser.php
declare(strict_types=1);

namespace App\Services\Parsers;

use App\Services\BaseBankParser;

class GenericParser extends BaseBankParser
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

        error_log("=== GenericParser::parse - Banco: {$this->bankName} ===");
        error_log("Total filas cargadas: " . count($rows));
        error_log("Primeras 5 filas: " . json_encode(array_slice($rows, 1, 5)));

        $patterns = $this->config['patterns'];

        // Buscar fila de inicio
        $startRow = $this->findStartRow($rows, $patterns);

        if ($startRow === null) {
            $this->errors[] = "No se pudo encontrar el inicio de los datos en el archivo";
            return $this->getResult();
        }

        // Palabras clave para saltar filas
        $skipKeywords = $patterns['skip_rows_with_keywords'] ?? ['SALDO ANTERIOR', 'SALDO ACTUAL', 'TOTAL'];

        $columns = $patterns['columns'];
        $hasSeparateColumns = $patterns['separate_columns'] ?? false;

        // ✅ Propiedades para manejar valores negativos
        $debitNegative = $patterns['debit_negative'] ?? false;
        $creditPositive = $patterns['credit_positive'] ?? true;

        for ($i = $startRow; $i <= count($rows); $i++) {
            if (!isset($rows[$i])) continue;

            $row = $rows[$i];

            // Verificar si esta fila debe ser saltada
            $shouldSkip = false;
            $firstCell = $this->getFirstNonEmptyCell($row);
            foreach ($skipKeywords as $keyword) {
                if (stripos($firstCell, $keyword) !== false) {
                    $shouldSkip = true;
                    error_log("GenericParser: Saltando fila {$i} por keyword: {$keyword}");
                    break;
                }
            }
            if ($shouldSkip) {
                continue;
            }

            $date = $this->getCellValue($row, $columns['date']);

            if (empty($date)) continue;

            if ($hasSeparateColumns && isset($columns['debit'], $columns['credit'])) {
                // ✅ Limpiar y convertir valores
                $debitRaw = $this->getCellValue($row, $columns['debit']);
                $creditRaw = $this->getCellValue($row, $columns['credit']);

                // Verificar si el banco usa formato especial
                $amountFormat = $patterns['amount_format'] ?? 'standard';

                if ($amountFormat === 'special') {
                    $debit = $this->cleanAmountSpecial($debitRaw);
                    $credit = $this->cleanAmountSpecial($creditRaw);
                } else {
                    $debit = $this->cleanAmount($debitRaw);
                    $credit = $this->cleanAmount($creditRaw);
                }

                // ✅ Si los débitos vienen como negativos, convertir a positivo para almacenar
                if ($debitNegative && $debit < 0) {
                    $debit = abs($debit);
                    error_log("GenericParser: Débito convertido de negativo a positivo: {$debitRaw} → {$debit}");
                }

                // ✅ Si los créditos son positivos, mantenerlos así
                if ($creditPositive && $credit < 0) {
                    // Si por alguna razón el crédito es negativo, convertirlo a positivo
                    $credit = abs($credit);
                }

                $reference = $this->getCellValue($row, $columns['reference']);
                $description = $this->getCellValue($row, $columns['description']);

                if ($debit > 0) {
                    $this->addTransaction($date, $reference, $description, $debit, 'expense');
                }
                if ($credit > 0) {
                    $this->addTransaction($date, $reference, $description, $credit, 'income');
                }
            } else {
                // ✅ Procesar columna única de monto (Banesco)
                $amount = $this->cleanAmount($this->getCellValue($row, $columns['amount']));
                $reference = $this->getCellValue($row, $columns['reference'] ?? '');
                $description = $this->getCellValue($row, $columns['description']);

                if ($amount == 0) continue;

                // Determinar tipo por columna de tipo de movimiento
                if (isset($columns['movement_type'])) {
                    $movementType = $this->getCellValue($row, $columns['movement_type']);
                    $creditKeywords = $patterns['credit_keywords'] ?? ['Crédito', 'Abono', 'Ingreso'];
                    $debitKeywords = $patterns['debit_keywords'] ?? ['Débito', 'Cargo', 'Egreso'];

                    $isCredit = false;
                    foreach ($creditKeywords as $keyword) {
                        if (stripos($movementType, $keyword) !== false) {
                            $isCredit = true;
                            break;
                        }
                    }

                    $isDebit = false;
                    foreach ($debitKeywords as $keyword) {
                        if (stripos($movementType, $keyword) !== false) {
                            $isDebit = true;
                            break;
                        }
                    }

                    if ($isCredit) {
                        $type = 'income';
                    } elseif ($isDebit) {
                        $type = 'expense';
                    } else {
                        $type = $amount > 0 ? 'income' : 'expense';
                    }
                } else {
                    $type = $amount > 0 ? 'income' : 'expense';
                }

                $this->addTransaction($date, $reference, $description, $amount, $type);
            }
        }

        return $this->getResult();
    }

    public function validateFormat(string $filePath): bool
    {
        $rows = $this->loadRows($filePath);

        if (empty($rows)) {
            return false;
        }

        $patterns = $this->config['patterns'];
        $startRow = $this->findStartRow($rows, $patterns);

        if ($startRow === null) {
            return false;
        }

        $columns = $patterns['columns'];

        if (!isset($rows[$startRow])) {
            return false;
        }

        $sampleRow = $rows[$startRow];

        // Verificar que exista la columna de fecha
        if (!isset($sampleRow[$columns['date']]) || empty($sampleRow[$columns['date']])) {
            return false;
        }

        return true;
    }

    /**
     * Encontrar la fila donde comienzan los datos
     */
    private function findStartRow(array $rows, array $patterns): ?int
    {
        // Si hay start_row específico
        if (isset($patterns['start_row'])) {
            return $patterns['start_row'];
        }

        // Buscar por palabra clave en encabezado
        if (isset($patterns['header_row_keyword'])) {
            $keyword = $patterns['header_row_keyword'];
            foreach ($rows as $index => $row) {
                foreach ($row as $cell) {
                    if (stripos((string)$cell, $keyword) !== false) {
                        return $index + ($patterns['start_row_offset'] ?? 1);
                    }
                }
            }
        }

        // Buscar por múltiples palabras clave
        if (isset($patterns['header_row_keywords'])) {
            foreach ($rows as $index => $row) {
                $matches = 0;
                foreach ($patterns['header_row_keywords'] as $keyword) {
                    foreach ($row as $cell) {
                        if (stripos((string)$cell, $keyword) !== false) {
                            $matches++;
                            break;
                        }
                    }
                }
                if ($matches >= count($patterns['header_row_keywords'])) {
                    return $index + ($patterns['start_row_offset'] ?? 1);
                }
            }
        }

        // Buscar primera fila con fecha válida
        $columns = $patterns['columns'];
        foreach ($rows as $index => $row) {
            if (isset($row[$columns['date']])) {
                $date = $row[$columns['date']];
                $parsedDate = $this->parseDate($date);
                if ($parsedDate !== date('Y-m-d') && !empty($date)) {
                    return $index;
                }
            }
        }

        return null;
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

    // app/Services/Parsers/GenericParser.php

    /**
     * Obtener la primera celda no vacía de una fila
     * 
     * @param array $row Fila del Excel
     * @return string
     */
    private function getFirstNonEmptyCell(array $row): string
    {
        foreach ($row as $cell) {
            $cell = trim($cell ?? '');
            if (!empty($cell)) {
                return $cell;
            }
        }
        return '';
    }
}
