<?php
declare(strict_types=1);

namespace App\Services;

class ExcelParserService
{
    /**
     * Parsear archivo Excel o CSV
     * 
     * @param string $filePath
     * @param string $extension
     * @return array
     */
    public function parse(string $filePath, string $extension): array
    {
        $data = [];
        $headers = [];
        
        if ($extension === 'csv') {
            $result = $this->parseCsv($filePath);
            $headers = $result['headers'];
            $data = $result['data'];
        } else {
            // Para XLSX/XLS necesitarías PhpSpreadsheet
            // Por ahora, simulamos el parseo
            $result = $this->parseExcelSimulated($filePath);
            $headers = $result['headers'];
            $data = $result['data'];
        }
        
        return [
            'headers' => $headers,
            'data' => $data
        ];
    }
    
    /**
     * Parsear archivo CSV
     * 
     * @param string $filePath
     * @return array
     */
    private function parseCsv(string $filePath): array
    {
        $headers = [];
        $data = [];
        
        if (($handle = fopen($filePath, 'r')) !== false) {
            // Leer encabezados
            $headers = fgetcsv($handle);
            
            // Leer datos
            while (($row = fgetcsv($handle)) !== false) {
                $data[] = $row;
            }
            
            fclose($handle);
        }
        
        return [
            'headers' => $headers,
            'data' => $data
        ];
    }
    
    /**
     * Parseo simulado de Excel (para demostración)
     * 
     * @param string $filePath
     * @return array
     */
    private function parseExcelSimulated(string $filePath): array
    {
        // En una implementación real, usarías PhpSpreadsheet
        // Por ahora, retornamos datos de ejemplo
        return [
            'headers' => ['Fecha', 'Descripción', 'Monto', 'Cuenta', 'Referencia'],
            'data' => [
                ['2024-01-15', 'Venta producto A', '1500.00', 'Ventas', 'FACT-001'],
                ['2024-01-20', 'Alquiler oficina', '800.00', 'Alquileres', ''],
                ['2024-01-25', 'Servicio consultoría', '2500.00', 'Honorarios', 'CONT-001'],
                ['2024-02-10', 'Venta producto B', '2200.00', 'Ventas', 'FACT-002'],
                ['2024-02-15', 'Pago servicios', '350.00', 'Servicios', ''],
            ]
        ];
    }
}