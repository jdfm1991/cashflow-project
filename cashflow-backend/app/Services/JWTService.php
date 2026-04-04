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
    public function generate(array $payload): string
    {
        $issuedAt = time();
        $expireAt = $issuedAt + $this->expiration;
        
        $tokenPayload = array_merge($payload, [
            'iat' => $issuedAt,
            'exp' => $expireAt,
            'iss' => $_ENV['APP_URL'] ?? 'cashflow.local'
        ]);
        
        return JWT::encode($tokenPayload, $this->secret, $this->algorithm);
    }
    
    /**
     * Validar y decodificar token JWT
     */
    public function validate(string $token): array
    {
        try {
            // Versión 7.x: Usar Key object
            $decoded = JWT::decode($token, new Key($this->secret, $this->algorithm));
            return (array) $decoded;
            
        } catch (ExpiredException $e) {
            throw new ApiException('Token expirado', 401);
        } catch (SignatureInvalidException $e) {
            throw new ApiException('Firma de token inválida', 401);
        } catch (\Exception $e) {
            throw new ApiException('Token inválido: ' . $e->getMessage(), 401);
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