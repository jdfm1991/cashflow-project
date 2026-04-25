<?php
// test_categories.php
require_once __DIR__ . '/../vendor/autoload.php';

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/../');
$dotenv->load();

use App\Models\Category;

$categoryModel = new Category();
$categories = $categoryModel->getAll();

echo "<h1>Test de Categorías</h1>";
echo "<pre>";
print_r($categories);
echo "</pre>";
