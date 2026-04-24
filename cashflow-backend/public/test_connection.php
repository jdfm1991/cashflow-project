<?php
// test_external_db.php

require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

use App\Services\ExternalDatabaseService;

// Configuración de la conexión (usar los datos de tu BD externa)
$config = [
    'host' => 'localhost',
    'port' => 3306,
    'db_name' => 'inventario',
    'username' => 'root',
    'password' => '20975144'
];

$service = new ExternalDatabaseService($config);

echo "=== TEST EXTERNAL DATABASE SERVICE ===\n\n";

if ($service->connect()) {
    echo "✅ Conexión exitosa\n\n";

    // Probar años
    $years = $service->getAvailableYears();
    echo "Años disponibles: " . json_encode($years) . "\n\n";

    // Probar meses para el primer año
    if (!empty($years)) {
        $months = $service->getAvailableMonths($years[0]);
        echo "Meses para {$years[0]}: " . json_encode($months) . "\n\n";
    }

    // Probar transacciones
    if (!empty($years) && !empty($months)) {
        $transactions = $service->getTransactions($years[0], $months[0]);
        echo "Transacciones para {$years[0]}-{$months[0]}: " . count($transactions) . "\n";
        if (count($transactions) > 0) {
            echo "Primera transacción: " . json_encode($transactions[0]) . "\n";
        }
    }

    $service->disconnect();
} else {
    echo "❌ Error de conexión\n";
}
