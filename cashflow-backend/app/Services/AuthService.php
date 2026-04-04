<?php
declare(strict_types=1);

/**
 * Servicio de Autenticación
 * 
 * Maneja toda la lógica de autenticación, generación de tokens,
 * validación de credenciales y gestión de sesiones.
 * 
 * @package App\Services
 */

namespace App\Services;

use App\Models\User;
use App\Helpers\Response;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;

class AuthService
{
    /**
     * Modelo de usuario
     * @var User
     */
    private User $userModel;
    
    /**
     * Secreto para JWT
     * @var string
     */
    private string $jwtSecret;
    
    /**
     * Algoritmo de cifrado
     * @var string
     */
    private string $algorithm;
    
    /**
     * Tiempo de expiración del token (segundos)
     * @var int
     */
    private int $expiration;
    
    /**
     * Constructor - Inicializa dependencias
     */
    public function __construct()
    {
        $this->userModel = new User();
        $this->jwtSecret = JWT_SECRET;
        $this->algorithm = JWT_ALGORITHM;
        $this->expiration = JWT_EXPIRATION;
    }
    
    /**
     * Autenticar usuario con credenciales
     * 
     * @param string $usernameOrEmail
     * @param string $password
     * @return array|null
     */
    public function authenticate(string $usernameOrEmail, string $password): ?array
    {
        // Buscar usuario por username o email
        $user = $this->userModel->findByUsername($usernameOrEmail);
        
        if (!$user) {
            $user = $this->userModel->findByEmail($usernameOrEmail);
        }
        
        // Verificar si el usuario existe
        if (!$user) {
            return null;
        }
        
        // Verificar si la cuenta está activa
        if (!$user['is_active']) {
            return null;
        }
        
        // Verificar contraseña
        if (!password_verify($password, $user['password_hash'])) {
            // Registrar intento fallido
            $this->userModel->logFailedLogin($user['id']);
            return null;
        }
        
        // Actualizar último login
        $this->userModel->updateLastLogin($user['id']);
        
        // Remover datos sensibles
        unset($user['password_hash']);
        
        return $user;
    }
    
    /**
     * Generar token JWT
     * 
     * @param array $userData
     * @return string
     */
    public function generateToken(array $userData): string
    {
        $issuedAt = time();
        $expireAt = $issuedAt + $this->expiration;
        
        $payload = [
            'user_id' => $userData['id'],
            'username' => $userData['username'],
            'email' => $userData['email'],
            'role' => $userData['role'],
            'iat' => $issuedAt,
            'exp' => $expireAt,
            'iss' => APP_URL,
            'aud' => APP_URL
        ];
        
        return JWT::encode($payload, $this->jwtSecret, $this->algorithm);
    }
    
    /**
     * Generar refresh token
     * 
     * @param int $userId
     * @return string
     */
    public function generateRefreshToken(int $userId): string
    {
        $issuedAt = time();
        $expireAt = $issuedAt + (7 * 24 * 3600); // 7 días
        
        $payload = [
            'user_id' => $userId,
            'type' => 'refresh',
            'iat' => $issuedAt,
            'exp' => $expireAt
        ];
        
        $refreshToken = JWT::encode($payload, $this->jwtSecret, $this->algorithm);
        
        // Guardar refresh token en base de datos
        $this->userModel->saveRefreshToken($userId, $refreshToken);
        
        return $refreshToken;
    }
    
    /**
     * Validar token JWT
     * 
     * @param string $token
     * @return array|null
     */
    public function validateToken(string $token): ?array
    {
        try {
            $decoded = JWT::decode($token, new Key($this->jwtSecret, $this->algorithm));
            return (array) $decoded;
            
        } catch (ExpiredException $e) {
            return null;
        } catch (SignatureInvalidException $e) {
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }
    
    /**
     * Validar refresh token
     * 
     * @param string $refreshToken
     * @return int|null
     */
    public function validateRefreshToken(string $refreshToken): ?int
    {
        return $this->userModel->validateRefreshToken($refreshToken);
    }
    
    /**
     * Revocar refresh token
     * 
     * @param int $userId
     * @return bool
     */
    public function revokeRefreshToken(int $userId): bool
    {
        return $this->userModel->revokeRefreshToken($userId);
    }
    
    /**
     * Cambiar contraseña de usuario
     * 
     * @param int $userId
     * @param string $currentPassword
     * @param string $newPassword
     * @return bool
     */
    public function changePassword(int $userId, string $currentPassword, string $newPassword): bool
    {
        $user = $this->userModel->find($userId);
        
        if (!$user) {
            return false;
        }
        
        // Verificar contraseña actual
        if (!password_verify($currentPassword, $user['password_hash'])) {
            return false;
        }
        
        // Actualizar contraseña
        $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = $this->userModel->updatePassword($userId, $newPasswordHash);
        
        if ($updated) {
            // Revocar todos los refresh tokens por seguridad
            $this->userModel->revokeAllRefreshTokens($userId);
        }
        
        return $updated;
    }
    
    /**
     * Solicitar recuperación de contraseña
     * 
     * @param string $email
     * @return string|null Token de recuperación o null si no existe el email
     */
    public function requestPasswordReset(string $email): ?string
    {
        $user = $this->userModel->findByEmail($email);
        
        if (!$user || !$user['is_active']) {
            return null;
        }
        
        // Generar token de recuperación
        $issuedAt = time();
        $expireAt = $issuedAt + 3600; // 1 hora
        
        $payload = [
            'user_id' => $user['id'],
            'type' => 'password_reset',
            'iat' => $issuedAt,
            'exp' => $expireAt
        ];
        
        $resetToken = JWT::encode($payload, $this->jwtSecret, $this->algorithm);
        
        // Guardar token en base de datos
        $this->userModel->saveResetToken($user['id'], $resetToken);
        
        return $resetToken;
    }
    
    /**
     * Restablecer contraseña con token
     * 
     * @param string $token
     * @param string $newPassword
     * @return bool
     */
    public function resetPassword(string $token, string $newPassword): bool
    {
        // Validar token
        $userId = $this->userModel->validateResetToken($token);
        
        if (!$userId) {
            return false;
        }
        
        // Actualizar contraseña
        $newPasswordHash = password_hash($newPassword, PASSWORD_DEFAULT);
        $updated = $this->userModel->updatePassword($userId, $newPasswordHash);
        
        if ($updated) {
            // Invalidar token usado
            $this->userModel->invalidateResetToken($token);
            
            // Revocar todos los refresh tokens
            $this->userModel->revokeAllRefreshTokens($userId);
        }
        
        return $updated;
    }
    
    /**
     * Verificar email con token
     * 
     * @param string $token
     * @return bool
     */
    public function verifyEmail(string $token): bool
    {
        $userId = $this->userModel->validateVerificationToken($token);
        
        if (!$userId) {
            return false;
        }
        
        return $this->userModel->verifyEmail($userId);
    }
    
    /**
     * Obtener usuario actual desde token
     * 
     * @param string $token
     * @return array|null
     */
    public function getCurrentUser(string $token): ?array
    {
        $payload = $this->validateToken($token);
        
        if (!$payload || !isset($payload['user_id'])) {
            return null;
        }
        
        $user = $this->userModel->find($payload['user_id']);
        
        if (!$user) {
            return null;
        }
        
        unset($user['password_hash']);
        
        return $user;
    }
    
    /**
     * Verificar si el usuario tiene rol de administrador
     * 
     * @param int $userId
     * @return bool
     */
    public function isAdmin(int $userId): bool
    {
        $user = $this->userModel->find($userId);
        return $user && $user['role'] === 'admin';
    }
    
    /**
     * Verificar si el usuario tiene permisos sobre un recurso
     * 
     * @param int $userId
     * @param int $resourceOwnerId
     * @return bool
     */
    public function hasPermission(int $userId, int $resourceOwnerId): bool
    {
        // Admin tiene permiso sobre todos los recursos
        if ($this->isAdmin($userId)) {
            return true;
        }
        
        // Usuario normal solo tiene permiso sobre sus propios recursos
        return $userId === $resourceOwnerId;
    }
}