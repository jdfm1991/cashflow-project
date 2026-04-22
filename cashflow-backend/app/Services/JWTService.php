<?php
// app/Services/JWTService.php
namespace App\Services;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use App\Exceptions\ApiException;

class JWTService
{
    private string $secret;
    private int $expiration;
    private string $algorithm;

    public function __construct()
    {
        $this->secret = $_ENV['JWT_SECRET'] ?? 'default_secret_change_me';
        $this->expiration = (int)($_ENV['JWT_EXPIRATION'] ?? 3600);
        $this->algorithm = $_ENV['JWT_ALGORITHM'] ?? 'HS256';
    }

    /**
     * Generar token JWT
     */
    public function generate(array $data): string
    {
        // ✅ Extraer los valores correctamente
        $userId = $data['user_id'] ?? $data['id'] ?? 0;
        $companyId = $data['company_id'] ?? 0;
        $username = $data['username'] ?? '';
        $email = $data['email'] ?? '';
        $role = $data['role'] ?? 'user';

        // ✅ Validar que tenemos user_id
        if ($userId <= 0) {
            error_log("JWTService ERROR: No se pudo obtener user_id. Data recibida: " . json_encode($data));
            throw new \Exception('No se puede generar token sin user_id válido');
        }

        $payload = [
            'user_id' => $userId,
            'company_id' => $companyId,
            'username' => $username,
            'email' => $email,
            'role' => $role,
            'iat' => time(),
            'exp' => time() + (JWT_EXPIRATION ?? 3600)
        ];

        error_log("JWTService: Generando token para user_id: {$userId}");

        return $this->encode($payload);
    }

    /**
     * Codificar payload a JWT
     */
    private function encode(array $payload): string
    {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payloadJson = json_encode($payload);

        $base64UrlHeader = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
        $base64UrlPayload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payloadJson));

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secret, true);
        $base64UrlSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    /**
     * Validar y decodificar token JWT
     */
    public function validate(string $token): ?array
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) {
                throw new \Exception('Token inválido');
            }

            list($base64UrlHeader, $base64UrlPayload, $base64UrlSignature) = $parts;

            // Verificar firma
            $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secret, true);
            $expectedSignature = str_replace(['-', '_'], ['+', '/'], $base64UrlSignature);
            $decodedSignature = base64_decode($expectedSignature);

            if (!hash_equals($signature, $decodedSignature)) {
                throw new \Exception('Firma inválida');
            }

            // Decodificar payload
            $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $base64UrlPayload)), true);

            // Verificar expiración
            if (isset($payload['exp']) && $payload['exp'] < time()) {
                throw new \Exception('Token expirado');
            }

            // ✅ Log para depuración
            error_log("JWTService: Token validado para user_id: " . ($payload['user_id'] ?? 'null'));

            return $payload;
        } catch (\Exception $e) {
            error_log("JWTService validation error: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Refrescar token (generar nuevo antes de expirar)
     */
    public function refresh(string $oldToken): string
    {
        $payload = $this->validate($oldToken);
        unset($payload['iat'], $payload['exp']);
        return $this->generate($payload);
    }

    /**
     * Extraer información del token sin validar firma
     * Útil para debugging
     */
    public function parse(string $token): array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new ApiException('Token mal formado', 400);
        }

        $payload = json_decode(base64_decode($parts[1]), true);
        return $payload ?: [];
    }
}
