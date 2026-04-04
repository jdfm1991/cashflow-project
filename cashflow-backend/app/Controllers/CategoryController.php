<?php
declare(strict_types=1);

/**
 * Controlador de Categorías
 * 
 * Maneja todas las operaciones relacionadas con categorías de ingresos y egresos.
 * Las categorías son predefinidas en el sistema, pero pueden ser personalizadas
 * por los usuarios o administradores.
 * 
 * @package App\Controllers
 */

namespace App\Controllers;

use App\Helpers\Response;
use App\Helpers\Validator;
use App\Models\Category;
use App\Models\Account;

class CategoryController
{
    /**
     * Modelo de categoría
     * @var Category
     */
    private Category $categoryModel;
    
    /**
     * Modelo de cuenta (para verificar uso de categorías)
     * @var Account
     */
    private Account $accountModel;
    
    /**
     * Constructor - Inicializa modelos
     */
    public function __construct()
    {
        $this->categoryModel = new Category();
        $this->accountModel = new Account();
    }
    
    /**
     * GET /api/categories
     * 
     * Obtener todas las categorías del sistema
     * Soporta filtros por tipo, búsqueda y paginación
     * 
     * @return void
     */
    public function index(): void
    {
        $userId = $this->getUserId();
        
        // Parámetros de filtrado
        $type = $_GET['type'] ?? null; // income, expense, all
        $search = $_GET['search'] ?? null;
        $page = (int) ($_GET['page'] ?? 1);
        $perPage = (int) ($_GET['per_page'] ?? 50);
        $includeSystem = filter_var($_GET['include_system'] ?? 'true', FILTER_VALIDATE_BOOLEAN);
        
        // Validar tipo
        if ($type && !in_array($type, ['income', 'expense', 'all'])) {
            Response::validationError(['type' => 'El tipo debe ser income, expense o all']);
        }
        
        // Obtener categorías
        $categories = $this->categoryModel->getAll($userId, $type, $search, $includeSystem);
        
        // Aplicar paginación
        $total = count($categories);
        $offset = ($page - 1) * $perPage;
        $paginated = array_slice($categories, $offset, $perPage);
        
        Response::paginated($paginated, $total, $page, $perPage);
    }
    
    /**
     * GET /api/categories/{type}
     * 
     * Obtener categorías por tipo (income o expense)
     * 
     * @param string $type Tipo de categoría (income o expense)
     * @return void
     */
    public function getByType(string $type): void
    {
        $userId = $this->getUserId();
        
        // Validar tipo
        if (!in_array($type, ['income', 'expense'])) {
            Response::validationError(['type' => 'El tipo debe ser income o expense']);
        }
        
        $categories = $this->categoryModel->getByType($userId, $type);
        
        Response::success($categories);
    }
    
    /**
     * GET /api/categories/{id}
     * 
     * Obtener una categoría específica por ID
     * 
     * @param int $id ID de la categoría
     * @return void
     */
    public function show(int $id): void
    {
        $userId = $this->getUserId();
        
        $category = $this->categoryModel->find($id);
        
        if (!$category) {
            Response::notFound('Categoría no encontrada');
        }
        
        // Verificar permisos: solo el propietario o categorías del sistema
        if ($category['user_id'] != $userId && $category['user_id'] !== null) {
            Response::forbidden('No tienes permiso para ver esta categoría');
        }
        
        Response::success($category);
    }
    
    /**
     * POST /api/categories
     * 
     * Crear una nueva categoría personalizada
     * 
     * @return void
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        
        // Obtener datos del cuerpo de la petición
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validar datos requeridos
        $validator = new Validator($data);
        $validator->required('name')->string()->minLength(2)->maxLength(50);
        $validator->required('type')->in(['income', 'expense']);
        $validator->optional('icon')->string()->maxLength(50);
        $validator->optional('color')->regex('/^#[a-fA-F0-9]{6}$/');
        $validator->optional('description')->string()->maxLength(255);
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
        }
        
        // Verificar que no exista una categoría con el mismo nombre para este usuario
        $existing = $this->categoryModel->findByName($data['name'], $userId);
        if ($existing) {
            Response::conflict('Ya existe una categoría con este nombre');
        }
        
        // Verificar límite de categorías personalizadas por usuario
        $userCategoriesCount = $this->categoryModel->countUserCategories($userId);
        if ($userCategoriesCount >= 50) {
            Response::conflict('Has alcanzado el límite máximo de 50 categorías personalizadas');
        }
        
        // Crear categoría
        $categoryData = [
            'user_id' => $userId,
            'name' => trim($data['name']),
            'type' => $data['type'],
            'icon' => $data['icon'] ?? $this->getDefaultIcon($data['type']),
            'color' => $data['color'] ?? $this->getDefaultColor(),
            'description' => $data['description'] ?? null,
            'is_system' => false
        ];
        
        $category = $this->categoryModel->create($categoryData);
        
        if ($category) {
            Response::created($category, 'Categoría creada exitosamente');
        } else {
            Response::internalError('Error al crear la categoría');
        }
    }
    
    /**
     * PUT /api/categories/{id}
     * 
     * Actualizar una categoría existente
     * 
     * @param int $id ID de la categoría
     * @return void
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        
        // Verificar que la categoría existe
        $category = $this->categoryModel->find($id);
        
        if (!$category) {
            Response::notFound('Categoría no encontrada');
        }
        
        // Verificar permisos
        if ($category['user_id'] != $userId) {
            Response::forbidden('No tienes permiso para modificar esta categoría');
        }
        
        // No permitir modificar categorías del sistema
        if ($category['is_system']) {
            Response::forbidden('No se pueden modificar las categorías del sistema');
        }
        
        // Obtener datos del cuerpo de la petición
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Validar datos
        $validator = new Validator($data);
        $validator->optional('name')->string()->minLength(2)->maxLength(50);
        $validator->optional('icon')->string()->maxLength(50);
        $validator->optional('color')->regex('/^#[a-fA-F0-9]{6}$/');
        $validator->optional('description')->string()->maxLength(255);
        $validator->optional('is_active')->boolean();
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
        }
        
        // Si se cambia el nombre, verificar que no exista duplicado
        if (isset($data['name']) && $data['name'] !== $category['name']) {
            $existing = $this->categoryModel->findByName($data['name'], $userId);
            if ($existing && $existing['id'] != $id) {
                Response::conflict('Ya existe una categoría con este nombre');
            }
        }
        
        // Preparar datos para actualizar
        $updateData = [];
        $allowedFields = ['name', 'icon', 'color', 'description', 'is_active'];
        
        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $field === 'name' ? trim($data[$field]) : $data[$field];
            }
        }
        
        // Actualizar categoría
        $updated = $this->categoryModel->update($id, $updateData);
        
        if ($updated) {
            Response::success($updated, 'Categoría actualizada exitosamente');
        } else {
            Response::internalError('Error al actualizar la categoría');
        }
    }
    
    /**
     * DELETE /api/categories/{id}
     * 
     * Eliminar una categoría personalizada
     * 
     * @param int $id ID de la categoría
     * @return void
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        
        // Verificar que la categoría existe
        $category = $this->categoryModel->find($id);
        
        if (!$category) {
            Response::notFound('Categoría no encontrada');
        }
        
        // Verificar permisos
        if ($category['user_id'] != $userId) {
            Response::forbidden('No tienes permiso para eliminar esta categoría');
        }
        
        // No permitir eliminar categorías del sistema
        if ($category['is_system']) {
            Response::forbidden('No se pueden eliminar las categorías del sistema');
        }
        
        // Verificar si hay cuentas usando esta categoría
        $accountsUsingCategory = $this->accountModel->countByCategory($category['type'], $category['name'], $userId);
        
        if ($accountsUsingCategory > 0) {
            Response::conflict("No se puede eliminar la categoría porque hay {$accountsUsingCategory} cuentas que la utilizan. Primero debes reasignar esas cuentas a otra categoría.");
        }
        
        // Eliminar categoría
        if ($this->categoryModel->delete($id)) {
            Response::success(null, 'Categoría eliminada exitosamente');
        } else {
            Response::internalError('Error al eliminar la categoría');
        }
    }
    
    /**
     * GET /api/categories/stats/usage
     * 
     * Obtener estadísticas de uso de categorías
     * 
     * @return void
     */
    public function getUsageStats(): void
    {
        $userId = $this->getUserId();
        $type = $_GET['type'] ?? null;
        
        // Validar tipo
        if ($type && !in_array($type, ['income', 'expense'])) {
            Response::validationError(['type' => 'El tipo debe ser income o expense']);
        }
        
        $stats = $this->categoryModel->getUsageStats($userId, $type);
        
        Response::success($stats);
    }
    
    /**
     * GET /api/categories/suggestions
     * 
     * Obtener sugerencias de categorías basadas en descripciones de transacciones
     * 
     * @return void
     */
    public function getSuggestions(): void
    {
        $userId = $this->getUserId();
        $type = $_GET['type'] ?? null;
        $description = $_GET['description'] ?? null;
        $limit = (int) ($_GET['limit'] ?? 5);
        
        // Validar tipo
        if ($type && !in_array($type, ['income', 'expense'])) {
            Response::validationError(['type' => 'El tipo debe ser income o expense']);
        }
        
        if (!$description) {
            Response::validationError(['description' => 'Se requiere una descripción para generar sugerencias']);
        }
        
        $suggestions = $this->categoryModel->getSuggestions($userId, $description, $type, $limit);
        
        Response::success($suggestions);
    }
    
    /**
     * POST /api/categories/reorder
     * 
     * Reordenar categorías (cambiar orden de visualización)
     * 
     * @return void
     */
    public function reorder(): void
    {
        $userId = $this->getUserId();
        
        $data = json_decode(file_get_contents('php://input'), true);
        
        $validator = new Validator($data);
        $validator->required('order')->array();
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
        }
        
        $order = $data['order'];
        
        // Validar que todos los IDs pertenezcan al usuario
        foreach ($order as $item) {
            if (!isset($item['id']) || !isset($item['position'])) {
                Response::validationError(['order' => 'Cada elemento debe tener id y position']);
            }
            
            $category = $this->categoryModel->find($item['id']);
            if (!$category || ($category['user_id'] != $userId && $category['user_id'] !== null)) {
                Response::forbidden("No tienes permiso para reordenar la categoría ID {$item['id']}");
            }
        }
        
        // Actualizar orden
        $updated = $this->categoryModel->updateOrder($userId, $order);
        
        if ($updated) {
            Response::success(null, 'Orden de categorías actualizado exitosamente');
        } else {
            Response::internalError('Error al actualizar el orden de las categorías');
        }
    }
    
    /**
     * GET /api/categories/export
     * 
     * Exportar categorías a CSV o JSON
     * 
     * @return void
     */
    public function export(): void
    {
        $userId = $this->getUserId();
        $format = $_GET['format'] ?? 'json';
        $type = $_GET['type'] ?? null;
        
        // Obtener categorías
        $categories = $this->categoryModel->getAll($userId, $type, null, true);
        
        if ($format === 'csv') {
            $this->exportAsCsv($categories);
        } else {
            Response::success($categories);
        }
    }
    
    /**
     * POST /api/categories/import
     * 
     * Importar categorías desde JSON o CSV
     * 
     * @return void
     */
    public function import(): void
    {
        $userId = $this->getUserId();
        
        // Verificar límite de archivo
        if ($_FILES['file']['size'] > 5 * 1024 * 1024) {
            Response::validationError(['file' => 'El archivo no debe exceder los 5MB']);
        }
        
        $file = $_FILES['file'];
        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        
        if (!in_array(strtolower($extension), ['json', 'csv'])) {
            Response::validationError(['file' => 'Formato no soportado. Use JSON o CSV']);
        }
        
        $content = file_get_contents($file['tmp_name']);
        
        if ($extension === 'json') {
            $data = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                Response::validationError(['file' => 'JSON inválido']);
            }
        } else {
            // Procesar CSV
            $data = $this->parseCsv($content);
        }
        
        if (empty($data)) {
            Response::validationError(['file' => 'El archivo no contiene datos válidos']);
        }
        
        // Validar y procesar cada categoría
        $imported = 0;
        $errors = [];
        
        foreach ($data as $index => $item) {
            // Validar campos requeridos
            if (!isset($item['name']) || !isset($item['type'])) {
                $errors[] = "Fila {$index}: Falta nombre o tipo";
                continue;
            }
            
            // Validar tipo
            if (!in_array($item['type'], ['income', 'expense'])) {
                $errors[] = "Fila {$index}: Tipo inválido. Use income o expense";
                continue;
            }
            
            // Verificar si ya existe
            $existing = $this->categoryModel->findByName($item['name'], $userId);
            if ($existing) {
                $errors[] = "Fila {$index}: La categoría '{$item['name']}' ya existe";
                continue;
            }
            
            // Crear categoría
            $categoryData = [
                'user_id' => $userId,
                'name' => trim($item['name']),
                'type' => $item['type'],
                'icon' => $item['icon'] ?? $this->getDefaultIcon($item['type']),
                'color' => $item['color'] ?? $this->getDefaultColor(),
                'description' => $item['description'] ?? null,
                'is_system' => false
            ];
            
            $created = $this->categoryModel->create($categoryData);
            if ($created) {
                $imported++;
            } else {
                $errors[] = "Fila {$index}: Error al crear la categoría";
            }
        }
        
        Response::success([
            'imported' => $imported,
            'errors' => $errors,
            'total' => count($data)
        ], "Se importaron {$imported} categorías exitosamente");
    }
    
    /**
     * Obtener ícono por defecto según tipo
     * 
     * @param string $type Tipo de categoría
     * @return string
     */
    private function getDefaultIcon(string $type): string
    {
        return $type === 'income' ? 'bi-cash-stack' : 'bi-cash';
    }
    
    /**
     * Obtener color por defecto
     * 
     * @return string
     */
    private function getDefaultColor(): string
    {
        return '#6c757d';
    }
    
    /**
     * Parsear contenido CSV
     * 
     * @param string $content
     * @return array
     */
    private function parseCsv(string $content): array
    {
        $lines = explode("\n", trim($content));
        if (empty($lines)) {
            return [];
        }
        
        // Obtener encabezados
        $headers = str_getcsv(array_shift($lines));
        $headers = array_map('trim', $headers);
        
        $data = [];
        foreach ($lines as $line) {
            if (empty(trim($line))) {
                continue;
            }
            
            $values = str_getcsv($line);
            $row = [];
            foreach ($headers as $index => $header) {
                if (isset($values[$index])) {
                    $row[$header] = trim($values[$index]);
                }
            }
            $data[] = $row;
        }
        
        return $data;
    }
    
    /**
     * Exportar como CSV
     * 
     * @param array $categories
     * @return void
     */
    private function exportAsCsv(array $categories): void
    {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="categories_' . date('Y-m-d') . '.csv"');
        
        $output = fopen('php://output', 'w');
        
        // Escribir encabezados
        fputcsv($output, ['id', 'name', 'type', 'icon', 'color', 'description', 'is_system', 'is_active']);
        
        // Escribir datos
        foreach ($categories as $category) {
            fputcsv($output, [
                $category['id'],
                $category['name'],
                $category['type'],
                $category['icon'],
                $category['color'],
                $category['description'],
                $category['is_system'] ? '1' : '0',
                $category['is_active'] ? '1' : '0'
            ]);
        }
        
        fclose($output);
        exit();
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