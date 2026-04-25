-- phpMyAdmin SQL Dump
-- version 6.0.0-dev+20240523.2997b5272e
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost
-- Tiempo de generación: 24-04-2026 a las 18:21:36
-- Versión del servidor: 8.0.19
-- Versión de PHP: 8.3.24

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `cashflow_db`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `accounts`
--

CREATE TABLE `accounts` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category_id` int DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_system` tinyint(1) DEFAULT '0' COMMENT 'Cuenta del sistema',
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `category` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `accounts`
--

INSERT INTO `accounts` (`id`, `name`, `type`, `category_id`, `description`, `is_system`, `is_active`, `sort_order`, `created_at`, `updated_at`, `category`) VALUES
(1, 'Ventas Online', 'income', 1, NULL, 1, 1, 1, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(2, 'Ventas Físicas', 'income', 1, NULL, 1, 1, 2, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(3, 'Alquiler Local', 'income', 2, NULL, 1, 1, 3, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(4, 'Consultoría', 'income', 3, NULL, 1, 1, 4, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(5, 'Intereses Bancarios', 'income', 4, NULL, 1, 1, 5, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(6, 'Impuesto de Renta', 'expense', 6, NULL, 1, 1, 1, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(7, 'IVA', 'expense', 6, NULL, 1, 1, 2, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(8, 'Nómina Mensual', 'expense', 7, NULL, 1, 1, 3, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(9, 'Honorarios Profesionales', 'expense', 8, NULL, 1, 1, 4, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(10, 'Compra Insumos', 'expense', 9, NULL, 1, 1, 5, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(11, 'Energía Eléctrica', 'expense', 10, NULL, 1, 1, 6, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(12, 'Agua', 'expense', 10, NULL, 1, 1, 7, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL),
(13, 'Internet', 'expense', 10, NULL, 1, 1, 8, '2026-04-01 21:41:19', '2026-04-24 18:03:10', NULL);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `company_id` int DEFAULT NULL,
  `action` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `entity_id` int DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `banks`
--

CREATE TABLE `banks` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre del banco',
  `code` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Código bancario (opcional)',
  `country` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'País',
  `website` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Sitio web',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono de contacto',
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Logo del banco',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `banks`
--

INSERT INTO `banks` (`id`, `name`, `code`, `country`, `website`, `phone`, `logo`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Banco Provincial', 'BBVA', 'Venexuela', '', '', NULL, 1, '2026-04-03 19:43:24', '2026-04-03 22:21:57'),
(2, 'Banco Mercantil', 'Mercantil', 'Venezuela', '', '', NULL, 1, '2026-04-03 22:18:38', '2026-04-03 22:18:38'),
(3, 'Banco de Venezuela', 'BDV', 'Venezuela', '', '', NULL, 1, '2026-04-03 22:23:08', '2026-04-03 22:23:08'),
(4, 'Banesco Banco Universal', 'Banesco', 'Venezuela', '', '', NULL, 1, '2026-04-03 22:23:30', '2026-04-15 00:08:53'),
(5, 'Banplus Banco Universal', '', 'Venezuela', '', '', NULL, 1, '2026-04-15 00:08:11', '2026-04-15 00:13:47'),
(6, 'Banco Caroní, C.A. Banco Universal', 'caroni', 'Venezuela', '', '', NULL, 1, '2026-04-15 00:21:23', '2026-04-15 00:22:55'),
(7, 'Banco Exterior', 'exterior', 'Venezuela', '', '', NULL, 1, '2026-04-15 01:21:24', '2026-04-15 01:21:35'),
(999, 'Migración Externa', 'MIG', 'Externo', NULL, NULL, NULL, 1, '2026-04-24 01:00:29', '2026-04-24 18:20:59');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `bank_accounts`
--

CREATE TABLE `bank_accounts` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'Empresa propietaria',
  `bank_id` int NOT NULL COMMENT 'Banco del catálogo global',
  `account_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Número de cuenta',
  `account_type` enum('corriente','ahorros','nomina','inversion') COLLATE utf8mb4_unicode_ci DEFAULT 'corriente',
  `currency_id` int NOT NULL COMMENT 'Moneda de la cuenta',
  `account_holder` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Titular de la cuenta',
  `opening_balance` decimal(15,2) DEFAULT '0.00',
  `current_balance` decimal(15,2) DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `bank_accounts`
--

INSERT INTO `bank_accounts` (`id`, `company_id`, `bank_id`, `account_number`, `account_type`, `currency_id`, `account_holder`, `opening_balance`, `current_balance`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, 1, '01081028785478962450', 'corriente', 9, 'mi cuentas', 2000.00, 2000.00, 1, '2026-04-03 19:44:04', '2026-04-03 19:44:04'),
(2, 1, 2, '01050412457896542574', 'corriente', 9, 'mi cuentas', 20.00, 20.00, 1, '2026-04-03 22:19:16', '2026-04-03 22:19:16'),
(3, 1, 4, '01340147987410325896', 'corriente', 9, 'otra cuenta', 25000.00, 25000.00, 1, '2026-04-03 22:23:59', '2026-04-03 22:23:59'),
(4, 1, 3, '01020145874587962458', 'corriente', 9, 'mi cuenta', 0.00, 0.00, 1, '2026-04-03 22:24:28', '2026-04-03 22:24:28');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `categories`
--

CREATE TABLE `categories` (
  `id` int NOT NULL,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `icon` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'bi-tag',
  `color` varchar(7) COLLATE utf8mb4_unicode_ci DEFAULT '#6c757d',
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_system` tinyint(1) DEFAULT '0' COMMENT 'Categoría del sistema (no editable)',
  `is_active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `categories`
--

INSERT INTO `categories` (`id`, `name`, `type`, `icon`, `color`, `description`, `is_system`, `is_active`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'Ventas', 'income', 'bi-cart', '#28a745', NULL, 0, 1, 1, '2026-04-01 21:41:19', '2026-04-24 18:13:11'),
(2, 'Alquileres', 'income', 'bi-house', '#17a2b8', NULL, 1, 1, 2, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(3, 'Servicios', 'income', 'bi-gear', '#20c997', NULL, 1, 1, 3, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(4, 'Intereses', 'income', 'bi-percent', '#fd7e14', NULL, 1, 1, 4, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(5, 'Otros Ingresos', 'income', 'bi-plus-circle', '#6c757d', NULL, 1, 1, 5, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(6, 'Impuestos', 'expense', 'bi-receipt', '#dc3545', NULL, 1, 1, 1, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(7, 'Nómina', 'expense', 'bi-people', '#fd7e14', NULL, 1, 1, 2, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(8, 'Honorarios', 'expense', 'bi-briefcase', '#6f42c1', NULL, 1, 1, 3, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(9, 'Proveedores', 'expense', 'bi-truck', '#20c997', NULL, 1, 1, 4, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(10, 'Servicios Públicos', 'expense', 'bi-lightbulb', '#ffc107', NULL, 1, 1, 5, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(11, 'Alquileres', 'expense', 'bi-building', '#17a2b8', NULL, 1, 1, 6, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(12, 'Mantenimiento', 'expense', 'bi-tools', '#6c757d', NULL, 1, 1, 7, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(13, 'Publicidad', 'expense', 'bi-megaphone', '#e83e8c', NULL, 1, 1, 8, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(14, 'Transporte', 'expense', 'bi-bus-front', '#20c997', NULL, 1, 1, 9, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(15, 'Otros Egresos', 'expense', 'bi-dash-circle', '#6c757d', NULL, 1, 1, 10, '2026-04-01 21:41:19', '2026-04-01 21:41:19');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `companies`
--

CREATE TABLE `companies` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre comercial',
  `business_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Razón social',
  `tax_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'NIT / RUC / RFC',
  `email` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Email corporativo',
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Teléfono',
  `address` text COLLATE utf8mb4_unicode_ci COMMENT 'Dirección',
  `logo` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Ruta del logo',
  `theme` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'light' COMMENT 'Tema visual',
  `subscription_plan` enum('free','basic','pro','enterprise') COLLATE utf8mb4_unicode_ci DEFAULT 'free',
  `subscription_expires_at` datetime DEFAULT NULL COMMENT 'Fecha de expiración de suscripción',
  `max_users` int DEFAULT '5' COMMENT 'Límite de usuarios',
  `max_accounts` int DEFAULT '50' COMMENT 'Límite de cuentas por empresa (catálogo global)',
  `max_transactions_per_month` int DEFAULT '500' COMMENT 'Límite de transacciones mensuales',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `companies`
--

INSERT INTO `companies` (`id`, `name`, `business_name`, `tax_id`, `email`, `phone`, `address`, `logo`, `theme`, `subscription_plan`, `subscription_expires_at`, `max_users`, `max_accounts`, `max_transactions_per_month`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Demo Company', 'Demo Company S.A.S.', '901234567-1', 'demo@cashflow.com', NULL, NULL, NULL, 'light', 'free', NULL, 5, 50, 500, 1, '2026-04-01 21:41:19', '2026-04-01 21:41:19'),
(4, 'Empresa Uno Actualizada S.A.S.', 'Empresa Uno S.A.S.', '901234567-2', 'admin@empresa1.com', '3001234567', 'Calle 123 #45-67, Bogotá', NULL, 'light', 'free', NULL, 5, 50, 500, 1, '2026-04-01 22:00:28', '2026-04-01 22:06:44'),
(5, 'Empresa Dos C.A.', 'Empresa Dos C.A.', '901234568-2', 'admin@empresa2.com', NULL, NULL, NULL, 'light', 'free', NULL, 5, 50, 500, 1, '2026-04-01 22:01:52', '2026-04-01 22:01:52');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `currencies`
--

CREATE TABLE `currencies` (
  `id` int NOT NULL,
  `code` varchar(3) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Código ISO (USD, EUR, COP, etc.)',
  `name` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre de la moneda',
  `symbol` varchar(5) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Símbolo ($, €, £, etc.)',
  `decimal_places` int DEFAULT '2' COMMENT 'Número de decimales',
  `is_base` tinyint(1) DEFAULT '0' COMMENT 'Moneda base del sistema',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `currencies`
--

INSERT INTO `currencies` (`id`, `code`, `name`, `symbol`, `decimal_places`, `is_base`, `is_active`, `created_at`, `updated_at`) VALUES
(2, 'USD', 'Dólar Estadounidense', 'US$', 2, 0, 1, '2026-04-02 10:13:33', '2026-04-02 10:13:33'),
(9, 'VES', 'Bolívar', 'Bs.S', 2, 1, 1, '2026-04-02 10:13:33', '2026-04-03 10:47:25');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `email_verifications`
--

CREATE TABLE `email_verifications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `exchange_rates`
--

CREATE TABLE `exchange_rates` (
  `id` int NOT NULL,
  `from_currency_id` int NOT NULL COMMENT 'Moneda origen',
  `to_currency_id` int NOT NULL COMMENT 'Moneda destino',
  `rate` decimal(20,8) NOT NULL COMMENT 'Tasa de cambio',
  `effective_date` date NOT NULL COMMENT 'Fecha efectiva',
  `source` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'manual' COMMENT 'Fuente (manual, api, etc.)',
  `created_by` int DEFAULT NULL COMMENT 'Usuario que registró',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `expenses`
--

CREATE TABLE `expenses` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'Empresa propietaria',
  `user_id` int NOT NULL COMMENT 'Usuario que registró',
  `account_id` int NOT NULL COMMENT 'Cuenta del catálogo global',
  `bank_account_id` int DEFAULT NULL,
  `bank_id` int DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency_id` int NOT NULL DEFAULT '1',
  `exchange_rate` decimal(20,8) DEFAULT '1.00000000',
  `amount_base_currency` decimal(15,2) DEFAULT NULL,
  `date` date NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` enum('cash','bank') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'bank',
  `receipt_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `external_connections`
--

CREATE TABLE `external_connections` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'Empresa propietaria',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Nombre descriptivo',
  `type` enum('migration','replication','integration') COLLATE utf8mb4_unicode_ci DEFAULT 'migration',
  `host` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `port` int DEFAULT '3306',
  `db_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `username` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Encriptado',
  `table_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `field_mapping` json DEFAULT NULL COMMENT 'Mapeo de campos personalizado',
  `query_template` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'SQL personalizado',
  `last_sync_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Volcado de datos para la tabla `external_connections`
--

INSERT INTO `external_connections` (`id`, `company_id`, `name`, `type`, `host`, `port`, `db_name`, `username`, `password`, `table_name`, `field_mapping`, `query_template`, `last_sync_at`, `is_active`, `created_at`, `updated_at`) VALUES
(2, 1, 'Sistema Contable Legacy', 'migration', 'localhost', 3306, 'inventario', 'root', 'lcmYAd2unHgJpeuaC5Ta1k8zYVZhOFlsb0FCajdzdU91V25RU3c9PQ==', 'adm_bancos_operaciones', '{\"date\": \"fecha_operacion\", \"income\": \"ingresos\", \"expense\": \"egresos\", \"reference\": \"numero_documento\", \"description\": \"conceptos\"}', NULL, NULL, 1, '2026-04-24 01:51:57', '2026-04-24 01:51:57'),
(3, 4, 'Sparrow Administrativo Cardiovascurlar', 'migration', '192.168.1.3', 3307, 'sparrow_siadcli', 'root', 'g+/E4qV6WRVLC+oOkDSkPmJxdHRORzB1Q0pFSU1VZ2U1Q3BOcDZZd1BBaUtKUjkrTUpYSGJPdHhGNDg9', 'adm_bancos_operaciones', '{\"date\": \"fecha_operacion\", \"income\": \"ingresos\", \"expense\": \"egresos\", \"reference\": \"numero_documento\", \"description\": \"conceptos\"}', NULL, NULL, 1, '2026-04-24 11:35:05', '2026-04-24 11:57:08'),
(4, 1, 'Sparrow Administrativo Hospital', 'migration', '192.168.1.3', 3306, 'sparrow_siadcli', 'root', 'g+/E4qV6WRVLC+oOkDSkPmJxdHRORzB1Q0pFSU1VZ2U1Q3BOcDZZd1BBaUtKUjkrTUpYSGJPdHhGNDg9', 'adm_bancos_operaciones', '{\"date\": \"fecha_operacion\", \"income\": \"ingresos\", \"expense\": \"egresos\", \"reference\": \"numero_documento\", \"description\": \"conceptos\"}', NULL, NULL, 1, '2026-04-24 11:39:56', '2026-04-24 11:48:58');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `imported_transactions`
--

CREATE TABLE `imported_transactions` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'ID de la empresa',
  `bank_id` int NOT NULL COMMENT 'ID del banco',
  `bank_account_id` int DEFAULT NULL COMMENT 'ID de la cuenta bancaria (opcional)',
  `transaction_date` date NOT NULL COMMENT 'Fecha de la transacción',
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Referencia de la transacción',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'Descripción de la transacción',
  `amount` decimal(15,2) NOT NULL COMMENT 'Monto de la transacción',
  `transaction_type` enum('income','expense') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Tipo: ingreso o egreso',
  `original_amount` decimal(15,2) DEFAULT NULL COMMENT 'Monto original (sin conversión)',
  `original_currency` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Moneda original',
  `exchange_rate` decimal(20,8) DEFAULT NULL COMMENT 'Tasa de cambio aplicada',
  `is_processed` tinyint(1) DEFAULT '0' COMMENT '¿Ya fue procesada/importada?',
  `mapped_account_id` int DEFAULT NULL COMMENT 'ID de la cuenta contable mapeada',
  `mapped_category` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Categoría mapeada',
  `import_session_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ID de sesión de importación',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Fecha de creación'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `incomes`
--

CREATE TABLE `incomes` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'Empresa propietaria',
  `user_id` int NOT NULL COMMENT 'Usuario que registró',
  `account_id` int NOT NULL COMMENT 'Cuenta del catálogo global',
  `bank_account_id` int DEFAULT NULL,
  `bank_id` int DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `currency_id` int NOT NULL DEFAULT '1',
  `exchange_rate` decimal(20,8) DEFAULT '1.00000000',
  `amount_base_currency` decimal(15,2) DEFAULT NULL,
  `date` date NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `reference` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_method` enum('cash','bank') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'bank',
  `receipt_path` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `migration_logs`
--

CREATE TABLE `migration_logs` (
  `id` int NOT NULL,
  `company_id` int NOT NULL,
  `connection_id` int NOT NULL,
  `migration_type` enum('income','expense','all') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `total_records` int DEFAULT '0',
  `imported_records` int DEFAULT '0',
  `duplicated_records` int DEFAULT '0',
  `failed_records` int DEFAULT '0',
  `status` enum('pending','processing','completed','failed') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_log` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL COMMENT 'Usuario que ejecutó la migración',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `migration_mappings`
--

CREATE TABLE `migration_mappings` (
  `id` int NOT NULL,
  `company_id` int NOT NULL,
  `connection_id` int NOT NULL,
  `source_table` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_field` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `source_value` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_type` enum('account','bank','category') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `target_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `notifications`
--

CREATE TABLE `notifications` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `password_resets`
--

CREATE TABLE `password_resets` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `refresh_tokens`
--

CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `token` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `upload_sessions`
--

CREATE TABLE `upload_sessions` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `upload_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('income','expense') COLLATE utf8mb4_unicode_ci NOT NULL,
  `total_rows` int DEFAULT '0',
  `processed_rows` int DEFAULT '0',
  `failed_rows` int DEFAULT '0',
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `error_log` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `company_id` int NOT NULL COMMENT 'Empresa a la que pertenece',
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('super_admin','admin','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user' COMMENT 'Rol global',
  `role_in_company` enum('owner','admin','user') COLLATE utf8mb4_unicode_ci DEFAULT 'user' COMMENT 'Rol dentro de la empresa',
  `is_active` tinyint(1) DEFAULT '1',
  `email_verified` tinyint(1) DEFAULT '0',
  `last_login` datetime DEFAULT NULL,
  `failed_login_attempts` int DEFAULT '0',
  `locked_until` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `user_preferences`
--

CREATE TABLE `user_preferences` (
  `id` int NOT NULL,
  `user_id` int NOT NULL,
  `company_id` int NOT NULL,
  `language` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT 'es',
  `currency` varchar(3) COLLATE utf8mb4_unicode_ci DEFAULT 'COP',
  `date_format` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Y-m-d',
  `timezone` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'America/Bogota',
  `notifications_email` tinyint(1) DEFAULT '1',
  `notifications_push` tinyint(1) DEFAULT '0',
  `theme` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'light',
  `dashboard_layout` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `fk_accounts_category` (`category_id`);

--
-- Indices de la tabla `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_action` (`action`),
  ADD KEY `idx_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indices de la tabla `banks`
--
ALTER TABLE `banks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_code` (`code`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indices de la tabla `bank_accounts`
--
ALTER TABLE `bank_accounts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_bank_id` (`bank_id`),
  ADD KEY `idx_currency_id` (`currency_id`),
  ADD KEY `idx_account_number` (`account_number`);

--
-- Indices de la tabla `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_category_name` (`name`,`type`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indices de la tabla `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tax_id` (`tax_id`),
  ADD KEY `idx_tax_id` (`tax_id`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_subscription_plan` (`subscription_plan`);

--
-- Indices de la tabla `currencies`
--
ALTER TABLE `currencies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_code` (`code`),
  ADD KEY `idx_is_base` (`is_base`);

--
-- Indices de la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indices de la tabla `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_rate` (`from_currency_id`,`to_currency_id`,`effective_date`),
  ADD KEY `idx_from_currency` (`from_currency_id`),
  ADD KEY `idx_to_currency` (`to_currency_id`),
  ADD KEY `idx_effective_date` (`effective_date`),
  ADD KEY `created_by` (`created_by`);

--
-- Indices de la tabla `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_amount` (`amount`),
  ADD KEY `idx_bank_account_id` (`bank_account_id`),
  ADD KEY `fk_expenses_currency` (`currency_id`),
  ADD KEY `idx_bank_id` (`bank_id`);

--
-- Indices de la tabla `external_connections`
--
ALTER TABLE `external_connections`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`);

--
-- Indices de la tabla `imported_transactions`
--
ALTER TABLE `imported_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_bank_id` (`bank_id`),
  ADD KEY `idx_bank_account_id` (`bank_account_id`),
  ADD KEY `idx_is_processed` (`is_processed`),
  ADD KEY `idx_import_session` (`import_session_id`),
  ADD KEY `idx_transaction_date` (`transaction_date`);

--
-- Indices de la tabla `incomes`
--
ALTER TABLE `incomes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_account_id` (`account_id`),
  ADD KEY `idx_date` (`date`),
  ADD KEY `idx_amount` (`amount`),
  ADD KEY `idx_bank_account_id` (`bank_account_id`),
  ADD KEY `fk_incomes_currency` (`currency_id`),
  ADD KEY `idx_bank_id` (`bank_id`);

--
-- Indices de la tabla `migration_logs`
--
ALTER TABLE `migration_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_connection_id` (`connection_id`),
  ADD KEY `idx_year_month` (`year`,`month`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `fk_migration_logs_user` (`created_by`);

--
-- Indices de la tabla `migration_mappings`
--
ALTER TABLE `migration_mappings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_mapping` (`connection_id`,`source_table`,`source_field`,`source_value`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_connection_id` (`connection_id`);

--
-- Indices de la tabla `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_is_read` (`is_read`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indices de la tabla `password_resets`
--
ALTER TABLE `password_resets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_expires_at` (`expires_at`);

--
-- Indices de la tabla `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `token` (`token`),
  ADD KEY `idx_token` (`token`),
  ADD KEY `idx_expires_at` (`expires_at`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indices de la tabla `upload_sessions`
--
ALTER TABLE `upload_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `upload_id` (`upload_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_upload_id` (`upload_id`),
  ADD KEY `idx_status` (`status`);

--
-- Indices de la tabla `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_email` (`email`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_role` (`role`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indices de la tabla `user_preferences`
--
ALTER TABLE `user_preferences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `user_id` (`user_id`),
  ADD KEY `company_id` (`company_id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de la tabla `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `banks`
--
ALTER TABLE `banks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1000;

--
-- AUTO_INCREMENT de la tabla `bank_accounts`
--
ALTER TABLE `bank_accounts`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT de la tabla `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT de la tabla `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `currencies`
--
ALTER TABLE `currencies`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT de la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `exchange_rates`
--
ALTER TABLE `exchange_rates`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `external_connections`
--
ALTER TABLE `external_connections`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT de la tabla `imported_transactions`
--
ALTER TABLE `imported_transactions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `incomes`
--
ALTER TABLE `incomes`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `migration_logs`
--
ALTER TABLE `migration_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `migration_mappings`
--
ALTER TABLE `migration_mappings`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `password_resets`
--
ALTER TABLE `password_resets`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `upload_sessions`
--
ALTER TABLE `upload_sessions`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `user_preferences`
--
ALTER TABLE `user_preferences`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `accounts`
--
ALTER TABLE `accounts`
  ADD CONSTRAINT `fk_accounts_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

--
-- Filtros para la tabla `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `bank_accounts`
--
ALTER TABLE `bank_accounts`
  ADD CONSTRAINT `bank_accounts_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `bank_accounts_ibfk_2` FOREIGN KEY (`bank_id`) REFERENCES `banks` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `bank_accounts_ibfk_3` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT;

--
-- Filtros para la tabla `email_verifications`
--
ALTER TABLE `email_verifications`
  ADD CONSTRAINT `email_verifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD CONSTRAINT `exchange_rates_ibfk_1` FOREIGN KEY (`from_currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `exchange_rates_ibfk_2` FOREIGN KEY (`to_currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `exchange_rates_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `expenses_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `expenses_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `expenses_ibfk_3` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `expenses_ibfk_4` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `expenses_ibfk_5` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT;

--
-- Filtros para la tabla `external_connections`
--
ALTER TABLE `external_connections`
  ADD CONSTRAINT `fk_external_connections_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `imported_transactions`
--
ALTER TABLE `imported_transactions`
  ADD CONSTRAINT `imported_transactions_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `imported_transactions_ibfk_2` FOREIGN KEY (`bank_id`) REFERENCES `banks` (`id`) ON DELETE RESTRICT;

--
-- Filtros para la tabla `incomes`
--
ALTER TABLE `incomes`
  ADD CONSTRAINT `incomes_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `incomes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `incomes_ibfk_3` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `incomes_ibfk_4` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `incomes_ibfk_5` FOREIGN KEY (`currency_id`) REFERENCES `currencies` (`id`) ON DELETE RESTRICT;

--
-- Filtros para la tabla `migration_logs`
--
ALTER TABLE `migration_logs`
  ADD CONSTRAINT `fk_migration_logs_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_migration_logs_connection` FOREIGN KEY (`connection_id`) REFERENCES `external_connections` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_migration_logs_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Filtros para la tabla `migration_mappings`
--
ALTER TABLE `migration_mappings`
  ADD CONSTRAINT `fk_migration_mappings_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_migration_mappings_connection` FOREIGN KEY (`connection_id`) REFERENCES `external_connections` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `password_resets`
--
ALTER TABLE `password_resets`
  ADD CONSTRAINT `password_resets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `refresh_tokens`
--
ALTER TABLE `refresh_tokens`
  ADD CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `upload_sessions`
--
ALTER TABLE `upload_sessions`
  ADD CONSTRAINT `upload_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `upload_sessions_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `user_preferences`
--
ALTER TABLE `user_preferences`
  ADD CONSTRAINT `user_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `user_preferences_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
