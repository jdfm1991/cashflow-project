<?php
// app/Controllers/UserController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Models\Company;
use App\Helpers\Response;
use App\Helpers\Validator;

class UserController
{
    private User $userModel;
    private Company $companyModel;
    
    public function __construct()
    {
        $this->userModel = new User();
        $this->companyModel = new Company();
    }
    
    /**
     * GET /api/users
     * Listar todos los usuarios (solo super_admin)
     */
    public function index(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para listar todos los usuarios');
            return;
        }
        
        $users = $this->userModel->all();
        
        // Ocultar contraseñas
        foreach ($users as &$user) {
            unset($user['password_hash']);
        }
        
        Response::success($users);
    }
    
    /**
     * GET /api/users/{id}
     * Obtener usuario específico
     */
    public function show(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        
        $user = $this->userModel->find($id);
        
        if (!$user) {
            Response::notFound('Usuario no encontrado');
            return;
        }
        
        if ($userRole !== 'super_admin' && $user['company_id'] != $this->getUserCompanyId($userId)) {
            Response::forbidden('No tienes permisos para ver este usuario');
            return;
        }
        
        unset($user['password_hash']);
        Response::success($user);
    }
    
    /**
     * POST /api/users
     * Crear nuevo usuario (solo super_admin)
     */
    public function store(): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        
        if ($userRole !== 'super_admin') {
            Response::forbidden('No tienes permisos para crear usuarios');
            return;
        }
        
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        
        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }
        
        $validator = new Validator($data);
        $validator->required('username');
        $validator->string('username');
        $validator->minLength('username', 3);
        $validator->maxLength('username', 50);
        
        $validator->required('email');
        $validator->email('email');
        
        $validator->required('full_name');
        $validator->string('full_name');
        $validator->minLength('full_name', 3);
        $validator->maxLength('full_name', 100);
        
        $validator->required('company_id');
        $validator->numeric('company_id');
        
        $validator->required('password');
        $validator->string('password');
        $validator->minLength('password', 6);
        
        $validator->optional('role');
        $validator->in('role', ['user', 'admin', 'super_admin']);
        
        $validator->optional('role_in_company');
        $validator->in('role_in_company', ['user', 'admin', 'owner']);
        
        $validator->optional('is_active');
        $validator->boolean('is_active');
        
        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }
        
        // Verificar que la empresa existe
        $company = $this->companyModel->find($data['company_id']);
        if (!$company) {
            Response::validationError(['company_id' => 'La empresa no existe']);
            return;
        }
        
        // Verificar que el username no existe
        $existingUsername = $this->userModel->findByUsername($data['username']);
        if ($existingUsername) {
            Response::conflict('El nombre de usuario ya existe');
            return;
        }
        
        // Verificar que el email no existe
        $existingEmail = $this->userModel->findByEmail($data['email']);
        if ($existingEmail) {
            Response::conflict('El correo electrónico ya está registrado');
            return;
        }
        
        $userData = [
            'company_id' => $data['company_id'],
            'username' => $data['username'],
            'email' => $data['email'],
            'password_hash' => password_hash($data['password'], PASSWORD_DEFAULT),
            'full_name' => $data['full_name'],
            'role' => $data['role'] ?? 'user',
            'role_in_company' => $data['role_in_company'] ?? 'user',
            'is_active' => $data['is_active'] ?? true,
            'email_verified' => false
        ];
        
        $user = $this->userModel->create($userData);
        
        if ($user) {
            unset($user['password_hash']);
            Response::success($user, 'Usuario creado exitosamente', 201);
        } else {
            Response::error('Error al crear el usuario', 500);
        }
    }
    
    /**
     * PUT /api/users/{id}
     * Actualizar usuario
     */
    public function update(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        
        $user = $this->userModel->find($id);
        
        if (!$user) {
            Response::notFound('Usuario no encontrado');
            return;
        }
        
        if ($userRole !== 'super_admin' && $user['company_id'] != $this->getUserCompanyId($userId)) {
            Response::forbidden('No tienes permisos para actualizar este usuario');
            return;
        }
        
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);
        
        if (empty($data)) {
            Response::error('No se recibieron datos', 400);
            return;
        }
        
        $allowedFields = ['full_name', 'role', 'role_in_company', 'is_active'];
        if ($userRole === 'super_admin') {
            $allowedFields[] = 'company_id';
            $allowedFields[] = 'email';
            $allowedFields[] = 'username';
        }
        
        $updateData = array_intersect_key($data, array_flip($allowedFields));
        
        if (empty($updateData)) {
            Response::error('No hay campos válidos para actualizar', 400);
            return;
        }
        
        // Si se actualiza la contraseña
        if (isset($data['password']) && !empty($data['password'])) {
            if (strlen($data['password']) < 6) {
                Response::validationError(['password' => 'La contraseña debe tener al menos 6 caracteres']);
                return;
            }
            $updateData['password_hash'] = password_hash($data['password'], PASSWORD_DEFAULT);
        }
        
        $updated = $this->userModel->update($id, $updateData);
        
        if ($updated) {
            unset($updated['password_hash']);
            Response::success($updated, 'Usuario actualizado exitosamente');
        } else {
            Response::error('Error al actualizar el usuario', 500);
        }
    }
    
    /**
     * DELETE /api/users/{id}
     * Eliminar usuario
     */
    public function destroy(int $id): void
    {
        $userId = $this->getUserId();
        $userRole = $this->getUserRole($userId);
        
        $user = $this->userModel->find($id);
        
        if (!$user) {
            Response::notFound('Usuario no encontrado');
            return;
        }
        
        if ($userRole !== 'super_admin' && $user['company_id'] != $this->getUserCompanyId($userId)) {
            Response::forbidden('No tienes permisos para eliminar este usuario');
            return;
        }
        
        // No permitir eliminar el propio usuario
        if ($id === $userId) {
            Response::forbidden('No puedes eliminar tu propio usuario');
            return;
        }
        
        if ($this->userModel->delete($id)) {
            Response::success(null, 'Usuario eliminado exitosamente');
        } else {
            Response::error('Error al eliminar el usuario', 500);
        }
    }
    
    private function getUserId(): int
    {
        if (isset($_REQUEST['user_id']) && !empty($_REQUEST['user_id'])) {
            return (int) $_REQUEST['user_id'];
        }
        
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
    
    private function getUserCompanyId(int $userId): int
    {
        if ($userId <= 0) {
            return 0;
        }
        
        $user = $this->userModel->find($userId);
        return $user['company_id'] ?? 0;
    }
    
    private function getUserRole(int $userId): string
    {
        if ($userId <= 0) {
            return 'guest';
        }
        
        $user = $this->userModel->find($userId);
        return $user['role'] ?? 'user';
    }
}