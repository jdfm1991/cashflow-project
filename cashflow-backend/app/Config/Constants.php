<?php

/**
 * Archivo de constantes globales del sistema
 * 
 * Este archivo define constantes que están disponibles en toda la aplicación
 * y que no cambian durante la ejecución.
 */

namespace App\Config;

/**
 * Configuración de la aplicación
 */
class Constants
{
    /**
     * Inicializar constantes
     * Este método se ejecuta automáticamente al cargar el archivo
     */
    public static function init()
    {
        // Definir constantes de rutas
        // Directorio base del proyecto
        if (!defined('BASE_PATH')) {
            define('BASE_PATH', dirname(__DIR__, 2));
        }

        if (!defined('APP_PATH')) {
            define('APP_PATH', BASE_PATH . '/app');
        }

        if (!defined('PUBLIC_PATH')) {
            define('PUBLIC_PATH', BASE_PATH . '/public');
        }
        // Directorio de almacenamiento
        if (!defined('STORAGE_PATH')) {
            define('STORAGE_PATH', BASE_PATH . '/storage');
        }
        // Subdirectorios de storage
        if (!defined('LOGS_PATH')) {
            define('LOGS_PATH', STORAGE_PATH . '/logs');
        }

        if (!defined('UPLOADS_PATH')) {
            define('UPLOADS_PATH', STORAGE_PATH . '/uploads');
        }

        if (!defined('BANK_STATEMENTS_PATH')) {
            define('BANK_STATEMENTS_PATH', UPLOADS_PATH . '/bank_statements');
        }

        if (!defined('TEMP_PATH')) {
            define('TEMP_PATH', UPLOADS_PATH . '/temp');
        }

        if (!defined('EXPORTS_PATH')) {
            define('EXPORTS_PATH', STORAGE_PATH . '/exports');
        }

        if (!defined('CACHE_PATH')) {
            define('CACHE_PATH', STORAGE_PATH . '/cache');
        }

        // Definir constantes de configuración
        if (!defined('APP_NAME')) {
            define('APP_NAME', $_ENV['APP_NAME'] ?? 'CashFlow System');
        }

        if (!defined('APP_ENV')) {
            define('APP_ENV', $_ENV['APP_ENV'] ?? 'development');
        }

        if (!defined('APP_DEBUG')) {
            define('APP_DEBUG', ($_ENV['APP_DEBUG'] ?? 'true') === 'true');
        }

        if (!defined('APP_URL')) {
            define('APP_URL', $_ENV['APP_URL'] ?? 'http://localhost:8000');
        }

        // Definir constantes de base de datos
        if (!defined('DB_HOST')) {
            define('DB_HOST', $_ENV['DB_HOST'] ?? 'localhost');
        }

        if (!defined('DB_PORT')) {
            define('DB_PORT', $_ENV['DB_PORT'] ?? 3306);
        }

        if (!defined('DB_NAME')) {
            define('DB_NAME', $_ENV['DB_NAME'] ?? 'cashflow_db');
        }

        if (!defined('DB_USER')) {
            define('DB_USER', $_ENV['DB_USER'] ?? 'root');
        }

        if (!defined('DB_PASS')) {
            define('DB_PASS', $_ENV['DB_PASS'] ?? '');
        }

        if (!defined('DB_CHARSET')) {
            define('DB_CHARSET', $_ENV['DB_CHARSET'] ?? 'utf8mb4');
        }

        // Definir constantes JWT
        if (!defined('JWT_SECRET')) {
            define('JWT_SECRET', $_ENV['JWT_SECRET'] ?? 'default_secret_change_me');
        }

        if (!defined('JWT_EXPIRATION')) {
            define('JWT_EXPIRATION', (int)($_ENV['JWT_EXPIRATION'] ?? 3600));
        }

        if (!defined('JWT_ALGORITHM')) {
            define('JWT_ALGORITHM', $_ENV['JWT_ALGORITHM'] ?? 'HS256');
        }

        // Definir constantes de paginación
        if (!defined('ITEMS_PER_PAGE')) {
            define('ITEMS_PER_PAGE', 15);
        }

        // Definir constantes de archivos
        if (!defined('MAX_UPLOAD_SIZE')) {
            define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5MB
        }

        if (!defined('ALLOWED_EXTENSIONS')) {
            define('ALLOWED_EXTENSIONS', ['xlsx', 'xls', 'csv']);
        }

        // Definir constantes de caché
        if (!defined('CACHE_ENABLED')) {
            define('CACHE_ENABLED', false);
        }

        if (!defined('CACHE_TTL')) {
            define('CACHE_TTL', 3600); // 1 hora
        }

        // Definir constantes de roles de usuario
        if (!defined('ROLE_ADMIN')) {
            define('ROLE_ADMIN', 'admin');
        }

        if (!defined('ROLE_USER')) {
            define('ROLE_USER', 'user');
        }

        // Definir constantes de tipos de transacción
        if (!defined('TRANSACTION_TYPE_INCOME')) {
            define('TRANSACTION_TYPE_INCOME', 'income');
        }

        if (!defined('TRANSACTION_TYPE_EXPENSE')) {
            define('TRANSACTION_TYPE_EXPENSE', 'expense');
        }

        // Definir constantes de estados
        if (!defined('STATUS_ACTIVE')) {
            define('STATUS_ACTIVE', 'active');
        }

        if (!defined('STATUS_INACTIVE')) {
            define('STATUS_INACTIVE', 'inactive');
        }

        if (!defined('STATUS_PENDING')) {
            define('STATUS_PENDING', 'pending');
        }

        if (!defined('STATUS_COMPLETED')) {
            define('STATUS_COMPLETED', 'completed');
        }

        if (!defined('STATUS_CANCELLED')) {
            define('STATUS_CANCELLED', 'cancelled');
        }

        // Definir constantes de formato
        if (!defined('DATE_FORMAT')) {
            define('DATE_FORMAT', 'Y-m-d');
        }

        if (!defined('DATETIME_FORMAT')) {
            define('DATETIME_FORMAT', 'Y-m-d H:i:s');
        }

        if (!defined('CURRENCY')) {
            define('CURRENCY', 'COP');
        }

        if (!defined('CURRENCY_SYMBOL')) {
            define('CURRENCY_SYMBOL', '$');
        }

        if (!defined('DECIMAL_PLACES')) {
            define('DECIMAL_PLACES', 2);
        }

        if (!defined('THOUSANDS_SEPARATOR')) {
            define('THOUSANDS_SEPARATOR', ',');
        }

        if (!defined('DECIMAL_SEPARATOR')) {
            define('DECIMAL_SEPARATOR', '.');
        }
    }
}

// Ejecutar inicialización de constantes
Constants::init();

// Definir constantes adicionales que dependen de otras constantes
if (!defined('LOG_FILE')) {
    define('LOG_FILE', LOGS_PATH . '/app_' . date('Y-m-d') . '.log');
}

if (!defined('UPLOAD_URL')) {
    define('UPLOAD_URL', APP_URL . '/uploads');
}
