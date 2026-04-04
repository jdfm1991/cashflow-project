<?php

declare(strict_types=1);

/**
 * Middleware de CORS (Cross-Origin Resource Sharing)
 * 
 * Maneja las políticas de CORS para permitir o restringir peticiones
 * desde diferentes orígenes. Configura los headers necesarios para
 * que el frontend pueda comunicarse con la API.
 * 
 * @package App\Middleware
 */

namespace App\Middleware;

use App\Helpers\Response;

class CorsMiddleware
{
    /**
     * Orígenes permitidos
     * @var array
     */
    private array $allowedOrigins;

    /**
     * Métodos HTTP permitidos
     * @var array
     */
    private array $allowedMethods;

    /**
     * Headers permitidos
     * @var array
     */
    private array $allowedHeaders;

    /**
     * Headers expuestos
     * @var array
     */
    private array $exposedHeaders;

    /**
     * Tiempo de caché para preflight
     * @var int
     */
    private int $maxAge;

    /**
     * Permitir credenciales
     * @var bool
     */
    private bool $allowCredentials;

    /**
     * Constructor - Inicializa configuración CORS
     */
    public function __construct()
    {
        // Configuración desde variables de entorno
        $this->allowedOrigins = $this->parseAllowedOrigins($_ENV['ALLOWED_ORIGINS'] ?? 'http://localhost:3000,http://localhost:8000');
        $this->allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'];
        $this->allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'X-CSRF-Token'];
        $this->exposedHeaders = ['X-Total-Count', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'];
        $this->maxAge = 86400; // 24 horas
        $this->allowCredentials = true;
    }

    /**
     * Manejar la petición
     * 
     * @return bool
     */
    public function handle(): bool
    {
        // Orígenes permitidos (ajusta según tu entorno)
        $allowedOrigins = [
            'http://localhost:5500',     // Live Server VSCode
            'http://localhost:3000',     // React/Vue dev server
            'http://localhost:8000',     // Mismo servidor
            'http://127.0.0.1:5500',
            'http://127.0.0.1:3000',
            'http://localhost',          // Producción local
        ];

        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

        // Verificar si el origen está permitido
        if (in_array($origin, $allowedOrigins) || in_array('*', $allowedOrigins)) {
            header("Access-Control-Allow-Origin: {$origin}");
            header('Access-Control-Allow-Credentials: true');
        }

        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept');
        header('Access-Control-Max-Age: 86400');

        // Manejar preflight
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit();
        }

        return true;
    }

    /**
     * Configurar headers CORS
     * 
     * @param string|null $origin
     */
    private function setCorsHeaders(?string $origin): void
    {
        // Verificar si el origen está permitido
        if ($this->isOriginAllowed($origin)) {
            header("Access-Control-Allow-Origin: {$origin}");
        } elseif (in_array('*', $this->allowedOrigins)) {
            header('Access-Control-Allow-Origin: *');
        } else {
            // Si no hay origen permitido, usar el primero de la lista o *
            $defaultOrigin = $this->allowedOrigins[0] ?? '*';
            header("Access-Control-Allow-Origin: {$defaultOrigin}");
        }

        // Configurar headers adicionales
        if ($this->allowCredentials) {
            header('Access-Control-Allow-Credentials: true');
        }

        header('Access-Control-Allow-Methods: ' . implode(', ', $this->allowedMethods));
        header('Access-Control-Allow-Headers: ' . implode(', ', $this->allowedHeaders));

        if (!empty($this->exposedHeaders)) {
            header('Access-Control-Expose-Headers: ' . implode(', ', $this->exposedHeaders));
        }

        header('Access-Control-Max-Age: ' . $this->maxAge);

        // Headers de seguridad adicionales
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
    }

    /**
     * Manejar petición preflight (OPTIONS)
     */
    private function handlePreflight(): void
    {
        // Responder con 200 OK para preflight
        http_response_code(200);
        exit();
    }

    /**
     * Verificar si el origen está permitido
     * 
     * @param string|null $origin
     * @return bool
     */
    private function isOriginAllowed(?string $origin): bool
    {
        if (!$origin) {
            return false;
        }

        // Extraer el dominio sin protocolo
        $parsedOrigin = parse_url($origin, PHP_URL_HOST) ?: $origin;

        foreach ($this->allowedOrigins as $allowed) {
            // Permitir * (todos los orígenes)
            if ($allowed === '*') {
                return true;
            }

            // Comparación exacta
            if ($origin === $allowed) {
                return true;
            }

            // Comparación con wildcard (ej: *.midominio.com)
            if (strpos($allowed, '*') !== false) {
                $pattern = str_replace('*', '.*', preg_quote($allowed, '/'));
                if (preg_match('/^' . $pattern . '$/i', $origin)) {
                    return true;
                }
            }

            // Comparación por dominio (sin protocolo)
            if ($parsedOrigin === $allowed) {
                return true;
            }

            // Comparación con subdominios
            if (strpos($parsedOrigin, '.' . $allowed) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Parsear orígenes permitidos desde string
     * 
     * @param string $origins
     * @return array
     */
    private function parseAllowedOrigins(string $origins): array
    {
        $origins = explode(',', $origins);
        return array_map('trim', $origins);
    }

    /**
     * Agregar origen permitido dinámicamente
     * 
     * @param string $origin
     * @return self
     */
    public function addAllowedOrigin(string $origin): self
    {
        if (!in_array($origin, $this->allowedOrigins)) {
            $this->allowedOrigins[] = $origin;
        }
        return $this;
    }

    /**
     * Agregar método permitido dinámicamente
     * 
     * @param string $method
     * @return self
     */
    public function addAllowedMethod(string $method): self
    {
        $method = strtoupper($method);
        if (!in_array($method, $this->allowedMethods)) {
            $this->allowedMethods[] = $method;
        }
        return $this;
    }

    /**
     * Agregar header permitido dinámicamente
     * 
     * @param string $header
     * @return self
     */
    public function addAllowedHeader(string $header): self
    {
        if (!in_array($header, $this->allowedHeaders)) {
            $this->allowedHeaders[] = $header;
        }
        return $this;
    }
}
