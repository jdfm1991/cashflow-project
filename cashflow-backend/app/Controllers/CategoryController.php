<?php
// app/Controllers/CategoryController.php

namespace App\Controllers;

use App\Models\Category;
use App\Helpers\Response;
use App\Helpers\Validator;

class CategoryController
{
    private Category $categoryModel;

    public function __construct()
    {
        $this->categoryModel = new Category();
    }

    /**
     * GET /api/categories
     * Listar todas las categorías (filtradas por rol)
     */
    public function index(): void
    {
        $userRole = $this->getUserRole();

        error_log("=== CATEGORIES INDEX ===");
        error_log("User Role: " . $userRole);

        if ($userRole === 'super_admin') {
            $categories = $this->categoryModel->getAll();
        } else {
            $categories = $this->categoryModel->getAllActive();
        }

        error_log("Categories found: " . count($categories));

        // ✅ Asegurar que siempre devolvemos un array
        Response::success($categories ?? []);
    }
    /**
     * GET /api/categories/income
     * Obtener categorías de ingresos
     */
    public function getIncomeCategories(): void
    {
        $categories = $this->categoryModel->getByType('income');
        Response::success($categories);
    }

    /**
     * GET /api/categories/expense
     * Obtener categorías de egresos
     */
    public function getExpenseCategories(): void
    {
        $categories = $this->categoryModel->getByType('expense');
        Response::success($categories);
    }

    /**
     * GET /api/categories/{id}
     * Obtener categoría específica
     */
    public function show(int $id): void
    {
        $category = $this->categoryModel->find($id);

        if (!$category) {
            Response::notFound('Categoría no encontrada');
            return;
        }

        Response::success($category);
    }

    /**
     * POST /api/categories
     * Crear nueva categoría (solo super_admin)
     */
    public function store(): void
    {
        $userRole = $this->getUserRole();

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear categorías');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $validator = new Validator($data);
        $validator->required('name');
        $validator->required('type');
        $validator->in('type', ['income', 'expense']);
        $validator->string('name');
        $validator->minLength('name', 2);
        $validator->maxLength('name', 50);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar que no exista una categoría con el mismo nombre y tipo
        $existing = $this->categoryModel->findByNameAndType($data['name'], $data['type']);

        if ($existing) {
            Response::conflict('Ya existe una categoría con ese nombre para este tipo');
            return;
        }

        $categoryData = [
            'name' => $data['name'],
            'type' => $data['type'],
            'icon' => $data['icon'] ?? 'bi-tag',
            'color' => $data['color'] ?? '#6c757d',
            'description' => $data['description'] ?? null,
            'is_system' => 0,
            'is_active' => $data['is_active'] ?? 1,
            'sort_order' => $data['sort_order'] ?? 999
        ];

        $category = $this->categoryModel->create($categoryData);

        if ($category) {
            Response::success($category, 'Categoría creada exitosamente', 201);
        } else {
            Response::error('Error al crear la categoría', 500);
        }
    }

    /**
     * PUT /api/categories/{id}
     * Actualizar categoría
     */
    public function update(int $id): void
    {
        $userRole = $this->getUserRole();

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para editar categorías');
            return;
        }

        $category = $this->categoryModel->find($id);

        if (!$category) {
            Response::notFound('Categoría no encontrada');
            return;
        }

        // Verificar si es categoría del sistema
        if ($category['is_system'] == 1) {
            Response::forbidden('No se puede editar una categoría del sistema');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        $allowedFields = ['name', 'icon', 'color', 'description', 'is_active', 'sort_order'];
        $updateData = [];

        foreach ($allowedFields as $field) {
            if (isset($data[$field])) {
                $updateData[$field] = $data[$field];
            }
        }

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        // ✅ Si se actualiza el nombre, verificar que no haya duplicado
        if (isset($updateData['name']) && $updateData['name'] !== $category['name']) {
            // Verificar duplicado
            $existing = $this->categoryModel->findByNameAndType($updateData['name'], $category['type']);
            if ($existing && $existing['id'] != $id) {
                Response::conflict('Ya existe otra categoría con ese nombre para este tipo');
                return;
            }

            // ✅ Verificar si hay cuentas usando esta categoría
            if ($this->categoryModel->hasAccounts($id)) {
                // Si hay cuentas, no permitir cambiar el nombre directamente
                // Mostrar mensaje de advertencia
                Response::error(
                    'No se puede cambiar el nombre de esta categoría porque tiene cuentas asociadas. ' .
                        'Primero debe cambiar la categoría de las cuentas afectadas.',
                    400
                );
                return;
            }
        }

        $updated = $this->categoryModel->update($id, $updateData);

        if ($updated) {
            // ✅ Si se actualizó el nombre, también actualizar las referencias en accounts
            if (isset($updateData['name']) && $updateData['name'] !== $category['name']) {
                $this->updateAccountCategories($category['name'], $updateData['name']);
            }

            Response::success($updated, 'Categoría actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la categoría', 500);
        }
    }

    /**
     * Actualizar el nombre de la categoría en las cuentas asociadas
     */
    private function updateAccountCategories(string $oldName, string $newName): void
    {
        $db = \App\Config\Database::getInstance()->getConnection();
        $sql = "UPDATE accounts SET category = :new_name WHERE category = :old_name";
        $stmt = $db->prepare($sql);
        $stmt->execute([
            'new_name' => $newName,
            'old_name' => $oldName
        ]);
    }

    /**
     * DELETE /api/categories/{id}
     * Eliminar categoría
     */
    public function destroy(int $id): void
    {
        $userRole = $this->getUserRole();

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para eliminar categorías');
            return;
        }

        $category = $this->categoryModel->find($id);

        if (!$category) {
            Response::notFound('Categoría no encontrada');
            return;
        }

        // Verificar si es categoría del sistema
        if ($category['is_system'] == 1) {
            Response::forbidden('No se puede eliminar una categoría del sistema');
            return;
        }

        // Verificar si tiene cuentas asociadas
        if ($this->categoryModel->hasAccounts($id)) {
            Response::error('No se puede eliminar la categoría porque tiene cuentas asociadas', 400);
            return;
        }

        if ($this->categoryModel->delete($id)) {
            Response::success(null, 'Categoría eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la categoría', 500);
        }
    }

    private function getUserId(): int
    {
        return (int) ($_REQUEST['user_id'] ?? 0);
    }

    private function getUserRole(): string
    {
        $userId = $this->getUserId();

        if ($userId <= 0) {
            return 'guest';
        }

        $userModel = new \App\Models\User();
        $user = $userModel->find($userId);
        return $user['role'] ?? 'user';
    }
}
