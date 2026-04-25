<?php
// app/Models/Category.php

namespace App\Models;

class Category extends BaseModel
{
    protected $table = 'categories';

    protected $fillable = [
        'name',
        'type',
        'icon',
        'color',
        'description',
        'is_system',
        'is_active',
        'sort_order'
    ];

    /**
     * Obtener categorías por tipo
     */
    public function getByType(string $type, bool $onlyActive = true): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE type = :type";
        if ($onlyActive) {
            $sql .= " AND is_active = 1";
        }
        $sql .= " ORDER BY sort_order ASC, name ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['type' => $type]);

        return $stmt->fetchAll();
    }

    /**
     * Obtener todas las categorías activas
     */
    public function getAllActive(): array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE is_active = 1 
                ORDER BY type, sort_order, name";

        $stmt = $this->db->prepare($sql);
        $stmt->execute();

        return $stmt->fetchAll();
    }

    /**
     * Verificar si una categoría tiene cuentas asociadas
     */
    public function hasAccounts(int $categoryId): bool
    {
        $sql = "SELECT COUNT(*) as total FROM accounts WHERE category = (SELECT name FROM categories WHERE id = :id)";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $categoryId]);
        $result = $stmt->fetch();

        return ($result['total'] ?? 0) > 0;
    }

    /**
     * Verificar si es categoría del sistema (no editable/eliminable)
     */
    public function isSystemCategory(int $id): bool
    {
        $sql = "SELECT is_system FROM {$this->table} WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['id' => $id]);
        $result = $stmt->fetch();

        return ($result['is_system'] ?? 0) == 1;
    }

    /**
     * Obtener todas las categorías (sin filtros)
     */
    public function getAll(): array
    {
        $sql = "SELECT * FROM {$this->table} ORDER BY type, sort_order, name";
        $stmt = $this->db->prepare($sql);
        $stmt->execute();
        $result = $stmt->fetchAll();

        error_log("Category::getAll() - Found " . count($result) . " records");

        return $result;
    }

    /**
     * Buscar categoría por nombre y tipo
     */
    public function findByNameAndType(string $name, string $type): ?array
    {
        $sql = "SELECT * FROM {$this->table} WHERE name = :name AND type = :type";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['name' => $name, 'type' => $type]);
        $result = $stmt->fetch();
        return $result ?: null;
    }

    /**
     * Obtener las cuentas que usan una categoría
     */
    public function getAccountsUsingCategory(int $categoryId): array
    {
        $category = $this->find($categoryId);
        if (!$category) return [];

        $sql = "SELECT id, name, type, description FROM accounts WHERE category = :category_name";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['category_name' => $category['name']]);

        return $stmt->fetchAll();
    }
}
