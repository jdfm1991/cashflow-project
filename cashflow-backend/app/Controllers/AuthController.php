<?php
// app/Controllers/AuthController.php
declare(strict_types=1);

namespace App\Controllers;

use App\Models\User;
use App\Models\Company;
use App\Services\JWTService;
use App\Helpers\Response;
use App\Helpers\Validator;

class AuthController
{
    private User $userModel;
    private Company $companyModel;
    private JWTService $jwtService;

    public function __construct()
    {
        $this->userModel = new User();
        $this->companyModel = new Company();
        $this->jwtService = new JWTService();
    }

    /**
     * POST /api/auth/register
     * Registrar nuevo usuario y su empresa
     */
    // app/Controllers/AuthController.php - Método register

    public function register(): void
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        error_log("Register - Raw input: " . ($rawInput ?: 'EMPTY'));

        if (empty($data) || $data === null) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        // Validar datos requeridos
        $validator = new Validator($data);
        $validator->required('username');
        $validator->required('email');
        $validator->required('password');
        $validator->required('full_name');
        $validator->required('company_name');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        // Verificar si el email ya existe
        $existingUser = $this->userModel->findByEmail($data['email']);
        if ($existingUser) {
            Response::conflict('El correo electrónico ya está registrado');
            return;
        }

        // Verificar si el username ya existe
        $existingUsername = $this->userModel->findByUsername($data['username']);
        if ($existingUsername) {
            Response::conflict('El nombre de usuario ya está en uso');
            return;
        }

        // Crear empresa
        $companyData = [
            'name' => $data['company_name'],
            'business_name' => $data['business_name'] ?? $data['company_name'],
            'tax_id' => $data['tax_id'] ?? null,
            'email' => $data['company_email'] ?? $data['email'],
            'phone' => $data['company_phone'] ?? null,
            'subscription_plan' => 'free',
            'max_users' => 5,
            'max_accounts' => 50,
            'max_transactions_per_month' => 500,
            'is_active' => true
        ];

        $company = $this->companyModel->create($companyData);

        if (!$company) {
            Response::internalError('Error al crear la empresa');
            return;
        }

        error_log("Company created with ID: " . $company['id']); // Log para debugging

        // Encriptar contraseña
        $passwordHash = password_hash($data['password'], PASSWORD_DEFAULT);

        // Crear usuario como owner de la empresa
        // ✅ Asegurar que company_id está incluido
        $userData = [
            'company_id' => $company['id'],  // ← IMPORTANTE: debe estar aquí
            'username' => trim($data['username']),
            'email' => trim($data['email']),
            'password_hash' => $passwordHash,
            'full_name' => trim($data['full_name']),
            'role' => 'admin',
            'role_in_company' => 'owner',
            'is_active' => 1,
            'email_verified' => 0
        ];

        error_log("User data: " . print_r($userData, true)); // Log para debugging

        $user = $this->userModel->create($userData);

        if ($user) {
            unset($user['password_hash']);
            Response::created([
                'user' => $user,
                'company' => $company
            ], 'Empresa y usuario registrados exitosamente');
        } else {
            // Rollback: eliminar la empresa si falló la creación del usuario
            $this->companyModel->delete($company['id']);
            Response::internalError('Error al registrar el usuario');
        }
    }

    /**
     * POST /api/auth/login
     * Iniciar sesión
     */
    public function login(): void
    {
        $rawInput = file_get_contents('php://input');
        $data = json_decode($rawInput, true);

        if (empty($data) || $data === null) {
            Response::error('No se recibieron datos', 400);
            return;
        }

        $validator = new Validator($data);
        $validator->required('username_or_email');
        $validator->required('password');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $usernameOrEmail = $data['username_or_email'];
        $password = $data['password'];

        // Buscar usuario por username o email
        $user = $this->userModel->findByUsername($usernameOrEmail);

        if (!$user) {
            $user = $this->userModel->findByEmail($usernameOrEmail);
        }

        if (!$user) {
            Response::unauthorized('Credenciales inválidas');
            return;
        }

        if (!$user['is_active']) {
            Response::forbidden('Cuenta desactivada');
            return;
        }

        if (!password_verify($password, $user['password_hash'])) {
            Response::unauthorized('Credenciales inválidas');
            return;
        }

        // Actualizar último login
        $this->userModel->updateLastLogin($user['id']);

        // Obtener datos de la empresa
        $company = $this->companyModel->find($user['company_id']);

        // Generar token
        $tokenData = [
            'user_id' => $user['id'],
            'company_id' => $user['company_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ];

        $accessToken = $this->jwtService->generate($tokenData);
        $refreshToken = $this->generateRefreshToken($user['id']);

        // Guardar refresh token
        $this->userModel->saveRefreshToken($user['id'], $refreshToken);

        unset($user['password_hash']);

        Response::success([
            'user' => $user,
            'company' => $company,
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'Bearer',
            'expires_in' => JWT_EXPIRATION
        ], 'Inicio de sesión exitoso');
    }

    /**
     * GET /api/auth/me
     * Obtener usuario actual
     */
    public function me(): void
    {
        $userId = $_REQUEST['user_id'] ?? null;

        if (!$userId) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $user = $this->userModel->find($userId);

        if (!$user) {
            Response::notFound('Usuario no encontrado');
            return;
        }

        $company = $this->companyModel->find($user['company_id']);

        unset($user['password_hash']);

        Response::success([
            'user' => $user,
            'company' => $company
        ]);
    }

    /**
     * POST /api/auth/logout
     * Cerrar sesión
     */
    public function logout(): void
    {
        $userId = $_REQUEST['user_id'] ?? null;

        if ($userId) {
            $this->userModel->revokeRefreshToken($userId);
        }

        Response::success(null, 'Sesión cerrada exitosamente');
    }

    /**
     * POST /api/auth/refresh
     * Refrescar token
     */
    public function refresh(): void
    {
        $data = json_decode(file_get_contents('php://input'), true);

        $validator = new Validator($data ?? []);
        $validator->required('refresh_token');

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $refreshToken = $data['refresh_token'];
        $userId = $this->userModel->validateRefreshToken($refreshToken);

        if (!$userId) {
            Response::unauthorized('Refresh token inválido');
            return;
        }

        $user = $this->userModel->find($userId);

        if (!$user) {
            Response::unauthorized('Usuario no encontrado');
            return;
        }

        $tokenData = [
            'user_id' => $user['id'],
            'company_id' => $user['company_id'],
            'username' => $user['username'],
            'email' => $user['email'],
            'role' => $user['role']
        ];

        $newAccessToken = $this->jwtService->generate($tokenData);
        $newRefreshToken = $this->generateRefreshToken($user['id']);

        $this->userModel->saveRefreshToken($user['id'], $newRefreshToken);

        Response::success([
            'access_token' => $newAccessToken,
            'refresh_token' => $newRefreshToken,
            'token_type' => 'Bearer',
            'expires_in' => JWT_EXPIRATION
        ], 'Token refrescado exitosamente');
    }

    /**
     * POST /api/auth/change-password
     * Cambiar contraseña
     */
    public function changePassword(): void
    {
        $userId = $_REQUEST['user_id'] ?? null;

        if (!$userId) {
            Response::unauthorized('Usuario no autenticado');
            return;
        }

        $data = json_decode(file_get_contents('php://input'), true);

        $validator = new Validator($data ?? []);
        $validator->required('current_password');
        $validator->required('new_password');
        $validator->minLength('new_password', 6);

        if (!$validator->passes()) {
            Response::validationError($validator->errors());
            return;
        }

        $user = $this->userModel->find($userId);

        if (!$user) {
            Response::notFound('Usuario no encontrado');
            return;
        }

        if (!password_verify($data['current_password'], $user['password_hash'])) {
            Response::unauthorized('Contraseña actual incorrecta');
            return;
        }

        $newPasswordHash = password_hash($data['new_password'], PASSWORD_DEFAULT);
        $updated = $this->userModel->updatePassword($userId, $newPasswordHash);

        if ($updated) {
            $this->userModel->revokeAllRefreshTokens($userId);
            Response::success(null, 'Contraseña actualizada exitosamente');
        } else {
            Response::internalError('Error al actualizar la contraseña');
        }
    }

    /**
     * Generar refresh token
     */
    private function generateRefreshToken(int $userId): string
    {
        $payload = [
            'user_id' => $userId,
            'type' => 'refresh',
            'exp' => time() + 604800
        ];

        return $this->jwtService->generate($payload);
    }

    /**
     * GET /api/auth/check
     * Verificar autenticación (método de prueba)
     */
    public function checkAuth(): void
    {
        // Obtener datos desde las variables que AuthMiddleware debería haber seteado
        $userId = $_REQUEST['user_id'] ?? 0;
        $companyId = $_REQUEST['company_id'] ?? 0;
        $userRole = $_REQUEST['user_role'] ?? 'guest';

        // También intentar desde el token si es necesario
        if ($userId == 0) {
            $payload = $this->getTokenPayload();
            if ($payload) {
                $userId = $payload['user_id'] ?? 0;
                $companyId = $payload['company_id'] ?? 0;
                $userRole = $payload['role'] ?? 'guest';
            }
        }

        Response::success([
            'authenticated' => $userId > 0,
            'user_id' => $userId,
            'company_id' => $companyId,
            'role' => $userRole,
            'message' => $userId > 0 ? 'Usuario autenticado' : 'Usuario no autenticado'
        ]);
    }

    /**
     * Obtener payload del token desde el header Authorization
     */
    private function getTokenPayload(): ?array
    {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? '';

        if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
            try {
                $jwtService = new \App\Services\JWTService();
                return $jwtService->validate($matches[1]);
            } catch (\Exception $e) {
                error_log("Error validating token: " . $e->getMessage());
                return null;
            }
        }

        return null;
    }
}
