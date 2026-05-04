<?php
// app/Controllers/CompanyController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\Company;
use App\Models\User;
use App\Helpers\Response;
use App\Helpers\Validator;

class CompanyController
{
    private Company $companyModel;
    private User $userModel;

    public function __construct()
    {
        $this->companyModel = new Company();
        $this->userModel = new User();
    }

    /**
     * GET /api/companies
     * Listar todas las empresas (solo admin global)
     */
    public function index(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        // Solo administradores globales pueden ver todas las empresas
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para listar todas las empresas');
            return;
        }

        $companies = $this->companyModel->all();
        Response::success($companies);
    }

    /**
     * GET /api/companies/me
     * Obtener la empresa del usuario autenticado
     */
    public function myCompany(): void
    {
        $userId = $this->getUserId();
        $companyId = $this->getUserCompanyId($userId);

        if (!$companyId) {
            Response::notFound('Usuario no tiene empresa asociada');
            return;
        }

        $company = $this->companyModel->find($companyId);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        Response::success($company);
    }

    /**
     * GET /api/companies/{id}
     * Obtener empresa específica
     */
    public function show(int $id): void
    {
        $userId = $this->getUserId();
        $userCompanyId = $this->getUserCompanyId($userId);
        $userRole = $this->getUserRole($userId);

        $company = $this->companyModel->find($id);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        // Verificar permisos: el usuario debe pertenecer a la empresa o ser admin global
        if ($userCompanyId != $id && $userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para ver esta empresa');
            return;
        }

        Response::success($company);
    }


    /**
     * POST /api/companies
     * Crear nueva empresa (solo super_admin)
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear empresas');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->required('name');
        $validator->string('name');
        $validator->minLength('name', 3);
        $validator->maxLength('name', 100);

        $validator->optional('business_name');
        $validator->string('business_name');
        $validator->maxLength('business_name', 200);

        $validator->optional('tax_id');
        $validator->string('tax_id');
        $validator->maxLength('tax_id', 50);

        $validator->optional('email');
        $validator->email('email');

        $validator->optional('phone');
        $validator->string('phone');
        $validator->maxLength('phone', 20);

        $validator->optional('address');
        $validator->string('address');

        $validator->optional('subscription_plan');
        $validator->in('subscription_plan', ['free', 'basic', 'pro', 'enterprise']);

        $validator->optional('is_active');
        $validator->boolean('is_active');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar que no exista empresa con el mismo NIT
        if (!empty($data['tax_id'])) {
            $existing = $this->companyModel->findByTaxId($data['tax_id']);
            if ($existing) {
                Response::conflict('Ya existe una empresa con este NIT/RUC');
                return;
            }
        }

        $companyData = [
            'name' => $data['name'],
            'business_name' => $data['business_name'] ?? null,
            'tax_id' => $data['tax_id'] ?? null,
            'email' => $data['email'] ?? null,
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
            'subscription_plan' => $data['subscription_plan'] ?? 'free',
            'max_users' => 5,
            'max_accounts' => 50,
            'max_transactions_per_month' => 500,
            'is_active' => $data['is_active'] ?? true
        ];

        $company = $this->companyModel->create($companyData);

        if ($company) {
            Response::success($company, 'Empresa creada exitosamente', 201);
        } else {
            Response::error('Error al crear la empresa', 500);
        }
    }


    /**
     * PUT /api/companies/{id}
     * Actualizar empresa
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $company = $this->companyModel->find($id);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        // Verificar permisos: solo el owner de la empresa o admin global pueden actualizar
        if (!$this->isCompanyOwner($userId, $id) && $userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para actualizar esta empresa');
            return;
        }

        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        // Campos permitidos para actualizar
        $allowedFields = [
            'name',
            'business_name',
            'tax_id',
            'email',
            'phone',
            'address',
            'logo',
            'theme',
            'subscription_plan',
            'max_users',
            'max_accounts',
            'max_transactions_per_month',
            'is_active'
        ];

        $updateData = array_intersect_key($data, array_flip($allowedFields));

        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }

        $updated = $this->companyModel->update($id, $updateData);

        if ($updated) {
            Response::success($updated, 'Empresa actualizada exitosamente');
        } else {
            Response::error('Error al actualizar la empresa', 500);
        }
    }

    /**
     * DELETE /api/companies/{id}
     * Eliminar empresa (solo owner)
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $company = $this->companyModel->find($id);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        // ✅ CORREGIDO: super_admin O owner pueden eliminar
        $canDelete = ($userRole === 'super_admin') || $this->isCompanyOwner($userId, $id);

        if (!$canDelete) {
            Response::forbidden('No tienes permisos para eliminar esta empresa');
            return;
        }

        // Verificar si hay usuarios en la empresa
        $userCount = $this->userModel->countByCompany($id);
        if ($userCount > 0) {
            Response::error("No se puede eliminar la empresa porque tiene {$userCount} usuarios asociados", 400);
            return;
        }

        if ($this->companyModel->delete($id)) {
            Response::success(null, 'Empresa eliminada exitosamente');
        } else {
            Response::error('Error al eliminar la empresa', 500);
        }
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private function getUserId(): int
    {
        // Buscar en $_REQUEST (establecido por AuthMiddleware)
        if (isset($_REQUEST['user_id']) && !empty($_REQUEST['user_id'])) {
            return (int) $_REQUEST['user_id'];
        }

        // Intentar extraer del token (fallback)
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            try {
                $jwtService = new \App\Services\JWTService();
                $payload = $jwtService->validate($matches[1]);
                if ($payload && isset($payload['user_id'])) {
                    return (int) $payload['user_id'];
                }
            } catch (\Exception $e) {
                // Error al validar token
            }
        }

        return 0;
    }

    /**
     * Obtener company_id del usuario autenticado
     */
    private function getUserCompanyId(int $userId): int
    {
        if ($userId <= 0) {
            return 0;
        }

        $user = $this->userModel->find($userId);
        return $user['company_id'] ?? 0;
    }

    /**
     * Obtener rol del usuario autenticado
     */
    private function getUserRole(int $userId): string
    {
        if ($userId <= 0) {
            return 'guest';
        }

        $user = $this->userModel->find($userId);
        return $user['role'] ?? 'user';
    }

    /**
     * Verificar si el usuario es owner de la empresa
     */
    private function isCompanyOwner(int $userId, int $companyId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $user = $this->userModel->find($userId);
        return ($user['company_id'] ?? 0) === $companyId && ($user['role_in_company'] ?? '') === 'owner';
    }

    /**
     * GET /api/public/companies
     * Obtener empresas activas para el dashboard público
     */
    public function getPublicCompanies(): void
    {
        // Usar el método del modelo en lugar de acceder directamente a db
        $companies = $this->companyModel->getActiveCompanies();

        Response::success($companies);
    }

    // app/Controllers/CompanyController.php

    public function getLogo(int $id): void
    {
        $company = $this->companyModel->find($id);

        if (!$company || !$company['logo']) {
            Response::notFound('Logo no encontrado');
            return;
        }

        $logoPath = STORAGE_PATH . '/uploads/logos/' . $company['logo'];

        if (!file_exists($logoPath)) {
            Response::notFound('Archivo de logo no encontrado');
            return;
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $logoPath);
        finfo_close($finfo);

        header('Content-Type: ' . $mimeType);
        header('Content-Length: ' . filesize($logoPath));
        readfile($logoPath);
        exit();
    }

    // app/Controllers/CompanyController.php

    /**
     * POST /api/companies/{id}/logo
     * Subir logo de empresa
     */
    public function uploadLogo(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $company = $this->companyModel->find($id);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        if ($userRole !== 'super_admin' && !$this->isCompanyOwner($userId, $id)) {
            Response::forbidden('No tienes permisos para modificar esta empresa');
            return;
        }

        if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) {
            Response::error('No se recibió ningún archivo', 400);
            return;
        }

        $file = $_FILES['logo'];
        $allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
        $maxSize = 2 * 1024 * 1024; // 2MB

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = finfo_file($finfo, $file['tmp_name']);
        finfo_close($finfo);

        if (!in_array($mimeType, $allowedTypes)) {
            Response::validationError(['logo' => 'Formato no permitido. Use PNG, JPG o GIF']);
            return;
        }

        if ($file['size'] > $maxSize) {
            Response::validationError(['logo' => 'El logo no debe exceder los 2MB']);
            return;
        }

        $extension = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = 'company_' . $id . '_' . time() . '.' . $extension;
        $uploadPath = STORAGE_PATH . '/uploads/logos/' . $filename;

        if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
            Response::error('Error al guardar el logo', 500);
            return;
        }

        // Eliminar logo anterior si existe
        if ($company['logo'] && file_exists(STORAGE_PATH . '/uploads/logos/' . $company['logo'])) {
            unlink(STORAGE_PATH . '/uploads/logos/' . $company['logo']);
        }

        $this->companyModel->update($id, ['logo' => $filename]);

        Response::success([
            'logo_url' => "/api/companies/{$id}/logo",
            'filename' => $filename
        ], 'Logo actualizado exitosamente');
    }

    /**
     * DELETE /api/companies/{id}/logo
     * Eliminar logo
     */
    public function deleteLogo(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);

        $company = $this->companyModel->find($id);

        if (!$company) {
            Response::notFound('Empresa no encontrada');
            return;
        }

        if ($userRole !== 'super_admin' && !$this->isCompanyOwner($userId, $id)) {
            Response::forbidden('No tienes permisos');
            return;
        }

        if ($company['logo'] && file_exists(STORAGE_PATH . '/uploads/logos/' . $company['logo'])) {
            unlink(STORAGE_PATH . '/uploads/logos/' . $company['logo']);
        }

        $this->companyModel->update($id, ['logo' => null]);

        Response::success(null, 'Logo eliminado exitosamente');
    }
}
