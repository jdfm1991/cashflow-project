<?php
declare(strict_types=1);

/**
 * Controlador de Carga de Archivos
 * 
 * Maneja la carga masiva de datos desde archivos Excel, CSV y otros formatos.
 * Permite previsualizar datos antes de importar, mapear columnas y procesar
 * transacciones en lotes.
 * 
 * @package App\Controllers
 */

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Validator;
use App\Models\Income;
use App\Models\Expense;
use App\Models\Account;
use App\Models\Category;
use App\Services\ExcelParserService;
use DateTime;

class UploadController
{
    /**
     * Modelo de ingresos
     * @var Income
     */
    private Income $incomeModel;
    
    /**
     * Modelo de egresos
     * @var Expense
     */
    private Expense $expenseModel;
    
    /**
     * Modelo de cuentas
     * @var Account
     */
    private Account $accountModel;
    
    /**
     * Modelo de categorías
     * @var Category
     */
    private Category $categoryModel;
    
    /**
     * Servicio de parseo de Excel
     * @var ExcelParserService
     */
    private ExcelParserService $excelParser;
    
    /**
     * Directorio de uploads temporales
     * @var string
     */
    private string $uploadDir;
    
    /**
     * Constructor - Inicializa modelos y servicios
     */
    public function __construct()
    {
        $this->incomeModel = new Income();
        $this->expenseModel = new Expense();
        $this->accountModel = new Account();
        $this->categoryModel = new Category();
        $this->excelParser = new ExcelParserService();
        $this->uploadDir = UPLOADS_PATH . '/temp/';
        
        // Crear directorio si no existe
        if (!is_dir($this->uploadDir)) {
            mkdir($this->uploadDir, 0777, true);
        }
    }
    
    /**
     * POST /api/uploads/excel
     * 
     * Cargar archivo Excel para procesamiento
     * 
     * @return void
     */
    public function uploadExcel(): void
    {
        $userId = $this->getUserId();
        
        // Verificar que se haya enviado un archivo
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            Response::validationError(['file' => 'No se ha enviado ningún archivo o hubo un error en la carga']);
        }
        
        $file = $_FILES['file'];
        
        // Validar tamaño (máximo 5MB)
        if ($file['size'] > 5 * 1024 * 1024) {
            Response::validationError(['file' => 'El archivo no debe exceder los 5MB']);
        }
        
        // Validar tipo de archivo
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowedExtensions = ['xlsx', 'xls', 'csv'];
        
        if (!in_array($extension, $allowedExtensions)) {
            Response::validationError(['file' => 'Formato no soportado. Use XLSX, XLS o CSV']);
        }
        
        // Generar nombre único para el archivo temporal
        $tempFilename = uniqid('upload_') . '_' . $userId . '.' . $extension;
        $tempPath = $this->uploadDir . $tempFilename;
        
        // Mover archivo a directorio temporal
        if (!move_uploaded_file($file['tmp_name'], $tempPath)) {
            Response::internalError('Error al guardar el archivo temporal');
        }
        
        // Parsear archivo
        try {
            $parsedData = $this->excelParser->parse($tempPath, $extension);
            
            // Guardar información de la sesión de carga
            $uploadId = $this->createUploadSession($userId, $tempFilename, $parsedData);
            
            Response::success([
                'upload_id' => $uploadId,
                'filename' => $file['name'],
                'rows' => count($parsedData['data']),
                'columns' => $parsedData['headers'],
                'preview' => array_slice($parsedData['data'], 0, 5),
                'total_rows' => count($parsedData['data'])
            ], 'Archivo cargado exitosamente. Ahora puede mapear las columnas.');
            
        } catch (\Exception $e) {
            // Limpiar archivo temporal
            unlink($tempPath);
            Response::internalError('Error al procesar el archivo: ' . $e->getMessage());
        }
    }
    
    /**
     * POST /api/uploads/preview
     * 
     * Previsualizar datos con mapeo de columnas
     * 
     * @return void
     */
    public function preview(): void
    {
        $userId = $this->getUserId();
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validar datos requeridos
        $validator = new Validator($data);
        $validator->required('upload_id')->string();
        $validator->required('mapping')->array();
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
        }
        
        $uploadId = $data['upload_id'];
        $mapping = $data['mapping'];
        
        // Obtener sesión de carga
        $uploadSession = $this->getUploadSession($userId, $uploadId);
        
        if (!$uploadSession) {
            Response::notFound('Sesión de carga no encontrada o expirada');
        }
        
        // Validar mapeo
        $requiredFields = ['date', 'amount'];
        foreach ($requiredFields as $field) {
            if (!isset($mapping[$field]) || $mapping[$field] === '') {
                Response::validationError([$field => "El campo {$field} es requerido para el mapeo"]);
            }
        }
        
        // Aplicar mapeo a los datos
        $mappedData = $this->applyMapping($uploadSession['data'], $mapping);
        
        // Obtener cuentas disponibles
        $type = $data['type'] ?? 'income';
        $accounts = $this->accountModel->getByUser($userId, $type);
        
        // Previsualizar datos mapeados
        $preview = array_slice($mappedData, 0, 10);
        
        // Validar datos para mostrar errores
        $validationErrors = $this->validateMappedData($preview, $type);
        
        Response::success([
            'preview' => $preview,
            'total_rows' => count($mappedData),
            'validation_errors' => $validationErrors,
            'accounts' => $accounts,
            'suggested_accounts' => $this->getSuggestedAccounts($preview, $type, $userId)
        ]);
    }
    
    /**
     * POST /api/uploads/process
     * 
     * Procesar e importar datos mapeados
     * 
     * @return void
     */
    public function process(): void
    {
        $userId = $this->getUserId();
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validar datos requeridos
        $validator = new Validator($data);
        $validator->required('upload_id')->string();
        $validator->required('mapping')->array();
        $validator->required('type')->in(['income', 'expense']);
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
        }
        
        $uploadId = $data['upload_id'];
        $mapping = $data['mapping'];
        $type = $data['type'];
        $defaultAccountId = $data['default_account_id'] ?? null;
        $skipErrors = $data['skip_errors'] ?? false;
        
        // Obtener sesión de carga
        $uploadSession = $this->getUploadSession($userId, $uploadId);
        
        if (!$uploadSession) {
            Response::notFound('Sesión de carga no encontrada o expirada');
        }
        
        // Validar mapeo
        $requiredFields = ['date', 'amount'];
        foreach ($requiredFields as $field) {
            if (!isset($mapping[$field]) || $mapping[$field] === '') {
                Response::validationError([$field => "El campo {$field} es requerido para el mapeo"]);
            }
        }
        
        // Aplicar mapeo a todos los datos
        $mappedData = $this->applyMapping($uploadSession['data'], $mapping);
        
        // Procesar importación
        $result = $this->importTransactions($userId, $mappedData, $type, $defaultAccountId, $skipErrors);
        
        // Limpiar archivo temporal
        $this->cleanupUploadSession($userId, $uploadId);
        
        Response::success([
            'imported' => $result['imported'],
            'failed' => $result['failed'],
            'errors' => $result['errors'],
            'total' => count($mappedData),
            'summary' => $this->generateImportSummary($result)
        ], "Importación completada. Se importaron {$result['imported']} registros.");
    }
    
    /**
     * GET /api/uploads/history
     * 
     * Obtener historial de cargas masivas
     * 
     * @return void
     */
    public function history(): void
    {
        $userId = $this->getUserId();
        
        $page = (int) ($_GET['page'] ?? 1);
        $perPage = (int) ($_GET['per_page'] ?? 20);
        $status = $_GET['status'] ?? null;
        
        $history = $this->getUploadHistory($userId, $page, $perPage, $status);
        
        Response::paginated($history['data'], $history['total'], $page, $perPage);
    }
    
    /**
     * GET /api/uploads/status/{uploadId}
     * 
     * Obtener estado de una carga específica
     * 
     * @param string $uploadId
     * @return void
     */
    public function status(string $uploadId): void
    {
        $userId = $this->getUserId();
        
        $upload = $this->getUploadById($userId, $uploadId);
        
        if (!$upload) {
            Response::notFound('Carga no encontrada');
        }
        
        Response::success($upload);
    }
    
    /**
     * DELETE /api/uploads/{uploadId}
     * 
     * Cancelar y eliminar una sesión de carga pendiente
     * 
     * @param string $uploadId
     * @return void
     */
    public function cancel(string $uploadId): void
    {
        $userId = $this->getUserId();
        
        $uploadSession = $this->getUploadSession($userId, $uploadId);
        
        if (!$uploadSession) {
            Response::notFound('Sesión de carga no encontrada');
        }
        
        // Limpiar archivo temporal
        $this->cleanupUploadSession($userId, $uploadId);
        
        Response::success(null, 'Sesión de carga cancelada exitosamente');
    }
    
    /**
     * POST /api/uploads/template
     * 
     * Descargar plantilla de ejemplo para carga masiva
     * 
     * @return void
     */
    public function downloadTemplate(): void
    {
        $type = $_GET['type'] ?? 'income';
        
        if (!in_array($type, ['income', 'expense'])) {
            Response::validationError(['type' => 'El tipo debe ser income o expense']);
        }
        
        $template = $this->generateTemplate($type);
        
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Disposition: attachment; filename="template_' . $type . '_' . date('Y-m-d') . '.xlsx"');
        
        // Por ahora, exportar como CSV
        $this->exportTemplateAsCsv($template, $type);
    }
    
    /**
     * Crear sesión de carga
     * 
     * @param int $userId
     * @param string $filename
     * @param array $parsedData
     * @return string
     */
    private function createUploadSession(int $userId, string $filename, array $parsedData): string
    {
        $uploadId = uniqid('upload_') . '_' . time();
        
        $session = [
            'upload_id' => $uploadId,
            'user_id' => $userId,
            'filename' => $filename,
            'headers' => $parsedData['headers'],
            'data' => $parsedData['data'],
            'created_at' => date('Y-m-d H:i:s'),
            'expires_at' => date('Y-m-d H:i:s', strtotime('+1 hour'))
        ];
        
        // Guardar en sesión o base de datos temporal
        $this->saveUploadSession($session);
        
        return $uploadId;
    }
    
    /**
     * Guardar sesión de carga
     * 
     * @param array $session
     * @return void
     */
    private function saveUploadSession(array $session): void
    {
        // Usar archivo JSON temporal
        $sessionFile = $this->uploadDir . $session['upload_id'] . '.json';
        file_put_contents($sessionFile, json_encode($session));
    }
    
    /**
     * Obtener sesión de carga
     * 
     * @param int $userId
     * @param string $uploadId
     * @return array|null
     */
    private function getUploadSession(int $userId, string $uploadId): ?array
    {
        $sessionFile = $this->uploadDir . $uploadId . '.json';
        
        if (!file_exists($sessionFile)) {
            return null;
        }
        
        $session = json_decode(file_get_contents($sessionFile), true);
        
        // Verificar expiración
        if (strtotime($session['expires_at']) < time()) {
            unlink($sessionFile);
            return null;
        }
        
        // Verificar usuario
        if ($session['user_id'] != $userId) {
            return null;
        }
        
        return $session;
    }
    
    /**
     * Limpiar sesión de carga
     * 
     * @param int $userId
     * @param string $uploadId
     * @return void
     */
    private function cleanupUploadSession(int $userId, string $uploadId): void
    {
        $sessionFile = $this->uploadDir . $uploadId . '.json';
        
        if (file_exists($sessionFile)) {
            $session = json_decode(file_get_contents($sessionFile), true);
            if ($session && $session['user_id'] == $userId) {
                unlink($sessionFile);
                
                // Limpiar archivo Excel original si existe
                $excelFile = $this->uploadDir . $session['filename'];
                if (file_exists($excelFile)) {
                    unlink($excelFile);
                }
            }
        }
    }
    
    /**
     * Aplicar mapeo de columnas a los datos
     * 
     * @param array $data
     * @param array $mapping
     * @return array
     */
    private function applyMapping(array $data, array $mapping): array
    {
        $mappedData = [];
        
        foreach ($data as $row) {
            $mappedRow = [];
            
            foreach ($mapping as $field => $columnIndex) {
                if ($columnIndex !== '' && isset($row[$columnIndex])) {
                    $mappedRow[$field] = $row[$columnIndex];
                } elseif ($columnIndex !== '') {
                    $mappedRow[$field] = null;
                }
            }
            
            // Si hay campos opcionales no mapeados, dejarlos como null
            $optionalFields = ['description', 'reference', 'account_name', 'category'];
            foreach ($optionalFields as $field) {
                if (!isset($mappedRow[$field])) {
                    $mappedRow[$field] = null;
                }
            }
            
            $mappedData[] = $mappedRow;
        }
        
        return $mappedData;
    }
    
    /**
     * Validar datos mapeados
     * 
     * @param array $data
     * @param string $type
     * @return array
     */
    private function validateMappedData(array $data, string $type): array
    {
        $errors = [];
        
        foreach ($data as $index => $row) {
            $rowErrors = [];
            
            // Validar fecha
            if (empty($row['date'])) {
                $rowErrors[] = 'Fecha requerida';
            } elseif (!$this->validateDate($row['date'])) {
                $rowErrors[] = 'Formato de fecha inválido';
            }
            
            // Validar monto
            if (empty($row['amount'])) {
                $rowErrors[] = 'Monto requerido';
            } elseif (!is_numeric($row['amount']) || $row['amount'] <= 0) {
                $rowErrors[] = 'Monto debe ser un número positivo';
            }
            
            if (!empty($rowErrors)) {
                $errors[] = [
                    'row' => $index + 1,
                    'errors' => $rowErrors,
                    'data' => $row
                ];
            }
        }
        
        return $errors;
    }
    
    /**
     * Importar transacciones
     * 
     * @param int $userId
     * @param array $data
     * @param string $type
     * @param int|null $defaultAccountId
     * @param bool $skipErrors
     * @return array
     */
    private function importTransactions(int $userId, array $data, string $type, ?int $defaultAccountId, bool $skipErrors): array
    {
        $imported = 0;
        $failed = 0;
        $errors = [];
        
        // Obtener cuentas del usuario para mapeo por nombre
        $accounts = $this->accountModel->getByUser($userId);
        $accountsByName = [];
        foreach ($accounts as $account) {
            $accountsByName[strtolower($account['name'])] = $account;
        }
        
        // Obtener categorías para validación
        $categories = $this->categoryModel->getAll($userId);
        $categoryNames = array_column($categories, 'name');
        
        foreach ($data as $index => $row) {
            try {
                // Validar datos básicos
                if (empty($row['date']) || empty($row['amount'])) {
                    if (!$skipErrors) {
                        throw new \Exception('Datos incompletos');
                    }
                    $failed++;
                    $errors[] = ['row' => $index + 1, 'error' => 'Datos incompletos'];
                    continue;
                }
                
                // Formatear fecha
                $date = $this->formatDate($row['date']);
                if (!$date) {
                    throw new \Exception('Fecha inválida');
                }
                
                // Determinar cuenta
                $accountId = null;
                
                if (!empty($row['account_name'])) {
                    $accountName = strtolower(trim($row['account_name']));
                    if (isset($accountsByName[$accountName])) {
                        $accountId = $accountsByName[$accountName]['id'];
                    }
                }
                
                if (!$accountId && $defaultAccountId) {
                    $accountId = $defaultAccountId;
                }
                
                if (!$accountId) {
                    throw new \Exception('No se pudo determinar la cuenta para esta transacción');
                }
                
                // Validar que la cuenta pertenezca al tipo correcto
                $account = $this->accountModel->find($accountId);
                if (!$account || $account['type'] !== $type) {
                    throw new \Exception("La cuenta seleccionada no es de tipo {$type}");
                }
                
                // Preparar datos de la transacción
                $transactionData = [
                    'user_id' => $userId,
                    'account_id' => $accountId,
                    'amount' => abs(floatval($row['amount'])),
                    'date' => $date,
                    'description' => $row['description'] ?? 'Importación masiva',
                    'reference' => $row['reference'] ?? null
                ];
                
                // Guardar transacción
                if ($type === 'income') {
                    $this->incomeModel->create($transactionData);
                } else {
                    $this->expenseModel->create($transactionData);
                }
                
                $imported++;
                
            } catch (\Exception $e) {
                $failed++;
                if (!$skipErrors) {
                    Response::validationError(['row' => $index + 1, 'error' => $e->getMessage()]);
                }
                $errors[] = ['row' => $index + 1, 'error' => $e->getMessage()];
            }
        }
        
        return [
            'imported' => $imported,
            'failed' => $failed,
            'errors' => $errors
        ];
    }
    
    /**
     * Obtener cuentas sugeridas basadas en descripciones
     * 
     * @param array $preview
     * @param string $type
     * @param int $userId
     * @return array
     */
    private function getSuggestedAccounts(array $preview, string $type, int $userId): array
    {
        $suggestions = [];
        $keywords = [];
        
        // Extraer palabras clave de las descripciones
        foreach ($preview as $row) {
            if (!empty($row['description'])) {
                $words = preg_split('/[\s,;:\.\-]+/', strtolower($row['description']));
                $keywords = array_merge($keywords, $words);
            }
        }
        
        $keywords = array_unique(array_filter($keywords, function($word) {
            return strlen($word) > 2;
        }));
        
        // Buscar cuentas que coincidan con las palabras clave
        $accounts = $this->accountModel->getByUser($userId, $type);
        
        foreach ($accounts as $account) {
            $score = 0;
            foreach ($keywords as $keyword) {
                if (stripos($account['name'], $keyword) !== false) {
                    $score += 10;
                }
                if (stripos($account['category'], $keyword) !== false) {
                    $score += 5;
                }
            }
            
            if ($score > 0) {
                $suggestions[] = [
                    'account_id' => $account['id'],
                    'account_name' => $account['name'],
                    'category' => $account['category'],
                    'score' => $score
                ];
            }
        }
        
        // Ordenar por puntuación
        usort($suggestions, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });
        
        return array_slice($suggestions, 0, 5);
    }
    
    /**
     * Obtener historial de cargas
     * 
     * @param int $userId
     * @param int $page
     * @param int $perPage
     * @param string|null $status
     * @return array
     */
    private function getUploadHistory(int $userId, int $page, int $perPage, ?string $status): array
    {
        // Escanear archivos de sesión
        $files = glob($this->uploadDir . 'upload_*.json');
        $history = [];
        
        foreach ($files as $file) {
            $session = json_decode(file_get_contents($file), true);
            if ($session && $session['user_id'] == $userId) {
                $history[] = [
                    'upload_id' => $session['upload_id'],
                    'filename' => $session['filename'],
                    'created_at' => $session['created_at'],
                    'rows' => count($session['data']),
                    'status' => strtotime($session['expires_at']) > time() ? 'pending' : 'expired'
                ];
            }
        }
        
        // Ordenar por fecha descendente
        usort($history, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        // Filtrar por estado
        if ($status) {
            $history = array_filter($history, function($item) use ($status) {
                return $item['status'] === $status;
            });
        }
        
        $total = count($history);
        $offset = ($page - 1) * $perPage;
        $paginated = array_slice($history, $offset, $perPage);
        
        return [
            'data' => array_values($paginated),
            'total' => $total
        ];
    }
    
    /**
     * Obtener carga por ID
     * 
     * @param int $userId
     * @param string $uploadId
     * @return array|null
     */
    private function getUploadById(int $userId, string $uploadId): ?array
    {
        $sessionFile = $this->uploadDir . $uploadId . '.json';
        
        if (!file_exists($sessionFile)) {
            return null;
        }
        
        $session = json_decode(file_get_contents($sessionFile), true);
        
        if ($session && $session['user_id'] == $userId) {
            return [
                'upload_id' => $session['upload_id'],
                'filename' => $session['filename'],
                'created_at' => $session['created_at'],
                'expires_at' => $session['expires_at'],
                'rows' => count($session['data']),
                'headers' => $session['headers']
            ];
        }
        
        return null;
    }
    
    /**
     * Generar resumen de importación
     * 
     * @param array $result
     * @return array
     */
    private function generateImportSummary(array $result): array
    {
        $summary = [
            'total_processed' => $result['imported'] + $result['failed'],
            'success_rate' => 0,
            'error_rate' => 0
        ];
        
        if ($summary['total_processed'] > 0) {
            $summary['success_rate'] = round(($result['imported'] / $summary['total_processed']) * 100, 2);
            $summary['error_rate'] = round(($result['failed'] / $summary['total_processed']) * 100, 2);
        }
        
        return $summary;
    }
    
    /**
     * Generar plantilla de ejemplo
     * 
     * @param string $type
     * @return array
     */
    private function generateTemplate(string $type): array
    {
        $template = [];
        
        if ($type === 'income') {
            $template['headers'] = ['Fecha', 'Descripción', 'Monto', 'Cuenta', 'Referencia'];
            $template['examples'] = [
                ['2024-01-15', 'Venta producto A', '1500.00', 'Ventas', 'FACT-001'],
                ['2024-01-20', 'Alquiler oficina', '800.00', 'Alquileres', ''],
                ['2024-01-25', 'Servicio consultoría', '2500.00', 'Honorarios', 'CONT-001']
            ];
        } else {
            $template['headers'] = ['Fecha', 'Descripción', 'Monto', 'Cuenta', 'Referencia'];
            $template['examples'] = [
                ['2024-01-10', 'Pago impuestos', '500.00', 'Impuestos', ''],
                ['2024-01-30', 'Sueldos enero', '3000.00', 'Nómina', 'NOM-001'],
                ['2024-02-05', 'Compra insumos', '1200.00', 'Proveedores', 'COMP-001']
            ];
        }
        
        return $template;
    }
    
    /**
     * Exportar plantilla como CSV
     * 
     * @param array $template
     * @param string $type
     * @return void
     */
    private function exportTemplateAsCsv(array $template, string $type): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="template_' . $type . '_' . date('Y-m-d') . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Escribir encabezados
        fputcsv($output, $template['headers']);
        
        // Escribir ejemplos
        foreach ($template['examples'] as $example) {
            fputcsv($output, $example);
        }
        
        // Agregar filas en blanco para datos del usuario
        for ($i = 0; $i < 10; $i++) {
            fputcsv($output, array_fill(0, count($template['headers']), ''));
        }
        
        fclose($output);
        exit();
    }
    
    /**
     * Formatear fecha a formato Y-m-d
     * 
     * @param mixed $date
     * @return string|null
     */
    private function formatDate($date): ?string
    {
        if (empty($date)) {
            return null;
        }
        
        // Si es número de Excel (fecha serial)
        if (is_numeric($date) && $date > 40000) {
            $excelEpoch = new DateTime('1899-12-30');
            $dateObj = $excelEpoch->modify("+{$date} days");
            return $dateObj->format('Y-m-d');
        }
        
        // Intentar parsear string
        $timestamp = strtotime($date);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }
        
        return null;
    }
    
    /**
     * Validar formato de fecha
     * 
     * @param string $date
     * @return bool
     */
    private function validateDate(string $date): bool
    {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        return $d && $d->format('Y-m-d') === $date;
    }
    
    /**
     * Obtener ID de usuario autenticado
     * 
     * @return int
     */
    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 1);
    }
}