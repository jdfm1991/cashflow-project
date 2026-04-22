<?php
// test_config.php - coloca esto en la raíz de tu proyecto (cashflow-backend/)

echo "=== BUSCANDO bank_configs.json ===\n";

$paths = [
    __DIR__ . '/app/config/bank_configs.json',
    __DIR__ . '/app/config/bank_configs.json',
    getcwd() . '/app/config/bank_configs.json',
];

foreach ($paths as $path) {
    echo "Probando: " . $path . "\n";
    echo "Existe: " . (file_exists($path) ? "✅ SI" : "❌ NO") . "\n";
    if (file_exists($path)) {
        echo "Contenido: " . file_get_contents($path) . "\n";
    }
    echo "---\n";
}