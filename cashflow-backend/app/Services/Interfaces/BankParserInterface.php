<?php
// app/Services/Interfaces/BankParserInterface.php
declare(strict_types=1);

namespace App\Services\Interfaces;

interface BankParserInterface
{
    /**
     * Parsear el archivo y devolver transacciones
     * @param string $filePath Ruta del archivo
     * @return array ['success' => bool, 'data' => array, 'errors' => array]
     */
    public function parse(string $filePath): array;
    
    /**
     * Validar que el archivo tenga el formato esperado
     * @param string $filePath
     * @return bool
     */
    public function validateFormat(string $filePath): bool;
    
    /**
     * Obtener la configuración del banco
     * @return array
     */
    public function getConfig(): array;
}