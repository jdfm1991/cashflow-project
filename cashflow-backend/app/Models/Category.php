<?php
declare(strict_types=1);

/**
 * Modelo de Categoría
 * 
 * Gestiona todas las operaciones relacionadas con categorías en la base de datos
 * 
 * @package App\Models
 */

namespace App\Models;

use PDO;

class Category extends BaseModel
{
    protected $table = 'categories';
    protected $fillable = [
        'user_id', 'name', 'type', 'icon', 'color', 
        'description', 'is_system', 'is_active', 'sort_order'
    ];
    protected $hidden = [];
    
    /**
     * Obtener todas las categorías (sistema + usuario)
     * 
     * @param int $userId
     * @param string|null $type
     * @param string|null $search
     * @param bool $includeSystem
     * @return array
     */
    public function getAll(int $userId, ?string $type = null, ?string $search = null, bool $includeSystem = true): array
    {
        $sql = "SELECT * FROM {$this->table} WHERE (user_id = :user_id";
        
        if ($includeSystem) {
            $sql .= " OR user_id IS NULL";
        }
        
        $sql .= ")";
        
        $params = ['user_id' => $userId];
        
        if ($type && $type !== 'all') {
            $sql .= " AND type = :type";
            $params['type'] = $type;
        }
        
        if ($search) {
            $sql .= " AND name LIKE :search";
            $params['search'] = "%{$search}%";
        }
        
        $sql .= " ORDER BY sort_order ASC, name ASC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Obtener categorías por tipo
     * 
     * @param int $userId
     * @param string $type
     * @return array
     */
    public function getByType(int $userId, string $type): array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE (user_id = :user_id OR user_id IS NULL) 
                    AND type = :type 
                    AND is_active = 1
                ORDER BY sort_order ASC, name ASC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id' => $userId,
            'type' => $type
        ]);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Buscar categoría por nombre
     * 
     * @param string $name
     * @param int $userId
     * @return array|null
     */
    public function findByName(string $name, int $userId): ?array
    {
        $sql = "SELECT * FROM {$this->table} 
                WHERE name = :name AND (user_id = :user_id OR user_id IS NULL)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'name' => $name,
            'user_id' => $userId
        ]);
        
        $result = $stmt->fetch();
        return $result ?: null;
    }
    
    /**
     * Contar categorías personalizadas de un usuario
     * 
     * @param int $userId
     * @return int
     */
    public function countUserCategories(int $userId): int
    {
        $sql = "SELECT COUNT(*) as total FROM {$this->table} WHERE user_id = :user_id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);
        
        return (int) $stmt->fetch()['total'];
    }
    
    /**
     * Obtener estadísticas de uso de categorías
     * 
     * @param int $userId
     * @param string|null $type
     * @return array
     */
    public function getUsageStats(int $userId, ?string $type = null): array
    {
        $sql = "SELECT 
                    c.id,
                    c.name,
                    c.type,
                    c.icon,
                    c.color,
                    COUNT(DISTINCT a.id) as accounts_count,
                    SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as income_total,
                    SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) as expense_total
                FROM categories c
                LEFT JOIN accounts a ON a.category = c.name AND a.type = c.type AND a.user_id = :user_id
                LEFT JOIN (
                    SELECT account_id, amount, 'income' as type FROM incomes WHERE user_id = :user_id
                    UNION ALL
                    SELECT account_id, amount, 'expense' as type FROM expenses WHERE user_id = :user_id
                ) t ON a.id = t.account_id
                WHERE (c.user_id = :user_id OR c.user_id IS NULL)";
        
        $params = ['user_id' => $userId];
        
        if ($type) {
            $sql .= " AND c.type = :type";
            $params['type'] = $type;
        }
        
        $sql .= " GROUP BY c.id, c.name, c.type, c.icon, c.color
                  ORDER BY c.type ASC, (income_total + expense_total) DESC";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        return $stmt->fetchAll();
    }
    
    /**
     * Obtener sugerencias de categorías basadas en descripción
     * 
     * @param int $userId
     * @param string $description
     * @param string|null $type
     * @param int $limit
     * @return array
     */
    public function getSuggestions(int $userId, string $description, ?string $type = null, int $limit = 5): array
    {
        // Palabras clave comunes
        $keywords = $this->extractKeywords($description);
        
        if (empty($keywords)) {
            return [];
        }
        
        $sql = "SELECT * FROM {$this->table} 
                WHERE (user_id = :user_id OR user_id IS NULL) 
                    AND is_active = 1";
        
        $params = ['user_id' => $userId];
        
        if ($type) {
            $sql .= " AND type = :type";
            $params['type'] = $type;
        }
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        
        $categories = $stmt->fetchAll();
        
        // Calcular puntuación basada en palabras clave
        foreach ($categories as &$category) {
            $score = 0;
            foreach ($keywords as $keyword) {
                if (stripos($category['name'], $keyword) !== false) {
                    $score += 10;
                }
                if (stripos($description, $category['name']) !== false) {
                    $score += 5;
                }
            }
            $category['score'] = $score;
        }
        
        // Ordenar por puntuación y limitar
        usort($categories, function($a, $b) {
            return $b['score'] <=> $a['score'];
        });
        
        return array_slice(array_filter($categories, function($cat) {
            return $cat['score'] > 0;
        }), 0, $limit);
    }
    
    /**
     * Extraer palabras clave de una descripción
     * 
     * @param string $description
     * @return array
     */
    private function extractKeywords(string $description): array
    {
        $commonWords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'en', 'por', 'para', 'con', 'sin'];
        
        $words = preg_split('/[\s,;:\.\-]+/', strtolower($description));
        $words = array_filter($words, function($word) use ($commonWords) {
            return strlen($word) > 2 && !in_array($word, $commonWords);
        });
        
        return array_unique($words);
    }
    
    /**
     * Actualizar orden de categorías
     * 
     * @param int $userId
     * @param array $order
     * @return bool
     */
    public function updateOrder(int $userId, array $order): bool
    {
        $this->db->beginTransaction();
        
        try {
            foreach ($order as $item) {
                $sql = "UPDATE {$this->table} SET sort_order = :sort_order 
                        WHERE id = :id AND (user_id = :user_id OR user_id IS NULL)";
                
                $stmt = $this->db->prepare($sql);
                $stmt->execute([
                    'sort_order' => $item['position'],
                    'id' => $item['id'],
                    'user_id' => $userId
                ]);
            }
            
            $this->db->commit();
            return true;
            
        } catch (\Exception $e) {
            $this->db->rollBack();
            return false;
        }
    }
}