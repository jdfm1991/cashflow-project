<?php

declare(strict_types=1);

/**
 * Modelo de Usuario
 * 
 * Gestiona todas las operaciones relacionadas con usuarios en la base de datos
 * 
 * @package App\Models
 */

namespace App\Models;

use App\Config\Database;
use PDO;
use PDOException;

class User extends BaseModel
{
    protected $table = 'users';
    protected $fillable = [
        'company_id', 
        'username',
        'email',
        'password_hash',
        'full_name',
        'role',
        'role_in_company',
        'is_active',
        'email_verified'
    ];
    protected $hidden = ['password_hash'];

    /**
     * Buscar usuario por username
     * 
     * @param string $username
     * @return array|null
     */
    public function findByUsername(string $username): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE username = :username";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['username' => $username]);

        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Buscar usuario por email
     * 
     * @param string $email
     * @return array|null
     */
    public function findByEmail(string $email): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE email = :email";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['email' => $email]);

        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Actualizar último login
     * 
     * @param int $userId
     * @return bool
     */
    public function updateLastLogin(int $userId): bool
    {
        $sql = "UPDATE {$this->table} SET last_login = NOW() WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $userId]);
    }

    /**
     * Registrar intento de login fallido
     * 
     * @param int $userId
     * @return bool
     */
    public function logFailedLogin(int $userId): bool
    {
        $sql = "UPDATE {$this->table} SET failed_login_attempts = failed_login_attempts + 1 
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $userId]);
    }

    /**
     * Guardar refresh token
     * 
     * @param int $userId
     * @param string $refreshToken
     * @return bool
     */
    public function saveRefreshToken(int $userId, string $refreshToken): bool
    {
        try {
            // Verificar si la tabla existe
            $this->ensureRefreshTokensTable();

            // Eliminar tokens existentes para este usuario
            $deleteSql = "DELETE FROM refresh_tokens WHERE user_id = :user_id";
            $deleteStmt = $this->db->prepare($deleteSql);
            $deleteStmt->execute(['user_id' => $userId]);

            // Insertar nuevo token
            $sql = "INSERT INTO refresh_tokens (user_id, token, expires_at) 
                VALUES (:user_id, :token, DATE_ADD(NOW(), INTERVAL 7 DAY))";

            $stmt = $this->db->prepare($sql);
            $result = $stmt->execute([
                ':user_id' => $userId,
                ':token' => $refreshToken
            ]);

            return $result;
        } catch (PDOException $e) {
            error_log("Error saving refresh token: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Asegurar que la tabla refresh_tokens existe
     */
    private function ensureRefreshTokensTable(): void
    {
        $sql = "CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_token (token),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";

        $this->db->exec($sql);
    }

    /**
     * Validar refresh token
     * 
     * @param string $refreshToken
     * @return int|null ID del usuario o null si es inválido
     */
    public function validateRefreshToken(string $refreshToken): ?int
    {
        try {
            $sql = "SELECT user_id FROM refresh_tokens 
                WHERE token = :token AND expires_at > NOW()";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([':token' => $refreshToken]);

            $result = $stmt->fetch();
            return $result ? (int)$result['user_id'] : null;
        } catch (PDOException $e) {
            error_log("Error validating refresh token: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Revocar refresh token de un usuario
     * 
     * @param int $userId
     * @return bool
     */
    public function revokeRefreshToken(int $userId): bool
    {
        $sql = "DELETE FROM refresh_tokens WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['user_id' => $userId]);
    }

    /**
     * Revocar todos los refresh tokens de un usuario
     * 
     * @param int $userId
     * @return bool
     */
    public function revokeAllRefreshTokens(int $userId): bool
    {
        return $this->revokeRefreshToken($userId);
    }

    /**
     * Actualizar contraseña
     * 
     * @param int $userId
     * @param string $newPasswordHash
     * @return bool
     */
    public function updatePassword(int $userId, string $newPasswordHash): bool
    {
        $sql = "UPDATE {$this->table} SET password_hash = :password_hash 
                WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'password_hash' => $newPasswordHash,
            'id' => $userId
        ]);
    }

    /**
     * Guardar token de recuperación de contraseña
     * 
     * @param int $userId
     * @param string $token
     * @return bool
     */
    public function saveResetToken(int $userId, string $token): bool
    {
        $sql = "INSERT INTO password_resets (user_id, token, expires_at) 
                VALUES (:user_id, :token, DATE_ADD(NOW(), INTERVAL 1 HOUR))
                ON DUPLICATE KEY UPDATE token = :token, expires_at = DATE_ADD(NOW(), INTERVAL 1 HOUR)";

        $stmt = $this->db->prepare($sql);
        return $stmt->execute([
            'user_id' => $userId,
            'token' => $token
        ]);
    }

    /**
     * Validar token de recuperación
     * 
     * @param string $token
     * @return int|null
     */
    public function validateResetToken(string $token): ?int
    {
        $sql = "SELECT user_id FROM password_resets 
                WHERE token = :token AND expires_at > NOW() AND used = 0";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['token' => $token]);

        $result = $stmt->fetch();
        return $result ? (int)$result['user_id'] : null;
    }

    /**
     * Invalidar token de recuperación usado
     * 
     * @param string $token
     * @return bool
     */
    public function invalidateResetToken(string $token): bool
    {
        $sql = "UPDATE password_resets SET used = 1 WHERE token = :token";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['token' => $token]);
    }

    /**
     * Validar token de verificación de email
     * 
     * @param string $token
     * @return int|null
     */
    public function validateVerificationToken(string $token): ?int
    {
        $sql = "SELECT user_id FROM email_verifications 
                WHERE token = :token AND expires_at > NOW() AND used = 0";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['token' => $token]);

        $result = $stmt->fetch();
        return $result ? (int)$result['user_id'] : null;
    }

    /**
     * Verificar email de usuario
     * 
     * @param int $userId
     * @return bool
     */
    public function verifyEmail(int $userId): bool
    {
        $sql = "UPDATE {$this->table} SET email_verified = 1 WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        return $stmt->execute(['id' => $userId]);
    }

    /**
     * Contar usuarios por empresa
     */
    public function countByCompany(int $companyId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE company_id = :company_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['company_id' => $companyId]);
        $result = $stmt->fetch();
        return (int) ($result['total'] ?? 0);
    }

    /**
     * Obtener usuarios por empresa
     */
    public function getByCompany(int $companyId, int $limit = 100): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE company_id = :company_id LIMIT :limit";
        $stmt = $this->db->prepare($sql);
        $stmt->bindValue('company_id', $companyId);
        $stmt->bindValue('limit', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        return $stmt->fetchAll();
    }

    /**
     * Verificar si es owner de la empresa
     */
    public function isCompanyOwner(int $userId, int $companyId): bool
    {
        $sql = "SELECT COUNT(*) as count FROM {$this->table} 
                WHERE id = :id AND company_id = :company_id AND role_in_company = 'owner'";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $userId, 'company_id' => $companyId]);
        $result = $stmt->fetch();
        return ($result['count'] ?? 0) > 0;
    }
}
